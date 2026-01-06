import os

try:
    if os.path.exists("quant_strategy.py"):
        os.remove("quant_strategy.py")
        print("Successfully removed quant_strategy.py")
    else:
        print("quant_strategy.py not found")
except Exception as e:
    print(f"Error removing file: {e}")
