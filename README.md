# 🛢️ BlackOil 股票分析系统

[![Python](https://img.shields.io/badge/Python-3.9+-blue.svg)](https://www.python.org/)
[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61dafb.svg)](https://react.dev/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

> 🚀 专业级 A股/期货 技术分析系统，支持多周期技术指标、资金流向、行业对比、DCF/DDM估值等全方位分析

**核心特性**：
- ✅ 跨平台支持（macOS / Windows / Linux）
- ✅ 20+ 种专业分析图表自动生成
- ✅ AI 量化评分系统（0-100综合评分）
- ✅ DCF/DDM 内在价值估算
- ✅ Bloomberg 风格暗色专业界面

## 📋 目录

- [快速开始](#快速开始)
- [系统架构](#系统架构)
- [环境要求](#环境要求)
- [依赖安装](#依赖安装)
- [启动方法](#启动方法)
  - [macOS 启动](#macos-启动)
  - [Windows 启动](#windows-启动)
  - [Linux 启动](#linux-启动)
- [常见问题排查](#常见问题排查)
- [项目结构](#项目结构)
- [功能特性](#功能特性)
- [API 接口](#api-接口)
- [技术实现细节](#技术实现细节)

---

## 🚀 快速开始

**30 秒启动**：

```bash
# 1. 克隆或进入项目目录
cd Cupk_Vest

# 2. 运行环境诊断（确保依赖已安装）
python diagnose.py

# 3. 一键启动服务
python start_dashboard.py

# 4. 打开浏览器访问
# http://localhost:5173
```

**使用方法**：
1. 点击「新建分析」按钮
2. 输入 6 位股票代码（如 `600519` 贵州茅台）
3. 点击「开始分析」等待 3-5 分钟
4. 分析完成后自动显示报告，可切换不同标签查看各类图表

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Web Dashboard (React)                     │
│                     http://localhost:5173                    │
└─────────────────────┬───────────────────────────────────────┘
                      │ HTTP API
┌─────────────────────▼───────────────────────────────────────┐
│                  Flask Backend Server                        │
│                   http://localhost:5001                      │
└─────────────────────┬───────────────────────────────────────┘
                      │ subprocess
┌─────────────────────▼───────────────────────────────────────┐
│              stock_analysis_v2.py 分析引擎                   │
│           (akshare + backtrader + matplotlib)               │
└─────────────────────────────────────────────────────────────┘
```

---

## 环境要求

| 组件 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Python | 3.9+ | 3.11+ |
| Node.js | 16+ | 18+ |
| npm | 8+ | 9+ |

---

## 依赖安装

### 1. Python 依赖

```bash
cd stock_analysis
pip install -r requirements.txt
```

**requirements.txt 包含：**
- akshare (A股数据接口)
- backtrader (回测框架)
- pandas (数据处理)
- matplotlib (图表绑制)
- seaborn (统计可视化)
- flask + flask-cors (Web服务)

### 2. Node.js 依赖

```bash
cd web_dashboard
npm install
```

---

## 启动方法

### ⚠️ 重要提示：Python 环境

**系统中可能存在多个 Python 环境，必须使用安装了依赖的那个 Python！**

在启动前，请先运行诊断工具确认环境：

```bash
# 运行诊断脚本
python diagnose.py
```

如果诊断失败，尝试使用其他 Python 命令：
```bash
python3 diagnose.py
# 或
/path/to/your/python diagnose.py
```

---

### macOS 启动

#### 方法 A：Conda / Miniforge 环境（推荐）

如果你使用 Conda 或 Miniforge 管理 Python 环境：

```bash
# 1. 确认使用的是 Conda Python（不是系统 Python）
which python
# 应该显示类似: /Users/xxx/miniforge3/bin/python

# 2. 安装依赖（如果未安装）
cd stock_analysis
pip install -r requirements.txt

# 3. 启动服务
cd ..  # 回到项目根目录
python start_dashboard.py
```

#### 方法 B：Homebrew Python3

如果你使用 Homebrew 安装的 Python3：

```bash
# 1. 确认使用的是 Homebrew Python
which python3
# 应该显示类似: /opt/homebrew/bin/python3

# 2. 安装依赖
cd stock_analysis
pip3 install -r requirements.txt

# 3. 启动服务
cd ..
python3 start_dashboard.py
```

#### 方法 C：系统 Python（不推荐）

macOS 系统 Python 可能有权限限制：

```bash
# 使用 --user 安装到用户目录
cd stock_analysis
python3 -m pip install --user -r requirements.txt

# 启动
cd ..
python3 start_dashboard.py
```

---

### Windows 启动

#### 方法 A：命令提示符 (CMD)

```cmd
:: 1. 打开命令提示符，进入项目目录
cd C:\path\to\Cupk_Vest

:: 2. 确认 Python 路径
where python
:: 应该显示 Python 安装路径

:: 3. 安装依赖
cd stock_analysis
pip install -r requirements.txt

:: 4. 启动服务
cd ..
python start_dashboard.py
```

#### 方法 B：PowerShell

```powershell
# 1. 进入项目目录
cd C:\path\to\Cupk_Vest

# 2. 确认 Python
Get-Command python

# 3. 安装依赖
cd stock_analysis
pip install -r requirements.txt

# 4. 启动
cd ..
python start_dashboard.py
```

#### 方法 C：Anaconda Prompt（推荐）

如果使用 Anaconda：

```bash
# 1. 激活环境（可选）
conda activate base  # 或你的自定义环境

# 2. 进入目录
cd C:\path\to\Cupk_Vest

# 3. 安装依赖
cd stock_analysis
pip install -r requirements.txt

# 4. 启动
cd ..
python start_dashboard.py
```

#### Windows 特别说明

1. **不要使用** `python3` 命令，Windows 上应使用 `python`
2. 如果出现 **"'python' 不是内部或外部命令"**，需要将 Python 添加到系统 PATH
3. 推荐使用 **Anaconda/Miniconda** 管理环境

---

### Linux 启动

#### Ubuntu / Debian

```bash
# 1. 安装 Python 和 pip（如果未安装）
sudo apt update
sudo apt install python3 python3-pip python3-venv

# 2. 安装 Node.js（如果未安装）
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install nodejs

# 3. 进入项目目录
cd /path/to/Cupk_Vest

# 4. 安装 Python 依赖
cd stock_analysis
pip3 install -r requirements.txt

# 5. 安装前端依赖
cd ../web_dashboard
npm install

# 6. 启动服务
cd ..
python3 start_dashboard.py
```

#### CentOS / RHEL

```bash
# 使用 yum 或 dnf 安装依赖
sudo yum install python3 python3-pip nodejs npm

# 后续步骤同上
```

---

## 常见问题排查

### ❌ 问题 1：No module named 'akshare'

**原因**：依赖安装在了其他 Python 环境中

**解决方案**：

```bash
# 1. 检查当前使用的 Python
which python   # macOS/Linux
where python   # Windows

# 2. 检查依赖是否安装
python -c "import akshare; print('OK')"

# 3. 如果报错，重新安装依赖
cd stock_analysis
pip install -r requirements.txt
```

**macOS 特别注意**：
- `python` 命令可能指向 Conda/Miniforge
- `python3` 命令可能指向 Homebrew 或系统 Python
- 确保启动和安装使用**同一个 Python**

---

### ❌ 问题 2：Analysis failed（分析失败）

**可能原因**：
1. Python 环境问题
2. 网络连接问题（akshare 需要联网）
3. 股票代码错误

**解决方案**：

```bash
# 1. 运行诊断工具
python diagnose.py

# 2. 手动测试分析脚本
cd stock_analysis
python stock_analysis_v2.py 600519 stock

# 3. 检查网络连接
python -c "import akshare as ak; print(ak.stock_zh_a_spot_em().head())"
```

---

### ❌ 问题 3：中文乱码 / 字体问题

**Windows 解决方案**：
系统已自动配置 SimHei 字体，如果仍有问题：
```bash
# 检查系统字体
python -c "import matplotlib.font_manager as fm; print([f.name for f in fm.fontManager.ttflist if 'Hei' in f.name or 'hei' in f.name])"
```

**macOS 解决方案**：
系统已自动配置 Arial Unicode MS，如果仍有问题：
```bash
# 检查系统字体
python -c "import matplotlib.font_manager as fm; print([f.name for f in fm.fontManager.ttflist if 'Arial' in f.name])"
```

---

### ❌ 问题 4：端口被占用

**错误信息**：`Address already in use`

**解决方案**：

```bash
# macOS/Linux: 查找并关闭占用端口的进程
lsof -i :5001
kill -9 <PID>

lsof -i :5173
kill -9 <PID>

# Windows: 查找并关闭占用端口的进程
netstat -ano | findstr :5001
taskkill /PID <PID> /F

netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

---

### ❌ 问题 5：前端依赖安装失败

**解决方案**：

```bash
# 清除缓存重新安装
cd web_dashboard
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```

---

## 项目结构

```
Cupk_Vest/
├── start_dashboard.py          # 🚀 一键启动脚本
├── diagnose.py                 # 🔧 环境诊断工具
├── README.md                   # 📖 本文档
├── TODO.md                     # 📝 开发计划
├── WINDOWS_FIX.md              # 🪟 Windows 问题修复指南
│
├── stock_analysis/             # 📊 Python 分析模块
│   ├── server.py               # Flask API 服务器
│   ├── stock_analysis_v2.py    # 主分析脚本
│   ├── analysis.py             # 分析逻辑
│   ├── data_fetcher.py         # 数据获取
│   ├── config.py               # 配置（含跨平台字体）
│   ├── industry_compare.py     # 行业对比
│   ├── requirements.txt        # Python 依赖
│   └── 分析报告_*/             # 生成的分析报告
│
├── web_dashboard/              # ⚛️ React 前端
│   ├── package.json            # Node.js 依赖
│   ├── vite.config.js          # Vite 构建配置
│   ├── index.html              # HTML 入口
│   └── src/
│       ├── App.jsx             # 主应用组件
│       ├── App.css             # 样式
│       ├── geek.css            # 极客风格样式
│       ├── components/         # React 组件
│       ├── hooks/              # 自定义 Hooks
│       └── utils/              # 工具函数
│
└── akshare+backtrader回测框架/  # 📈 回测策略示例
    ├── Single Moving Average.py
    ├── Double Moving Average.py
    └── Three moving averages.py
```

---

## 功能特性

### 📈 A股深度分析

分析引擎生成 **20+ 种专业图表**，按类别组织：

| 分类 | 图表编号 | 包含内容 |
|------|----------|----------|
| **核心概览** | 0_, D1-D3 | 增量分析、基本面Dashboard、估值Dashboard、费用Dashboard |
| **趋势分析** | 00-03, 05, 06, 08 | 营收利润滚动、现金流滚动、市值营收滚动、研发投入、利润率结构、营运资本 |
| **估值分析** | 04, 11, 12, 13, 21 | 估值分析、DCF估值、DDM估值、历史估值通道 |
| **财务分析** | 07, 09, 14-18, 20, F5-F6 | EVA与FCF、ROE杜邦分析、股息率/费用走势、财务状况、运营效率、现金流结构 |
| **技术分析** | 10, 99 | 技术指标（MA/MACD/RSI/布林带）、回测结果 |

### 📊 核心指标覆盖

- **盈利能力**：ROE、毛利率、净利率、ROIC
- **成长性**：营收增速、净利润增速、研发投入占比
- **安全性**：负债率、流动比率、速动比率
- **估值体系**：PE/PB、DCF内在价值、DDM股息折现（Gordon/两阶段）
- **现金流质量**：经营现金流/净利润、自由现金流、EVA经济增加值

### 🤖 AI 量化评分系统

系统自动生成 **0-100 综合投资评分**，包含五大维度：
- 成长性评分（营收利润增速）
- 盈利能力评分（ROE/利润率）
- 稳定性评分（业绩波动）
- 安全性评分（负债/现金流）
- 估值评分（PE/PB/DCF对比）

### 💹 期货分析

支持主要期货品种技术分析：
- 黄金 (AU)、白银 (AG)
- 螺纹钢 (RB)、铁矿石 (I)
- 原油 (SC)、铜 (CU)

### 📈 技术分析指标
- 多周期 K 线分析（日/周/月）
- MACD、RSI、KDJ、布林带等指标
- 成交量分析
- 移动平均线（MA5/10/20/60）

### 💰 资金流向
- 主力资金监控
- 散户资金监控
- 资金流入流出统计

### 🏭 行业对比
- 同行业股票对比
- 行业排名
- 相对强弱分析

### 📊 可视化图表
- K 线图
- 资金流向图
- 技术指标图
- 行业对比图

### 🎨 界面风格
- Bloomberg 终端风格暗色主题
- TradingView 专业图表配色
- 响应式布局

---

## API 接口

### 获取报告列表
```
GET /api/reports
```

### 获取单个报告
```
GET /api/reports/<report_name>
```

### 发起新分析
```
POST /api/analyze
Body: {
  "code": "600519",
  "market": "stock"
}
```

### 查询分析状态
```
GET /api/analyze/<task_id>
```

### 获取报告图片
```
GET /api/reports/<report_name>/images/<image_name>
```

---

## 📞 技术支持

如遇到问题：

1. 先运行诊断工具：`python diagnose.py`
2. 查看 [WINDOWS_FIX.md](WINDOWS_FIX.md) 获取 Windows 专项问题解决方案
3. 查看本文档的常见问题排查部分

---

## 📜 License

MIT License

---

## 🔧 技术实现细节

### 前端架构 (React + Vite)

```
web_dashboard/src/
├── App.jsx          # 主应用组件 (1100+ 行)
│   ├── App()        # 报告列表 + 路由
│   ├── ReportDetail()  # 报告详情 + 图表分类
│   ├── AnalyzerPanel() # 新建分析面板
│   └── SummarySection() # AI 摘要展示
├── App.css          # 主样式
├── geek.css         # Bloomberg 风格主题
└── index.css        # 全局样式
```

**图表分类过滤逻辑**：
```javascript
const categories = {
  overview: images.filter(i => i.includes('Dashboard') || i.includes('增量分析') || i.match(/\/0_/) || i.match(/\/D\d_/)),
  trend: images.filter(i => i.match(/\/(0[0-3]|05|06|08)_/) || i.includes('营收') || i.includes('滚动')),
  valuation: images.filter(i => i.match(/\/(04|11|12|13|21)_/) || i.includes('估值')),
  financials: images.filter(i => i.match(/\/(07|09|14|15|16|17|18|20)_/) || i.match(/\/F\d_/) || i.includes('EVA')),
  technicals: images.filter(i => i.includes('技术') || i.includes('回测') || i.match(/\/(10|99)_/)),
  all: images
}
```

### 后端架构 (Flask)

```
stock_analysis/
├── server.py            # Flask API 服务器
│   ├── /api/reports     # 报告列表
│   ├── /api/analyze     # 发起分析（异步）
│   ├── /api/analyze/<id># 查询状态
│   └── /api/images/<path># 图片服务
├── stock_analysis_v2.py # 主分析引擎 (6000+ 行)
│   ├── 数据获取模块     # akshare 并行获取
│   ├── 财务分析模块     # 杜邦分析、现金流
│   ├── 估值模块        # DCF/DDM/PE/PB
│   ├── 技术分析模块     # MA/MACD/RSI/布林带
│   └── 可视化模块       # matplotlib 图表生成
└── config.py            # 跨平台配置（字体等）
```

### 跨平台兼容性

| 问题 | 解决方案 |
|------|----------|
| Windows 编码 | `sys.stdout = TextIOWrapper(..., encoding='utf-8', errors='replace')` |
| 中文字体 | macOS: Arial Unicode MS / Heiti; Windows: SimHei; Linux: Noto Sans CJK |
| 子进程执行 | 使用 `sys.executable` 确保使用正确的 Python 解释器 |
| GUI 后端 | `matplotlib.use('Agg')` 无头模式渲染 |

### 性能优化

- **并行数据获取**：使用 ThreadPoolExecutor 并发请求 akshare API
- **增量分析**：只重新生成变化的图表
- **图片懒加载**：前端按需加载可视区域图片
- **缓存机制**：报告数据 JSON 缓存避免重复计算

---

## 🙏 致谢

- [akshare](https://github.com/akfamily/akshare) - 优秀的 A股数据接口
- [backtrader](https://github.com/mementum/backtrader) - 强大的回测框架
- [Recharts](https://recharts.org/) - React 图表库
- [Lucide Icons](https://lucide.dev/) - 精美图标库
