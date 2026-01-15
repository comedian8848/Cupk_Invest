#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
诊断脚本 - 检查Windows/Mac/Linux上的环境配置
用于排查"网页端新建分析"错误
"""

import sys
import os
import platform

print("="*60)
print("  BlackOil 环境诊断工具")
print("="*60)

# 1. 检查Python版本
print("\n[1] Python版本")
print(f"   版本: {sys.version}")
print(f"   路径: {sys.executable}")
if sys.version_info < (3, 8):
    print("   ⚠️  建议升级到 Python 3.8+")
else:
    print("   ✅ 版本满足要求")

# 2. 检查操作系统
print("\n[2] 操作系统")
system = platform.system()
print(f"   OS: {system} {platform.release()}")
print(f"   机器: {platform.machine()}")

# 3. 检查关键依赖
print("\n[3] 关键依赖库")
dependencies = {
    'akshare': 'A股数据获取',
    'backtrader': '量化回测',
    'pandas': '数据处理',
    'matplotlib': '绘图',
    'flask': 'Web服务器',
    'flask_cors': 'CORS支持',
    'axios': 'HTTP请求',
    'react': 'React框架'
}

for package, description in dependencies.items():
    try:
        __import__(package)
        print(f"   ✅ {package}: 已安装 ({description})")
    except ImportError:
        print(f"   ❌ {package}: 未安装 ({description})")

# 4. 检查字体配置
print("\n[4] Matplotlib字体")
try:
    import matplotlib.font_manager as fm
    available_fonts = {f.name for f in fm.fontManager.ttflist}
    
    fonts_to_check = {
        'Arial Unicode MS': 'macOS',
        'SimHei': 'Windows',
        'WenQuanYi Micro Hei': 'Linux',
        'DejaVu Sans': '备选'
    }
    
    for font, platform_name in fonts_to_check.items():
        if font in available_fonts:
            status = "✅"
        else:
            status = "❌"
        print(f"   {status} {font} ({platform_name})")
    
    if system == 'Darwin' and 'Arial Unicode MS' in available_fonts:
        print(f"   ✅ macOS: 使用 Arial Unicode MS")
    elif system == 'Windows' and 'SimHei' in available_fonts:
        print(f"   ✅ Windows: 使用 SimHei")
    elif system == 'Linux' and 'WenQuanYi Micro Hei' in available_fonts:
        print(f"   ✅ Linux: 使用 WenQuanYi Micro Hei")
    else:
        print(f"   ⚠️  未找到推荐字体，将使用系统默认字体")
        
except Exception as e:
    print(f"   ❌ 字体检查失败: {e}")

# 5. 检查文件结构
print("\n[5] 项目文件结构")
required_files = {
    'stock_analysis/stock_analysis_v2.py': '分析引擎',
    'stock_analysis/server.py': 'Flask后端',
    'stock_analysis/config.py': '配置文件',
    'web_dashboard/src/App.jsx': 'React前端',
    'start_dashboard.py': '启动脚本'
}

script_dir = os.path.dirname(os.path.abspath(__file__))
for file_path, description in required_files.items():
    full_path = os.path.join(script_dir, file_path)
    if os.path.exists(full_path):
        print(f"   ✅ {file_path}: 存在 ({description})")
    else:
        print(f"   ❌ {file_path}: 不存在 ({description})")

# 6. 检查端口
print("\n[6] 端口检查")
import socket
ports_to_check = {
    5001: 'Flask后端',
    5173: 'Vite前端'
}

for port, service in ports_to_check.items():
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        result = sock.connect_ex(('localhost', port))
        sock.close()
        if result == 0:
            print(f"   ⚠️  端口 {port} ({service}): 已被占用")
        else:
            print(f"   ✅ 端口 {port} ({service}): 可用")
    except Exception as e:
        print(f"   ⚠️  端口 {port} 检查失败: {e}")

# 7. 建议
print("\n[7] 诊断建议")
if system == 'Windows':
    print("   Windows系统诊断:")
    print("   • 如果字体显示❌, 运行: pip install matplotlib")
    print("   • 确保所有库都是最新版本: pip install --upgrade -r stock_analysis/requirements.txt")
    print("   • 使用命令行测试分析: python stock_analysis/stock_analysis_v2.py 600519")
elif system == 'Darwin':
    print("   macOS系统诊断:")
    print("   • 如果字体显示❌, 运行: pip install matplotlib")
    print("   • 确保所有库都是最新版本: pip install --upgrade -r stock_analysis/requirements.txt")
elif system == 'Linux':
    print("   Linux系统诊断:")
    print("   • 如果字体显示❌, 运行: pip install matplotlib")
    print("   • 如果仍然缺少中文字体, 运行: apt-get install fonts-wqy-microhei")
    print("   • 确保所有库都是最新版本: pip install --upgrade -r stock_analysis/requirements.txt")

print("\n" + "="*60)
print("诊断完成！如有问题，请查看WINDOWS_FIX.md获取更多帮助")
print("="*60 + "\n")
