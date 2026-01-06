import akshare as ak
import inspect

try:
    if hasattr(ak, 'stock_analyst_rank_em'):
        print("Function: stock_analyst_rank_em")
        print(inspect.signature(ak.stock_analyst_rank_em))
        print(ak.stock_analyst_rank_em.__doc__)
    else:
        print("ak.stock_analyst_rank_em not found")

    if hasattr(ak, 'stock_analyst_detail_em'):
        print("\nFunction: stock_analyst_detail_em")
        print(inspect.signature(ak.stock_analyst_detail_em))
        print(ak.stock_analyst_detail_em.__doc__)
    else:
        print("ak.stock_analyst_detail_em not found")

except Exception as e:
    print(e)
