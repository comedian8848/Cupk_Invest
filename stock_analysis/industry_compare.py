# -*- coding: utf-8 -*-
"""
行业对比分析模块 (基于 akshare)
功能：
1. 获取公司所属行业的成分股列表
2. 对比同行业公司的关键指标（市盈率、市净率、涨跌幅等）
"""

import akshare as ak
import pandas as pd
from functools import lru_cache

try:
    import baostock as bs
    _HAS_BAOSTOCK = True
except Exception:
    bs = None
    _HAS_BAOSTOCK = False

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

def _to_bs_code(code):
    code = str(code).zfill(6)
    return f"sh.{code}" if code.startswith('6') else f"sz.{code}"

def _safe_float(value):
    try:
        if pd.isna(value) or value == '--' or value == '':
            return None
        return float(value)
    except Exception:
        return None

def _extract_latest_fundamentals(fin_df):
    if fin_df is None or fin_df.empty:
        return None
    try:
        if '选项' in fin_df.columns:
            fin_df = fin_df.drop(columns=['选项'])
        if fin_df['指标'].duplicated().any():
            fin_df = fin_df.drop_duplicates(subset=['指标'], keep='first')

        fin_df = fin_df.set_index('指标').T.reset_index().rename(columns={'index': '截止日期'})
        fin_df.columns = [str(c).strip() for c in fin_df.columns]
        fin_df = fin_df.loc[:, ~fin_df.columns.duplicated()]

        fin_df['截止日期'] = pd.to_datetime(fin_df['截止日期'], format='%Y%m%d', errors='coerce')
        fin_df = fin_df.dropna(subset=['截止日期']).sort_values('截止日期')
        if fin_df.empty:
            return None

        latest = fin_df.iloc[-1]
        gross_col = next((c for c in fin_df.columns if '毛利率' in c), None)
        net_margin_col = next((c for c in fin_df.columns if '净利率' in c), None)
        roe_col = next((c for c in fin_df.columns if '净资产收益率' in c), None)
        debt_col = next((c for c in fin_df.columns if '资产负债率' in c), None)

        return {
            'gross_margin': _safe_float(latest[gross_col]) if gross_col else None,
            'net_margin': _safe_float(latest[net_margin_col]) if net_margin_col else None,
            'roe': _safe_float(latest[roe_col]) if roe_col else None,
            'debt_ratio': _safe_float(latest[debt_col]) if debt_col else None,
        }
    except Exception:
        return None

@lru_cache(maxsize=1)
def get_all_industries():
    """获取所有行业板块列表（缓存）"""
    try:
        df = ak.stock_board_industry_name_em()
        return df
    except Exception as e:
        print(f"⚠ 获取行业列表失败: {e}")
        return None

def find_stock_industry(stock_code, stock_name=None):
    """
    查找股票所属行业
    返回: 行业名称 或 None
    """
    try:
        industries = get_all_industries()
        if industries is None:
            return None
        
        # 遍历每个行业，查找包含该股票的行业
        for _, row in industries.iterrows():
            industry_name = row['板块名称']
            try:
                cons = ak.stock_board_industry_cons_em(symbol=industry_name)
                # 检查股票代码是否在成分股中
                if stock_code in cons['代码'].values:
                    return industry_name
            except:
                continue
        
        return None
    except Exception as e:
        print(f"⚠ 查找行业失败: {e}")
        return None

def get_industry_comparison(industry_name, stock_code=None):
    """
    获取行业成分股对比数据
    
    参数:
        industry_name: 行业名称（如 "保险"、"白酒"）
        stock_code: 目标股票代码（可选，用于高亮显示）
    
    返回:
        DataFrame: 包含成分股的关键指标
    """
    try:
        df = ak.stock_board_industry_cons_em(symbol=industry_name)
        
        if df is None or df.empty:
            return None
        
        # 选择关键列并重命名
        columns_map = {
            '代码': '代码',
            '名称': '名称',
            '最新价': '股价',
            '涨跌幅': '涨跌幅',
            '市盈率-动态': 'PE(动态)',
            '市净率': 'PB',
            '换手率': '换手率',
            '成交额': '成交额'
        }
        
        # 只保留存在的列
        available_cols = [c for c in columns_map.keys() if c in df.columns]
        result = df[available_cols].copy()
        result = result.rename(columns={k: columns_map[k] for k in available_cols})
        
        # 数据类型转换
        for col in ['股价', '涨跌幅', 'PE(动态)', 'PB', '换手率', '成交额']:
            if col in result.columns:
                result[col] = pd.to_numeric(result[col], errors='coerce')
        
        # 按市值/成交额排序（通常大公司成交额高）
        if '成交额' in result.columns:
            result = result.sort_values('成交额', ascending=False)
        
        # 标记目标股票
        if stock_code:
            result['是否本股'] = result['代码'].apply(lambda x: '👉' if x == stock_code else '')
        
        return result
        
    except Exception as e:
        print(f"⚠ 获取行业成分股失败: {e}")
        return None

def get_industry_stats(industry_name):
    """
    获取行业整体统计数据
    
    返回:
        dict: 包含行业PE中位数、PB中位数、平均涨跌幅等
    """
    try:
        df = ak.stock_board_industry_cons_em(symbol=industry_name)
        
        if df is None or df.empty:
            return None
        
        # 转换数值
        pe_col = '市盈率-动态' if '市盈率-动态' in df.columns else None
        pb_col = '市净率' if '市净率' in df.columns else None
        change_col = '涨跌幅' if '涨跌幅' in df.columns else None
        
        stats = {'行业': industry_name, '成分股数': len(df)}
        
        if pe_col:
            pe_series = pd.to_numeric(df[pe_col], errors='coerce')
            # 过滤异常值（负PE和超高PE）
            pe_valid = pe_series[(pe_series > 0) & (pe_series < 500)]
            if not pe_valid.empty:
                stats['PE中位数'] = pe_valid.median()
                stats['PE平均'] = pe_valid.mean()
        
        if pb_col:
            pb_series = pd.to_numeric(df[pb_col], errors='coerce')
            pb_valid = pb_series[(pb_series > 0) & (pb_series < 50)]
            if not pb_valid.empty:
                stats['PB中位数'] = pb_valid.median()
                stats['PB平均'] = pb_valid.mean()
        
        if change_col:
            change_series = pd.to_numeric(df[change_col], errors='coerce')
            stats['今日涨跌均值'] = change_series.mean()
            stats['上涨家数'] = (change_series > 0).sum()
            stats['下跌家数'] = (change_series < 0).sum()
        
        return stats
        
    except Exception as e:
        print(f"⚠ 获取行业统计失败: {e}")
        return None

@lru_cache(maxsize=16)
def get_industry_fundamentals_avg(industry_name, limit=12):
    """
    获取行业财务指标均值（ROE/毛利率/净利率/负债率）
    从行业成分股中取前 N 只（按成交额排序）计算均值
    """
    try:
        df = get_industry_comparison(industry_name)
        if df is None or df.empty:
            return None

        codes = df['代码'].dropna().astype(str).head(limit).tolist()
        rows = []
        for code in codes:
            try:
                fin_df = ak.stock_financial_abstract(symbol=code)
                metrics = _extract_latest_fundamentals(fin_df)
                if metrics:
                    rows.append(metrics)
            except Exception:
                continue

        if not rows:
            # Baostock 兜底
            if _HAS_BAOSTOCK and _bs_login():
                bs_rows = []
                codes = df['代码'].dropna().astype(str).head(limit).tolist()

                def iter_quarters(count=6):
                    from datetime import datetime
                    now = datetime.now()
                    q = 3 if now.month >= 9 else (2 if now.month >= 6 else (1 if now.month >= 3 else 4))
                    y = now.year
                    for _ in range(count):
                        yield y, q
                        q -= 1
                        if q <= 0:
                            q = 4
                            y -= 1

                def bs_latest_value(bs_code, query_fn, fields_candidates):
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
                                return _safe_float(last_row[idx])
                    return None

                for code in codes:
                    bs_code = _to_bs_code(code)
                    row = {
                        'roe': bs_latest_value(bs_code, bs.query_dupont_data, ['roe', 'dupontROE']),
                        'net_margin': bs_latest_value(bs_code, bs.query_dupont_data, ['netProfitMargin']),
                        'gross_margin': bs_latest_value(bs_code, bs.query_profit_data, ['grossProfitRate']),
                        'debt_ratio': bs_latest_value(bs_code, bs.query_balance_data, ['liabilityToAsset'])
                    }
                    if any(v is not None for v in row.values()):
                        bs_rows.append(row)

                if not bs_rows:
                    return None

                rows = bs_rows
            else:
                return None

        def mean_of(key):
            vals = [r.get(key) for r in rows if isinstance(r.get(key), (int, float))]
            return sum(vals) / len(vals) if vals else None

        return {
            'roe': mean_of('roe'),
            'gross_margin': mean_of('gross_margin'),
            'net_margin': mean_of('net_margin'),
            'debt_ratio': mean_of('debt_ratio')
        }
    except Exception as e:
        print(f"⚠ 获取行业财务均值失败: {e}")
        return None


if __name__ == "__main__":
    # 测试代码
    print("=== 测试行业对比模块 ===\n")
    
    # 测试1: 获取酿酒行业成分股 (akshare中叫"酿酒行业"而非"白酒")
    print("1. 酿酒行业成分股 Top 5:")
    df = get_industry_comparison("酿酒行业", stock_code="600519")
    if df is not None:
        print(df.head(5).to_string(index=False))
    
    print("\n2. 酿酒行业统计:")
    stats = get_industry_stats("酿酒行业")
    if stats:
        for k, v in stats.items():
            if isinstance(v, float):
                print(f"   {k}: {v:.2f}")
            else:
                print(f"   {k}: {v}")
