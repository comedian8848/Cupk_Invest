# -*- coding: utf-8 -*-
"""
数据获取模块：负责从akshare获取所有财务和市场数据
"""
import akshare as ak
import pandas as pd
from datetime import datetime
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from functools import lru_cache
from config import MAX_WORKERS, KLINE_YEARS

try:
    import baostock as bs
    _HAS_BAOSTOCK = True
except Exception:
    bs = None
    _HAS_BAOSTOCK = False

# 全局线程池
_EXECUTOR = ThreadPoolExecutor(max_workers=MAX_WORKERS)

def _normalize_code(code):
    """标准化股票代码为6位数字"""
    code = str(code).strip()
    # 去除前缀如 sh/sz/SH/SZ
    for prefix in ['sh', 'sz', 'SH', 'SZ']:
        if code.startswith(prefix):
            code = code[2:]
    return code.zfill(6)

def _safe_float(value, default=0.0):
    """安全转换为浮点数"""
    try:
        if pd.isna(value) or value == '--' or value == '':
            return default
        return float(value)
    except (ValueError, TypeError):
        return default

def _format_number(num, unit='亿'):
    """格式化数字显示"""
    if not isinstance(num, (int, float)):
        return str(num)
    if unit == '亿':
        return f"{num/1e8:.2f}亿"
    elif unit == '万':
        return f"{num/1e4:.2f}万"
    else:
        return f"{num:.2f}"

def _to_bs_code(code):
    code = _normalize_code(code)
    if code.startswith('6'):
        return f"sh.{code}"
    return f"sz.{code}"

_BS_LOGGED_IN = False

def _bs_login():
    global _BS_LOGGED_IN
    if not _HAS_BAOSTOCK or _BS_LOGGED_IN:
        return _BS_LOGGED_IN
    try:
        lg = bs.login()
        if lg.error_code == '0':
            _BS_LOGGED_IN = True
    except Exception:
        _BS_LOGGED_IN = False
    return _BS_LOGGED_IN

def _bs_logout():
    global _BS_LOGGED_IN
    if not _HAS_BAOSTOCK or not _BS_LOGGED_IN:
        return
    try:
        bs.logout()
    except Exception:
        pass
    _BS_LOGGED_IN = False

def fetch_company_info(stock_code):
    """获取公司基本信息（带多级兜底）"""
    stock_name = stock_code
    industry = "未知"
    total_shares = 0

    try:
        info = ak.stock_individual_info_em(symbol=stock_code)
        name_row = info[info['item'] == '股票简称']
        industry_row = info[info['item'] == '行业']
        shares_row = info[info['item'] == '总股本']

        stock_name = name_row['value'].values[0] if not name_row.empty else stock_name
        industry = industry_row['value'].values[0] if not industry_row.empty else industry
        total_shares = _safe_float(shares_row['value'].values[0]) if not shares_row.empty else total_shares
    except Exception as e:
        print(f"  ⚠ 获取公司信息失败: {e}")

    # 兜底：名称
    if stock_name == stock_code:
        try:
            name_df = ak.stock_info_a_code_name()
            row = name_df[name_df['code'] == stock_code]
            if not row.empty:
                stock_name = row.iloc[0].get('name', stock_name) or stock_name
        except Exception:
            pass

    # 兜底：行业 / 总股本（来自行情快照）
    if industry == "未知" or total_shares == 0:
        try:
            spot = ak.stock_zh_a_spot_em()
            row = spot[spot['代码'] == stock_code]
            if not row.empty:
                row = row.iloc[0]
                if industry == "未知":
                    industry = row.get('行业', industry) or row.get('所属行业', industry)
                if total_shares == 0:
                    price = _safe_float(row.get('最新价', 0))
                    total_mv = _safe_float(row.get('总市值', 0))
                    if price > 0 and total_mv > 0:
                        total_shares = total_mv * 1e8 / price
        except Exception:
            pass

    # 兜底：Baostock（行业/名称/总股本）
    if _HAS_BAOSTOCK and (industry == "未知" or total_shares == 0 or stock_name == stock_code):
        try:
            if _bs_login():
                bs_code = _to_bs_code(stock_code)
                if stock_name == stock_code:
                    rs_basic = bs.query_stock_basic(code=bs_code)
                    if rs_basic.error_code == '0' and rs_basic.next():
                        stock_name = rs_basic.get_row_data()[1] or stock_name
                if industry == "未知":
                    rs_ind = bs.query_stock_industry(code=bs_code)
                    if rs_ind.error_code == '0' and rs_ind.next():
                        industry = rs_ind.get_row_data()[3] or industry
                if total_shares == 0:
                    # 使用最近一期资产负债表尝试获取总股本
                    today = datetime.now()
                    year = today.year
                    quarter = 3 if today.month >= 9 else (2 if today.month >= 6 else (1 if today.month >= 3 else 4))
                    rs_bs = bs.query_balance_data(code=bs_code, year=year, quarter=quarter)
                    if rs_bs.error_code == '0':
                        last_row = None
                        while rs_bs.next():
                            last_row = rs_bs.get_row_data()
                        if last_row:
                            try:
                                # totalShare 字段位置不固定，兼容字段名
                                fields = rs_bs.fields
                                if 'totalShare' in fields:
                                    idx = fields.index('totalShare')
                                    total_shares = _safe_float(last_row[idx], 0)
                            except Exception:
                                pass
        except Exception:
            pass

    print(f"  ✓ 公司: {stock_name} | 行业: {industry} | 总股本: {_format_number(total_shares)}")
    return {'stock_name': stock_name, 'industry': industry, 'total_shares': total_shares}

def fetch_financial_abstract(stock_code):
    """获取财务摘要数据"""
    try:
        df = ak.stock_financial_abstract(symbol=stock_code)
        if '选项' in df.columns:
            df = df.drop(columns=['选项'])
        if df['指标'].duplicated().any():
            df = df.drop_duplicates(subset=['指标'], keep='first')
        
        df = df.set_index('指标').T.reset_index().rename(columns={'index': '截止日期'})
        df.columns = [str(c).strip() for c in df.columns]
        df = df.loc[:, ~df.columns.duplicated()]
        
        df['截止日期'] = pd.to_datetime(df['截止日期'], format='%Y%m%d', errors='coerce')
        df = df.dropna(subset=['截止日期']).sort_values('截止日期')
        
        print(f"  ✓ 财务摘要: {len(df)} 期报告")
        return df
    except Exception as e:
        print(f"  ⚠ 获取财务摘要失败: {e}")
        return None

def _get_latest_row_by_date(df):
    if df is None or df.empty:
        return None
    date_col = next((c for c in df.columns if '报告期' in c or '报告日' in c or '截止日期' in c or c.lower() in ('date', 'report_date')), None)
    if date_col:
        try:
            df = df.copy()
            df[date_col] = pd.to_datetime(df[date_col], errors='coerce')
            df = df.dropna(subset=[date_col]).sort_values(date_col)
        except Exception:
            pass
    return df.iloc[-1] if len(df) > 0 else None

def fetch_financial_indicators(stock_code):
    """获取财务关键指标（ROE/毛利率/净利率/负债率），AKShare 优先，Baostock 兜底"""
    indicators = {
        'roe_pct': None,
        'gross_margin_pct': None,
        'net_margin_pct': None,
        'debt_ratio_pct': None,
        'source': None
    }

    # AKShare: 财务分析指标
    try:
        df = ak.stock_financial_analysis_indicator_em(symbol=stock_code)
        if df is not None and not df.empty:
            latest = _get_latest_row_by_date(df)
            if latest is not None:
                def pick(keys):
                    for k in keys:
                        if k in latest.index:
                            val = _safe_float(latest.get(k), None)
                            if val is not None:
                                return val
                    return None

                indicators['roe_pct'] = pick(['ROEJQ', 'ROEKCJQ', 'ROE', '净资产收益率'])
                indicators['gross_margin_pct'] = pick(['销售毛利率', '毛利率', 'XSMLL'])
                indicators['net_margin_pct'] = pick(['销售净利率', '净利率', 'XSJLL'])
                indicators['debt_ratio_pct'] = pick(['资产负债率', 'ZCFZL', '负债率'])
                indicators['source'] = 'ak_indicator'
    except Exception:
        pass

    # Baostock: 杜邦/盈利/偿债
    if _HAS_BAOSTOCK and (indicators['roe_pct'] is None and indicators['gross_margin_pct'] is None and indicators['net_margin_pct'] is None and indicators['debt_ratio_pct'] is None):
        try:
            if _bs_login():
                bs_code = _to_bs_code(stock_code)

                def iter_quarters(count=6):
                    now = datetime.now()
                    q = 3 if now.month >= 9 else (2 if now.month >= 6 else (1 if now.month >= 3 else 4))
                    y = now.year
                    for _ in range(count):
                        yield y, q
                        q -= 1
                        if q <= 0:
                            q = 4
                            y -= 1

                def bs_latest_value(query_fn, fields_candidates):
                    for y, q in iter_quarters():
                        rs = query_fn(code=bs_code, year=y, quarter=q)
                        if rs.error_code != '0':
                            continue
                        last_row = None
                        while rs.next():
                            last_row = rs.get_row_data()
                        if last_row is None:
                            continue
                        fields = rs.fields
                        for f in fields_candidates:
                            if f in fields:
                                idx = fields.index(f)
                                return _safe_float(last_row[idx], None)
                    return None

                indicators['roe_pct'] = bs_latest_value(bs.query_dupont_data, ['roe', 'dupontROE'])
                indicators['net_margin_pct'] = bs_latest_value(bs.query_dupont_data, ['netProfitMargin'])
                indicators['gross_margin_pct'] = bs_latest_value(bs.query_profit_data, ['grossProfitRate'])
                indicators['debt_ratio_pct'] = bs_latest_value(bs.query_balance_data, ['liabilityToAsset'])
                indicators['source'] = 'baostock'
        except Exception:
            pass

    return indicators

def fetch_balance_sheet(stock_code):
    """获取资产负债表"""
    try:
        df = ak.stock_financial_report_sina(stock=stock_code, symbol="资产负债表")
        df['报告日'] = pd.to_datetime(df['报告日'], format='%Y%m%d', errors='coerce')
        df = df.sort_values('报告日')
        print(f"  ✓ 资产负债表: {len(df)} 期")
        return df
    except Exception as e:
        print(f"  ⚠ 获取资产负债表失败: {e}")
        return None

def fetch_income_statement(stock_code):
    """获取利润表"""
    try:
        df = ak.stock_financial_report_sina(stock=stock_code, symbol="利润表")
        df['报告日'] = pd.to_datetime(df['报告日'], format='%Y%m%d', errors='coerce')
        df = df.sort_values('报告日')
        print(f"  ✓ 利润表: {len(df)} 期")
        return df
    except Exception as e:
        print(f"  ⚠ 获取利润表失败: {e}")
        return None

def fetch_cash_flow(stock_code):
    """获取现金流量表"""
    try:
        df = ak.stock_financial_report_sina(stock=stock_code, symbol="现金流量表")
        df['报告日'] = pd.to_datetime(df['报告日'], format='%Y%m%d', errors='coerce')
        df = df.sort_values('报告日')
        print(f"  ✓ 现金流量表: {len(df)} 期")
        return df
    except Exception as e:
        print(f"  ⚠ 获取现金流量表失败: {e}")
        return None

def fetch_kline_data(stock_code):
    """获取K线数据"""
    try:
        start_date = (datetime.now() - pd.DateOffset(years=KLINE_YEARS)).strftime('%Y%m%d')
        df = ak.stock_zh_a_hist(symbol=stock_code, period="daily", start_date=start_date, end_date=datetime.now().strftime('%Y%m%d'), adjust="qfq")
        if df is not None and not df.empty:
            df['日期'] = pd.to_datetime(df['日期'])
            print(f"  ✓ K线数据: {len(df)} 个交易日")
            return df
    except Exception as e:
        print(f"  ⚠ 获取K线数据失败: {e}")
    return None

def fetch_dividend_data(stock_code):
    """获取分红数据"""
    try:
        df = ak.stock_history_dividend_detail(symbol=stock_code, indicator="分红")
        print(f"  ✓ 分红记录: {len(df)} 次")
        return df
    except Exception as e:
        print(f"  ⚠ 获取分红数据失败: {e}")
        return None

def fetch_northbound_data(stock_code):
    """获取北向资金持股数据"""
    try:
        df = ak.stock_hsgt_individual_em(symbol=stock_code)
        if df is not None and not df.empty:
            print(f"  ✓ 北向资金: {len(df)} 期数据")
            return df
    except Exception as e:
        print(f"  ⚠ 获取北向资金失败: {e}")
        return None

def fetch_shareholder_data(stock_code, financial_data):
    """获取前十大股东数据"""
    try:
        if financial_data is None or len(financial_data) < 2:
            print("  ⚠ 股东数据: 无法确定报告期")
            return None

        dates = financial_data['截止日期'].dt.strftime('%Y%m%d').unique()
        latest_date, prev_date = dates[-1], dates[-2]

        # 尝试获取股东数据（东财接口可能不稳定）
        df_latest = None
        df_prev = None
        try:
            df_latest = ak.stock_gdfx_top_10_em(symbol=stock_code, date=latest_date)
        except Exception:
            pass  # 静默处理
        
        try:
            df_prev = ak.stock_gdfx_top_10_em(symbol=stock_code, date=prev_date)
        except Exception:
            pass  # 静默处理

        if df_latest is not None and not df_latest.empty:
            df_latest['持股数量'] = pd.to_numeric(df_latest['持股数量'], errors='coerce')
            if df_prev is not None and not df_prev.empty:
                df_prev['持股数量'] = pd.to_numeric(df_prev['持股数量'], errors='coerce')
                merged_df = pd.merge(df_latest, df_prev[['股东名称', '持股数量']], on='股东名称', how='left', suffixes=('', '_上期'))
                merged_df['较上期变化'] = merged_df['持股数量'] - merged_df['持股数量_上期'].fillna(0)
            else:
                merged_df = df_latest
                merged_df['较上期变化'] = 0
            
            print(f"  ✓ 股东数据: 已获取 {len(df_latest)} 名股东")
            return {'latest': merged_df, 'dates': {'latest': latest_date, 'prev': prev_date}}
        else:
            print("  ⚠ 股东数据: 接口暂不可用 (数据源限制)")
            return None
    except Exception as e:
        print(f"  ⚠ 股东数据: 获取失败")
    return None



def fetch_current_valuation(stock_code, stock_kline, total_shares=None):
    """获取当前估值（尽量避免全市场接口导致超时）"""
    def retry(callable_fn, tries=3, base_sleep=0.6):
        last_err = None
        for i in range(tries):
            try:
                return callable_fn(), None
            except Exception as e:
                last_err = e
                time.sleep(base_sleep * (1.6 ** i))
        return None, last_err

    fallback_price = 0
    fallback_change_pct = 0
    try:
        if stock_kline is not None and len(stock_kline) >= 2:
            fallback_price = _safe_float(stock_kline['收盘'].iloc[-1])
            prev_close = _safe_float(stock_kline['收盘'].iloc[-2])
            if prev_close > 0:
                fallback_change_pct = (fallback_price - prev_close) / prev_close * 100
        else:
            start_date = (datetime.now() - pd.DateOffset(days=45)).strftime('%Y%m%d')
            hist = ak.stock_zh_a_hist(
                symbol=stock_code,
                period="daily",
                start_date=start_date,
                end_date=datetime.now().strftime('%Y%m%d'),
                adjust="qfq",
            )
            if hist is not None and len(hist) >= 2:
                hist = hist.copy()
                hist['日期'] = pd.to_datetime(hist['日期'])
                hist = hist.sort_values('日期')
                fallback_price = _safe_float(hist['收盘'].iloc[-1])
                prev_close = _safe_float(hist['收盘'].iloc[-2])
                if prev_close > 0:
                    fallback_change_pct = (fallback_price - prev_close) / prev_close * 100
    except Exception:
        pass

    current_valuation = {
        'price': fallback_price, 'pe_ttm': 0.0, 'pb': 0.0, 'total_mv': 0.0,
        'circ_mv': 0.0, 'turnover': 0.0, 'volume_ratio': 0.0,
        'change_pct': fallback_change_pct, 'source': 'fallback'
    }

    def fetch_lg_indicator():
        for fn_name in ['stock_a_lg_indicator', 'stock_a_indicator_lg']:
            fn = getattr(ak, fn_name, None)
            if fn is None: continue
            df = fn(symbol=stock_code)
            if df is None or len(df) == 0: continue
            return df.iloc[-1]
        return None

    last, err = retry(fetch_lg_indicator, tries=2)
    if last is not None:
        pe, pb = 0.0, 0.0
        for key in ['pe_ttm', '市盈率TTM', '市盈率']:
            if key in last.index:
                pe = _safe_float(last.get(key)); break
        for key in ['pb', '市净率', 'PB']:
            if key in last.index:
                pb = _safe_float(last.get(key)); break
        current_valuation.update({'pe_ttm': pe, 'pb': pb, 'source': 'lg_indicator'})

    if (current_valuation.get('pe_ttm', 0) == 0 and current_valuation.get('pb', 0) == 0):
        def fetch_spot_one():
            spot = ak.stock_zh_a_spot_em()
            stock_row = spot[spot['代码'] == stock_code]
            if stock_row.empty: return None
            return stock_row.iloc[0]

        row, err2 = retry(fetch_spot_one, tries=1)
        if row is not None:
            current_valuation.update({
                'price': _safe_float(row.get('最新价', current_valuation['price'])),
                'pe_ttm': _safe_float(row.get('市盈率-动态', current_valuation['pe_ttm'])),
                'pb': _safe_float(row.get('市净率', current_valuation['pb'])),
                'total_mv': _safe_float(row.get('总市值', 0)),
                'circ_mv': _safe_float(row.get('流通市值', 0)),
                'turnover': _safe_float(row.get('换手率', 0)),
                'volume_ratio': _safe_float(row.get('量比', 0)),
                'change_pct': _safe_float(row.get('涨跌幅', current_valuation['change_pct'])),
                'source': 'spot_em'
            })

    # 兜底：Baostock 估值
    if _HAS_BAOSTOCK and (current_valuation.get('pe_ttm', 0) == 0 and current_valuation.get('pb', 0) == 0):
        try:
            if _bs_login():
                bs_code = _to_bs_code(stock_code)
                end_date = datetime.now().strftime('%Y-%m-%d')
                start_date = (datetime.now() - pd.DateOffset(days=45)).strftime('%Y-%m-%d')
                rs = bs.query_history_k_data_plus(
                    bs_code,
                    "date,close,peTTM,pbMRQ,turn",
                    start_date=start_date,
                    end_date=end_date,
                    frequency="d",
                    adjustflag="2"
                )
                if rs.error_code == '0':
                    last_row = None
                    while rs.next():
                        row = rs.get_row_data()
                        last_row = row
                    if last_row:
                        fields = rs.fields
                        def _get(field):
                            if field in fields:
                                return _safe_float(last_row[fields.index(field)], 0)
                            return 0
                        pe = _get('peTTM')
                        pb = _get('pbMRQ')
                        close = _get('close')
                        turn = _get('turn')
                        current_valuation.update({
                            'price': close or current_valuation['price'],
                            'pe_ttm': pe or current_valuation['pe_ttm'],
                            'pb': pb or current_valuation['pb'],
                            'turnover': turn or current_valuation['turnover'],
                            'source': 'baostock'
                        })
        except Exception:
            pass

    if current_valuation.get('total_mv', 0) == 0 and total_shares and current_valuation.get('price', 0) > 0:
        current_valuation['total_mv'] = current_valuation['price'] * total_shares
        if current_valuation.get('source') == 'fallback':
            current_valuation['source'] = 'derived'

    print(f"  ✓ 当前估值({current_valuation.get('source','?')}), "
          f"Price={current_valuation['price']:.2f}, PE={current_valuation.get('pe_ttm',0):.1f}, PB={current_valuation.get('pb',0):.2f}")
    return current_valuation

def fetch_all_data(stock_code):
    """
    并行获取所有需要的数据
    返回一个包含所有数据的字典
    """
    stock_code = _normalize_code(stock_code)
    print(f"\n{'='*50}")
    print(f"  正在并行获取 {stock_code} 的数据...")
    print(f"{'='*50}")
    
    start_time = time.time()
    
    # 先尝试从 Baostock 获取 K线作为兜底（不直接返回，只是预存）
    bs_kline_fallback = None
    if _HAS_BAOSTOCK:
        try:
            if _bs_login():
                bs_code = _to_bs_code(stock_code)
                start_date = (datetime.now() - pd.DateOffset(years=KLINE_YEARS)).strftime('%Y-%m-%d')
                end_date = datetime.now().strftime('%Y-%m-%d')
                rs = bs.query_history_k_data_plus(
                    bs_code,
                    "date,open,high,low,close,volume,amount",
                    start_date=start_date,
                    end_date=end_date,
                    frequency="d",
                    adjustflag="2"
                )
                if rs.error_code == '0':
                    rows = []
                    while rs.next():
                        rows.append(rs.get_row_data())
                    if rows:
                        df = pd.DataFrame(rows, columns=rs.fields)
                        df['date'] = pd.to_datetime(df['date'])
                        df = df.rename(columns={
                            'date': '日期',
                            'open': '开盘',
                            'high': '最高',
                            'low': '最低',
                            'close': '收盘',
                            'volume': '成交量',
                            'amount': '成交额'
                        })
                        bs_kline_fallback = df
                        print(f"  ✓ K线数据(baostock): {len(df)} 个交易日")
        except Exception:
            pass
    
    company_info = fetch_company_info(stock_code)
    
    fetch_tasks = {
        'financial_abstract': (fetch_financial_abstract, stock_code),
        'financial_indicators': (fetch_financial_indicators, stock_code),
        'balance_sheet': (fetch_balance_sheet, stock_code),
        'income_statement': (fetch_income_statement, stock_code),
        'cash_flow': (fetch_cash_flow, stock_code),
        'kline': (fetch_kline_data, stock_code),
        'dividend': (fetch_dividend_data, stock_code),
        'northbound': (fetch_northbound_data, stock_code),
    }
    
    results = {}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        future_to_name = {executor.submit(fn, *args): name for name, (fn, *args) in fetch_tasks.items()}
        
        for future in as_completed(future_to_name):
            name = future_to_name[future]
            try:
                results[name] = future.result()
            except Exception as e:
                print(f"  ⚠ {name} 获取失败: {e}")
                results[name] = None
    
    if results.get('financial_abstract') is not None:
        results['shareholder'] = fetch_shareholder_data(stock_code, results['financial_abstract'])
    else:
        results['shareholder'] = None
    
    # 如果 akshare K线失败，使用 baostock 兜底
    if results.get('kline') is None and bs_kline_fallback is not None:
        results['kline'] = bs_kline_fallback
        
    # 兜底总股本：从财务摘要中尝试获取
    if company_info.get('total_shares', 0) == 0 and results.get('financial_abstract') is not None:
        try:
            fa = results['financial_abstract']
            latest = fa.iloc[-1]
            candidates = [c for c in fa.columns if '总股本' in c or (('股本' in c) and ('每股' not in c))]
            if candidates:
                col = candidates[0]
                val = _safe_float(latest[col])
                if '万' in col or val < 1e7:
                    val *= 1e4
                if val > 0:
                    company_info['total_shares'] = val
        except Exception:
            pass

    results.update(company_info)

    # 最后获取当前估值
    results['current_valuation'] = fetch_current_valuation(stock_code, results.get('kline'), company_info.get('total_shares'))

    elapsed = time.time() - start_time
    print(f"\n✅ 数据获取完成: {results.get('stock_name')} ({stock_code}) [{elapsed:.1f}s]")
    
    return results