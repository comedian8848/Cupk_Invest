# -*- coding: utf-8 -*-
"""
核心分析模块：负责所有财务和技术指标的计算
"""
import pandas as pd
import numpy as np
from config import EVA_CONFIG

def _safe_float(value, default=0.0):
    """安全转换为浮点数"""
    try:
        if pd.isna(value) or value == '--' or value == '':
            return default
        return float(value)
    except (ValueError, TypeError):
        return default

def calculate_single_quarter_data(df):
    """将累计数据转换为单季度数据"""
    if df is None or df.empty:
        return df
        
    df = df.sort_values('截止日期').copy()
    
    # 需要处理的列：营收、净利润、扣非、现金流等累计值
    cols_to_diff = []
    for col in df.columns:
        if any(x in col for x in ['营收', '利润', '收益', '现金流', '费用', '成本']):
            if df[col].dtype in [float, int]:
                cols_to_diff.append(col)
    
    q_df = df.copy()
    years = df['截止日期'].dt.year.unique()
    
    for year in years:
        year_data = df[df['截止日期'].dt.year == year].sort_values('截止日期')
        if len(year_data) < 2:
            continue
            
        prev_row = None
        for idx, row in year_data.iterrows():
            if row['截止日期'].month == 3:
                prev_row = row
                continue
            
            if prev_row is not None:
                for col in cols_to_diff:
                    try:
                        curr_val = _safe_float(row[col])
                        prev_val = _safe_float(prev_row[col])
                        if curr_val != 0 or prev_val != 0:
                            q_df.at[idx, col] = curr_val - prev_val
                    except:
                        pass
            prev_row = row
            
    return q_df

def calculate_rsi(series, period=14):
    """计算RSI指标"""
    delta = series.diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss.replace(0, np.nan)
    rsi = 100 - (100 / (1 + rs))
    return rsi.fillna(50)

def calculate_macd(series, fast=12, slow=26, signal=9):
    """计算MACD指标"""
    ema_fast = series.ewm(span=fast, adjust=False).mean()
    ema_slow = series.ewm(span=slow, adjust=False).mean()
    dif = ema_fast - ema_slow
    dea = dif.ewm(span=signal, adjust=False).mean()
    macd = 2 * (dif - dea)
    return dif, dea, macd

def calculate_kdj(high, low, close, n=9, m1=3, m2=3):
    """计算KDJ指标"""
    low_n = low.rolling(window=n).min()
    high_n = high.rolling(window=n).max()
    rsv = (close - low_n) / (high_n - low_n) * 100
    rsv = rsv.fillna(50)
    k = rsv.ewm(com=m1-1, adjust=False).mean()
    d = k.ewm(com=m2-1, adjust=False).mean()
    j = 3 * k - 2 * d
    return k, d, j

def calculate_ma_slope(series, period=120):
    """计算均线斜率"""
    if len(series) < period:
        return 0
    y = series.tail(period).values
    x = np.arange(period)
    slope = np.polyfit(x, y, 1)[0]
    angle = np.degrees(np.arctan(slope / series.mean() * 100))
    return angle

def calculate_ttm_series(df, col_name):
    """计算滚动(TTM)数据序列"""
    if df is None or col_name not in df.columns:
        return pd.Series()
    
    date_col = '报告日' if '报告日' in df.columns else '截止日期'
    if date_col not in df.columns:
        return pd.Series()
        
    temp_df = df[[date_col, col_name]].copy().sort_values(date_col)
    temp_df[col_name] = temp_df[col_name].apply(_safe_float)
    ttm_series = {}
    
    for idx, row in temp_df.iterrows():
        curr_date, curr_val = row[date_col], row[col_name]
        if curr_date.month == 12:
            ttm_series[curr_date] = curr_val
        else:
            prev_annual = temp_df[(temp_df[date_col].dt.year == curr_date.year - 1) & (temp_df[date_col].dt.month == 12)]
            prev_same = temp_df[(temp_df[date_col].dt.year == curr_date.year - 1) & (temp_df[date_col].dt.month == curr_date.month)]
            
            if not prev_annual.empty and not prev_same.empty:
                val_annual = prev_annual.iloc[0][col_name]
                val_same = prev_same.iloc[0][col_name]
                ttm_series[curr_date] = curr_val + val_annual - val_same
            else:
                ttm_series[curr_date] = np.nan
                
    return pd.Series(ttm_series).sort_index()

def prepare_advanced_data(analyzer):
    """准备高级分析所需的数据 (TTM, EVA, 估值)"""
    data = {}
    inc_df, cf_df, bs_df, abs_df = analyzer.income_statement, analyzer.cash_flow_data, analyzer.balance_sheet, analyzer.financial_data
    
    rev_col = next((c for c in inc_df.columns if '营业总收入' in c), None) if inc_df is not None else next((c for c in abs_df.columns if '营业总收入' in c), None)
    profit_col = next((c for c in inc_df.columns if '净利润' in c), None) if inc_df is not None else None
    rd_col = next((c for c in inc_df.columns if '研发费用' in c), None) if inc_df is not None else None
    ocf_col = next((c for c in cf_df.columns if '经营' in c and '净额' in c), None) if cf_df is not None else None
    icf_col = next((c for c in cf_df.columns if '投资' in c and '净额' in c), None) if cf_df is not None else None
    cff_col = next((c for c in cf_df.columns if '筹资' in c and '净额' in c), None) if cf_df is not None else None
    ncf_col = next((c for c in cf_df.columns if '现金及现金等价物净增加额' in c), None) if cf_df is not None else None
    
    data['ttm_rev'] = calculate_ttm_series(inc_df if inc_df is not None else abs_df, rev_col)
    data['ttm_profit'] = calculate_ttm_series(inc_df if inc_df is not None else abs_df, profit_col)
    data['ttm_rd'] = calculate_ttm_series(inc_df, rd_col)
    data['ttm_ocf'] = calculate_ttm_series(cf_df, ocf_col)
    data['ttm_icf'] = calculate_ttm_series(cf_df, icf_col)
    data['ttm_cff'] = calculate_ttm_series(cf_df, cff_col)
    data['ttm_ncf'] = calculate_ttm_series(cf_df, ncf_col)

    if analyzer.stock_kline is not None and not data['ttm_profit'].empty:
        kline = analyzer.stock_kline.copy().set_index('日期').sort_index()
        ttm_profit_df = pd.DataFrame({'ttm_profit': data['ttm_profit']})
        ttm_rev_df = pd.DataFrame({'ttm_rev': data['ttm_rev']})
        
        equity_series = {}
        if bs_df is not None:
            eq_col = next((c for c in bs_df.columns if '归属于母公司' in c and '权益' in c), next((c for c in bs_df.columns if '所有者权益合计' in c or '股东权益合计' in c), None))
            if eq_col:
                for _, row in bs_df.iterrows():
                    equity_series[row['报告日']] = _safe_float(row[eq_col])
        equity_df = pd.DataFrame({'equity': pd.Series(equity_series)})
        
        full_df = kline.join(ttm_profit_df, how='left').ffill()
        full_df = full_df.join(ttm_rev_df, how='left').ffill()
        full_df = full_df.join(equity_df, how='left').ffill()
        full_df = full_df.dropna(subset=['收盘'])
        
        full_df['market_cap'] = full_df['收盘'] * analyzer.total_shares
        full_df['pe'] = full_df['market_cap'] / full_df['ttm_profit']
        full_df['pb'] = full_df['market_cap'] / full_df['equity']
        full_df['ps'] = full_df['market_cap'] / full_df['ttm_rev']
        data['valuation_daily'] = full_df
        
    return data