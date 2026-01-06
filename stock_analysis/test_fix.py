import pandas as pd
from stock_analysis_v2 import StockAnalyzer

def test_growth_momentum_fix():
    """
    Tests if the AttributeError in analyze_growth_momentum is fixed.
    """
    print("--- Running test for analyze_growth_momentum ---")
    try:
        # 使用一个有效的股票代码进行测试
        analyzer = StockAnalyzer("002683")
        
        # 需要获取数据才能进行分析
        analyzer.fetch_data()
        
        # 检查是否成功获取了财务数据
        if analyzer.financial_data is None or analyzer.financial_data.empty:
            print("--- Test Skipped: Could not fetch financial data. ---")
            return

        # 调用有问题的函数
        analyzer.analyze_growth_momentum()
        
        print("--- Test Passed: analyze_growth_momentum() executed without AttributeError. ---")
        
    except AttributeError as e:
        print(f"--- Test Failed: Encountered an AttributeError: {e} ---")
        raise e
    except Exception as e:
        print(f"--- Test Failed with an unexpected exception: {e} ---")
        raise e

if __name__ == "__main__":
    test_growth_momentum_fix()
