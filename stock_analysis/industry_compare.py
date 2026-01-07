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
