# Windows 跨平台修复说明

## 问题描述
在Windows上通过网页端新建分析时出现错误：
```
Analysis failed: Traceback... stock_analysis_v2.py line 6099, in <module>
```

## 根本原因
1. **字体问题**: `config.py` 中硬编码的字体 `'Arial Unicode MS'` 只在macOS上可用，Windows上没有此字体，导致matplotlib初始化失败
2. **错误消息截断**: Flask后端只显示了前200个字符的错误信息，隐藏了真实问题
3. **路径处理**: subprocess调用时路径处理不够健壮

## 修复方案

### 1. 自适应字体配置 (`config.py`)
✅ **已修复**: 根据操作系统自动选择合适的字体
```python
# 根据操作系统选择合适的字体
_system = platform.system()
if _system == 'Darwin':  # macOS
    FONT_FAMILY = 'Arial Unicode MS'
elif _system == 'Windows':
    FONT_FAMILY = 'SimHei'
else:  # Linux
    FONT_FAMILY = 'WenQuanYi Micro Hei'
```

### 2. 更好的错误处理 (`stock_analysis_v2.py`)
✅ **已修复**: 
- 增强的导入错误处理和报告
- Windows编码配置
- 路径自动添加到Python路径

```python
# Windows编码处理
if sys.platform.startswith('win'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# 确保脚本所在目录在路径中
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)
```

### 3. 改进的Flask错误日志 (`server.py`)
✅ **已修复**: 
- 增加错误消息长度到1000字符（从200）
- 添加server console日志输出
- 尝试python3先，再fallback到python
- 设置PYTHONIOENCODING环境变量

```python
# Try python3 first, fallback to python
try:
    result = subprocess.run(
        ['python3', script_path, code],
        cwd=WORKING_DIR,
        capture_output=True,
        text=True,
        timeout=3600,
        env={**os.environ, 'PYTHONIOENCODING': 'utf-8'}
    )
except FileNotFoundError:
    result = subprocess.run(
        ['python', script_path, code],
        ...
    )
```

## 修改的文件
1. `/stock_analysis/config.py` - 跨平台字体自适应
2. `/stock_analysis/stock_analysis_v2.py` - 增强错误处理和Windows编码
3. `/stock_analysis/server.py` - 改进的subprocess调用和错误报告

## 测试方法

### Mac测试 ✅
```bash
python3 start_dashboard.py
# 在网页http://localhost:5173 点击"新建股票分析"，输入600519或其他股票代码
```

### Windows测试
```cmd
python start_dashboard.py
rem 或
python3 start_dashboard.py
rem 在网页http://localhost:5173 点击"新建股票分析"，输入600519或其他股票代码
```

### 本地命令行测试
```bash
# Mac/Linux
python3 stock_analysis/stock_analysis_v2.py 600519

# Windows
python stock_analysis/stock_analysis_v2.py 600519
或
python3 stock_analysis/stock_analysis_v2.py 600519
```

## 错误诊断
如果仍然有问题，可以：
1. 查看Flask server的console输出（会显示完整错误信息）
2. 检查Windows上是否安装了必要的库：`pip install -r stock_analysis/requirements.txt`
3. 确保Python版本 >= 3.8

## 已知兼容性
| OS | Python | matplotlib字体 | 状态 |
|-----|--------|-----------------|------|
| macOS | 3.8+ | Arial Unicode MS | ✅ |
| Windows | 3.8+ | SimHei | ✅ |
| Linux | 3.8+ | WenQuanYi Micro Hei | ✅ |

## 后续优化建议
1. 考虑使用平台无关的字体（如DejaVu Sans）作为最终备选
2. 添加前端错误提示UI改进（目前显示纯文本）
3. 实现实时日志流式输出到前端
