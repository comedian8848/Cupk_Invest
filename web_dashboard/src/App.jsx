import { useState, useEffect, useCallback, useMemo, useRef, memo } from 'react'
import axios from 'axios'
import { BarChart3, Activity, DollarSign, TrendingUp, FileText, Image as ImageIcon, ArrowLeft, RefreshCw, Cpu, Box, Layers, AlertTriangle, Play, Loader, CheckCircle, XCircle, LayoutGrid, Maximize2, LineChart, PieChart, BarChart2, TrendingDown, AlertCircle, MousePointer2, Bot, Settings, Sun, Moon } from 'lucide-react'
import { LineChart as ReLineChart, Line, BarChart as ReBarChart, Bar, PieChart as RePieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart, ComposedChart } from 'recharts'
import InteractiveStockChart from './components/InteractiveStockChart'
import AnalysisRadar from './components/AnalysisRadar'
import IndustryPeersTable from './components/IndustryPeersTable'
import IndustryComparison from './components/IndustryComparison'
import AIReport from './components/AIReport'
import { fetchReports as apiFetchReports, fetchReportDetails as apiFetchReportDetails, fetchReportSummary as apiFetchReportSummary, startAnalysis as apiStartAnalysis, getAnalysisStatus as apiGetAnalysisStatus, deleteReport as apiDeleteReport } from './api'

// ==================== 性能优化工具 ====================
// 配置 axios 默认超时和重试
axios.defaults.timeout = 30000

// 简单的内存缓存
const cache = new Map()
const CACHE_TTL = 60000 // 1分钟缓存

const getCached = (key) => {
  const item = cache.get(key)
  if (item && Date.now() - item.time < CACHE_TTL) {
    return item.data
  }
  cache.delete(key)
  return null
}

const setCache = (key, data) => {
  cache.set(key, { data, time: Date.now() })
}

// 防抖 hook
const useDebounce = (value, delay = 300) => {
  const [debouncedValue, setDebouncedValue] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debouncedValue
}

// 安全的数值格式化
const safeNumber = (val, decimals = 2) => {
  const num = Number(val)
  return isNaN(num) ? null : num.toFixed(decimals)
}

const safePercent = (val, decimals = 2) => {
  const num = Number(val)
  return isNaN(num) ? null : `${num.toFixed(decimals)}%`
}

function App() {
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAnalyzer, setShowAnalyzer] = useState(false)
  const [theme, setTheme] = useState('light')
  const [quickUpdate, setQuickUpdate] = useState({ running: false, message: '' })
  const [showSettings, setShowSettings] = useState(false)
  const [aiSettings, setAiSettings] = useState({
    apiKey: '',
    baseUrl: 'https://api.minimaxi.com/anthropic',
    model: 'MiniMax-M2.1',
    timeoutMs: 60000,
    proxy: ''
  })
  const abortControllerRef = useRef(null)

  useEffect(() => {
    fetchReports()
    try {
      const savedTheme = localStorage.getItem('theme')
      if (savedTheme) {
        setTheme(savedTheme)
        document.documentElement.dataset.theme = savedTheme
      } else {
        document.documentElement.dataset.theme = 'light'
      }
    } catch (e) {
      document.documentElement.dataset.theme = 'light'
    }
    try {
      const raw = localStorage.getItem('ai_settings')
      if (raw) {
        const parsed = JSON.parse(raw)
        const proxyValue = typeof parsed.PROXY === 'string'
          ? parsed.PROXY
          : (parsed.PROXY?.http || parsed.PROXY?.https || '')
        setAiSettings({
          apiKey: parsed.API_KEY || '',
          baseUrl: parsed.BASE_URL || 'https://api.minimaxi.com/anthropic',
          model: parsed.MODEL || 'MiniMax-M2.1',
          timeoutMs: parsed.TIMEOUT || 60000,
          proxy: proxyValue
        })
      }
    } catch (e) {
      // ignore
    }
    return () => {
      // 组件卸载时取消pending请求
      abortControllerRef.current?.abort()
    }
  }, [])

  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.dataset.theme = next
    localStorage.setItem('theme', next)
  }, [theme])

  const saveAiSettings = useCallback(() => {
    const payload = {
      API_KEY: aiSettings.apiKey?.trim(),
      BASE_URL: aiSettings.baseUrl?.trim(),
      MODEL: aiSettings.model?.trim(),
      TIMEOUT: Number(aiSettings.timeoutMs) || 60000,
      PROXY: aiSettings.proxy?.trim() || null
    }
    localStorage.setItem('ai_settings', JSON.stringify(payload))
    setShowSettings(false)
  }, [aiSettings])

  const fetchReports = useCallback(async (forceRefresh = false) => {
    // 检查缓存
    if (!forceRefresh) {
      const cached = getCached('reports')
      if (cached) {
        setReports(cached)
        return
      }
    }
    
    setLoading(true)
    setError(null)
    
    // 取消之前的请求
    abortControllerRef.current?.abort()
    abortControllerRef.current = new AbortController()
    
    try {
      const res = await apiFetchReports({
        signal: abortControllerRef.current.signal
      })
      const data = Array.isArray(res.data) ? res.data : []
      setReports(data)
      setCache('reports', data)
    } catch (err) {
      if (axios.isCancel(err)) return
      console.error('fetchReports error:', err)
      const errMsg = err.response?.data?.error || err.message || '未知错误'
      setError(`无法连接到服务器: ${errMsg}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadReportDetails = useCallback(async (report) => {
    if (!report?.id) return
    
    // 检查缓存
    const cacheKey = `report_${report.id}`
    const cached = getCached(cacheKey)
    if (cached) {
      setSelectedReport(cached)
      setShowAnalyzer(false)
      return
    }
    
    setLoading(true)
    try {
      const [detailsRes, summaryRes] = await Promise.all([
        apiFetchReportDetails(report.id),
        report.type === 'stock' 
          ? apiFetchReportSummary(report.id).catch(() => ({data: null})) 
          : Promise.resolve({data: null})
      ])
      
      const fullReport = {
        ...report,
        ...detailsRes.data,
        summaryData: summaryRes.data
      }
      
      setSelectedReport(fullReport)
      setCache(cacheKey, fullReport)
      setShowAnalyzer(false)
    } catch (err) {
      console.error('loadReportDetails error:', err)
      setError(`加载报告失败: ${err.response?.data?.error || err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  const handleAnalysisComplete = useCallback((code) => {
    // 清除缓存以获取最新数据
    cache.clear()
    fetchReports(true)
    
    // 延迟查找新报告
    setTimeout(() => {
      fetchReports(true).then(() => {
        // 报告列表已更新，查找匹配的报告
      })
    }, 1500)
  }, [fetchReports])

  const runLatestAnalysis = useCallback(async (code) => {
    if (!code || quickUpdate.running) return
    setQuickUpdate({ running: true, message: '正在启动分析...' })
    try {
      const res = await apiStartAnalysis(code)
      const taskId = res.data?.task_id
      if (!taskId) throw new Error('任务创建失败')

      let done = false
      while (!done) {
        await new Promise((r) => setTimeout(r, 1500))
        const statusRes = await apiGetAnalysisStatus(taskId, { timeout: 10000 })
        const status = statusRes.data
        setQuickUpdate({ running: true, message: status?.message || '分析中...' })

        if (status?.status === 'completed') {
          done = true
          cache.clear()
          const listRes = await apiFetchReports()
          const list = Array.isArray(listRes.data) ? listRes.data : []
          const latest = list.find((r) => r.code === code)
          if (latest) {
            loadReportDetails(latest)
          } else {
            fetchReports(true)
          }
        } else if (status?.status === 'error') {
          done = true
          throw new Error(status?.message || '分析失败')
        }
      }
    } catch (err) {
      setError(`更新分析失败: ${err.message}`)
    } finally {
      setQuickUpdate({ running: false, message: '' })
    }
  }, [fetchReports, loadReportDetails, quickUpdate.running])

  return (
    <div className="geek-container">
      {/* Header */}
      <header className="geek-header">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center" style={{width: 36, height: 36, background: 'linear-gradient(135deg, var(--accent-primary), var(--color-up))', borderRadius: 'var(--radius-md)'}}>
            <BarChart3 size={20} color="white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-primary">BlackOil</h1>
            <div className="text-xs text-muted">专业金融分析平台</div>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => {
              setShowAnalyzer(!showAnalyzer)
              setSelectedReport(null)
            }} 
            className="geek-btn"
            style={showAnalyzer ? {background: 'var(--color-success)'} : {}}
          >
            <Play size={14} />
            <span>新建分析</span>
          </button>
          <button onClick={() => setShowSettings(true)} className="geek-btn" style={{background: 'var(--bg-tertiary)'}}>
            <Settings size={14} />
            <span className="md:hidden">设置</span>
          </button>
          <button onClick={toggleTheme} className="geek-btn" style={{background: 'var(--bg-tertiary)'}}>
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
            <span className="md:hidden">{theme === 'light' ? '暗色' : '亮色'}</span>
          </button>
          <button onClick={fetchReports} className="geek-btn" disabled={loading} style={{background: 'var(--bg-tertiary)'}}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span className="md:hidden">刷新</span>
          </button>
        </div>
      </header>

      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">AI 设置</div>
              <button className="modal-close" onClick={() => setShowSettings(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <label>API Key</label>
                <input
                  type="password"
                  value={aiSettings.apiKey}
                  onChange={(e) => setAiSettings(s => ({ ...s, apiKey: e.target.value }))}
                  placeholder="ANTHROPIC_API_KEY"
                />
              </div>
              <div className="form-row">
                <label>Base URL</label>
                <input
                  type="text"
                  value={aiSettings.baseUrl}
                  onChange={(e) => setAiSettings(s => ({ ...s, baseUrl: e.target.value }))}
                  placeholder="https://api.minimaxi.com/anthropic"
                />
              </div>
              <div className="form-row">
                <label>Model</label>
                <input
                  type="text"
                  value={aiSettings.model}
                  onChange={(e) => setAiSettings(s => ({ ...s, model: e.target.value }))}
                  placeholder="MiniMax-M2.1"
                />
              </div>
              <div className="form-row">
                <label>Timeout (ms)</label>
                <input
                  type="number"
                  value={aiSettings.timeoutMs}
                  onChange={(e) => setAiSettings(s => ({ ...s, timeoutMs: e.target.value }))}
                  placeholder="60000"
                />
              </div>
              <div className="form-row">
                <label>Proxy (可选)</label>
                <input
                  type="text"
                  value={aiSettings.proxy}
                  onChange={(e) => setAiSettings(s => ({ ...s, proxy: e.target.value }))}
                  placeholder="http://127.0.0.1:7897"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="geek-btn" style={{background: 'var(--bg-tertiary)'}} onClick={() => setShowSettings(false)}>取消</button>
              <button className="geek-btn" onClick={saveAiSettings}>保存</button>
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="alert alert-error mb-4">
          <AlertTriangle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Main Content */}
      <main>
        {showAnalyzer ? (
          <StockAnalyzer onComplete={handleAnalysisComplete} onBack={() => setShowAnalyzer(false)} />
        ) : selectedReport ? (
          <ReportDetail 
            report={selectedReport} 
            onBack={() => setSelectedReport(null)} 
            theme={theme}
            onDelete={async (report) => {
              if (!report?.id) return
              if (!window.confirm('确认删除该分析报告？此操作不可恢复。')) return
              try {
                await apiDeleteReport(report.id)
                cache.clear()
                setSelectedReport(null)
                fetchReports(true)
              } catch (err) {
                setError(`删除失败: ${err.response?.data?.error || err.message}`)
              }
            }}
            onUpdateLatest={(report) => runLatestAnalysis(report?.code)}
            quickUpdate={quickUpdate}
          />
        ) : (
          <div className="animate-in">
            {/* Report Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {reports.map((report) => (
                <div 
                  key={report.id} 
                  onClick={() => loadReportDetails(report)}
                  className="geek-card"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div 
                      className="flex items-center justify-center"
                      style={{
                        width: 32, 
                        height: 32, 
                        borderRadius: 'var(--radius-md)',
                        background: report.type === 'stock' ? 'rgba(41, 98, 255, 0.15)' : 'rgba(255, 152, 0, 0.15)'
                      }}
                    >
                      {report.type === 'stock' 
                        ? <Activity size={16} style={{color: 'var(--accent-primary)'}} /> 
                        : <Layers size={16} style={{color: 'var(--color-warning)'}} />
                      }
                    </div>
                    <span className="text-xs text-muted">
                      {report.type === 'stock' ? '股票' : '期货'}
                    </span>
                  </div>
                  
                  <h3 className="text-xl font-bold text-primary mb-1">{report.code}</h3>
                  {report.name && <div className="text-xs text-muted mb-1">{report.name}</div>}
                  <div className="text-sm text-secondary">{report.date}</div>
                </div>
              ))}
            </div>
            
            {/* Empty State */}
            {reports.length === 0 && !loading && !error && (
              <div className="empty-state">
                <Box size={48} />
                <div className="text-lg font-medium">暂无分析报告</div>
                <div className="text-sm">点击「新建分析」生成第一份报告</div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

function StockAnalyzer({ onComplete, onBack }) {
  const [code, setCode] = useState('')
  const [taskId, setTaskId] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [showErrorDetails, setShowErrorDetails] = useState(false)
  const intervalRef = useRef(null)
  const retryCountRef = useRef(0)
  const MAX_RETRIES = 3

  // 清理轮询
  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  const startAnalysis = useCallback(async () => {
    const trimmedCode = code.trim()
    if (!trimmedCode) {
      setError('请输入股票代码')
      return
    }

    // 基本验证
    if (trimmedCode.length < 1 || trimmedCode.length > 10) {
      setError('代码长度应为 1-10 位')
      return
    }

    setError(null)
    setShowErrorDetails(false)
    retryCountRef.current = 0
    
    try {
      const res = await apiStartAnalysis(trimmedCode)
      if (res.data?.task_id) {
        setTaskId(res.data.task_id)
        pollStatus(res.data.task_id)
      } else {
        setError('服务器响应异常')
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || err.message || '启动分析失败'
      setError(errMsg)
    }
  }, [code])

  const pollStatus = useCallback((id) => {
    // 清除之前的轮询
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    
    const poll = async () => {
      try {
        const res = await apiGetAnalysisStatus(id, { timeout: 10000 })
        setStatus(res.data)
        retryCountRef.current = 0  // 重置重试计数

        if (res.data.status === 'completed') {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          setTimeout(() => {
            onComplete(res.data.code)
          }, 1000)
        } else if (res.data.status === 'error') {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          setError(res.data.message)
          setShowErrorDetails(true)
        }
      } catch (err) {
        retryCountRef.current++
        console.warn(`Poll attempt ${retryCountRef.current} failed:`, err.message)
        
        if (retryCountRef.current >= MAX_RETRIES) {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          setError(`获取状态失败 (${err.message})`)
        }
        // 否则继续轮询，等待下次尝试
      }
    }
    
    // 立即执行一次
    poll()
    // 然后每 2 秒轮询
    intervalRef.current = setInterval(poll, 2000)
  }, [onComplete])

  return (
    <div className="animate-in" style={{maxWidth: 520, margin: '0 auto'}}>
      <button onClick={onBack} className="geek-btn mb-4" style={{background: 'var(--bg-tertiary)'}}>
        <ArrowLeft size={14} />
        <span>返回</span>
      </button>

      <div className="info-panel">
        <h2 className="text-xl font-bold text-primary mb-6 flex items-center gap-2">
          <Play size={20} style={{color: 'var(--accent-primary)'}} />
          新建股票分析
        </h2>
        
        {!taskId ? (
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm text-secondary mb-2" style={{display: 'block'}}>股票/期货代码</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && startAnalysis()}
                placeholder="如：600519、RB、螺纹钢"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '14px'
                }}
              />
            </div>

            {error && (
              <div className="alert alert-error">
                <XCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <button onClick={startAnalysis} className="geek-btn w-full" style={{padding: '12px', fontSize: '15px'}}>
              <Play size={16} />
              <span>开始分析</span>
            </button>

            <div className="text-sm text-muted" style={{borderTop: '1px solid var(--border-color)', paddingTop: '16px'}}>
              <p style={{marginBottom: '4px'}}>• 支持 A 股（6位代码）和期货品种</p>
              <p style={{marginBottom: '4px'}}>• 分析耗时约 1-3 分钟</p>
              <p>• 将生成 20+ 张专业图表</p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              {status?.status === 'running' && <Loader size={22} className="animate-spin" style={{color: 'var(--accent-primary)'}} />}
              {status?.status === 'completed' && <CheckCircle size={22} style={{color: 'var(--color-success)'}} />}
              {status?.status === 'error' && <XCircle size={22} style={{color: 'var(--color-down)'}} />}
              
              <div style={{flex: 1}}>
                <div className="text-xs text-muted mb-1">状态</div>
                <div className="text-base font-semibold text-primary">
                  {status?.message || '初始化中...'}
                </div>
              </div>
            </div>

            {status?.status === 'running' && (
              <div>
                <div className="progress-bar mb-2">
                  <div 
                    className="progress-bar-fill"
                    style={{ width: `${status.progress || 5}%` }}
                  />
                </div>
                <div className="text-xs text-muted" style={{textAlign: 'right'}}>
                  {status.progress || 0}%
                </div>
              </div>
            )}

            {error && (
              <div className="alert alert-error">
                <XCircle size={16} />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ReportDetail({ report, onBack, onDelete, onUpdateLatest, quickUpdate, theme }) {
  const [activeTab, setActiveTab] = useState('overview')
  const [industryBaseline, setIndustryBaseline] = useState('mean')
  const [lightboxIndex, setLightboxIndex] = useState(null)
  
  const images = report.images || []
  const categories = {
    // 核心概览: Dashboard、增量分析、概览
    overview: images.filter(i => i.includes('Dashboard') || i.includes('增量分析') || i.includes('概览') || i.match(/\/0_/) || i.match(/\/D\d_/)),
    // 趋势: 营收、现金流、市值、研发、利润率、营运资本 (00-03, 05, 06, 08)
    trend: images.filter(i => i.match(/\/(0[0-3]|05|06|08)_/) || i.includes('营收') || i.includes('滚动') || i.includes('走势')),
    // 估值: 估值分析、DCF、DDM、历史估值 (04, 11, 12, 13, 21)
    valuation: images.filter(i => i.match(/\/(04|11|12|13|21)_/) || i.includes('估值') || i.includes('DCF') || i.includes('DDM')),
    // 财务: EVA、ROE、财务费用、销售费用、财务状况、现金流结构 (07, 09, 14-18, 20, F开头)
    financials: images.filter(i => i.includes('财务') || i.match(/\/(07|09|14|15|16|17|18|20)_/) || i.match(/\/F\d_/) || i.includes('EVA') || i.includes('ROE') || i.includes('杜邦')),
    // 技术: 技术指标、回测 (10, 99)
    technicals: images.filter(i => i.includes('技术') || i.includes('回测') || i.match(/\/(10|99)_/)),
    all: images
  }
  
  const currentImages = (report.type === 'stock' && categories[activeTab]?.length > 0) 
    ? categories[activeTab] 
    : (activeTab === 'all' ? images : [])
  const displayImages = currentImages.length > 0 ? currentImages : images

  const TABS = [
    { id: 'ai', label: 'AI分析', icon: <Bot size={14} /> },
    { id: 'overview', label: '核心摘要', icon: <AlertCircle size={14} /> },
    { id: 'interactive', label: '交互分析', icon: <MousePointer2 size={14} /> },
    { id: 'charts', label: '数据图表', icon: <LineChart size={14} /> },
    { id: 'trend', label: '趋势', icon: <TrendingUp size={14} /> },
    { id: 'valuation', label: '估值', icon: <DollarSign size={14} /> },
    { id: 'financials', label: '财务', icon: <FileText size={14} /> },
    { id: 'technicals', label: '技术', icon: <Cpu size={14} /> },
    { id: 'all', label: '全部', icon: <LayoutGrid size={14} /> },
  ]

  const summary = report.summaryData || {}
  const fullData = summary.full_data || {}
  const growthMomentum = fullData.growth_momentum || {}
  const rawComp = fullData.industry_comparison
  const peerList = useMemo(() => {
    if (rawComp && rawComp.peers) return rawComp.peers
    if (Array.isArray(rawComp)) return rawComp
    return []
  }, [rawComp])
  
  // Helper to prepare industry comparison data
  const currentStockData = useMemo(() => ({
    roe: summary.roe,
    gross_margin: summary.gross_margin,
    net_margin: summary.net_margin,
    debt_ratio: summary.debt_ratio,
    pe_ttm: summary.pe_ttm,
    pb: summary.pb,
    dividend_yield: summary.dividend_yield
  }), [summary])

  const baselineOptions = useMemo(() => {
    if (rawComp && rawComp.avg_data) {
      return [{ id: 'report_avg', label: '报告行业均值' }]
    }
    if (Array.isArray(rawComp)) {
      return [
        { id: 'mean', label: '行业均值' },
        { id: 'median', label: '行业中位数' },
        { id: 'trim', label: '剔除极端值' }
      ]
    }
    return []
  }, [rawComp])

  useEffect(() => {
    if (baselineOptions.length > 0 && !baselineOptions.find(o => o.id === industryBaseline)) {
      setIndustryBaseline(baselineOptions[0].id)
    }
  }, [baselineOptions, industryBaseline])

  const industryData = useMemo(() => {
    if (rawComp && rawComp.avg_data) {
      return industryBaseline === 'report_avg' ? rawComp.avg_data : rawComp.avg_data
    }
    if (!Array.isArray(rawComp) || rawComp.length === 0) return null

    const getValues = (key) => rawComp
      .map(item => item?.[key])
      .filter(val => typeof val === 'number' && val > 0)

    const calcMean = (vals) => vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null
    const calcMedian = (vals) => {
      if (!vals.length) return null
      const sorted = [...vals].sort((a, b) => a - b)
      const mid = Math.floor(sorted.length / 2)
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
    }
    const calcTrimmedMean = (vals, ratio = 0.1) => {
      if (!vals.length) return null
      const sorted = [...vals].sort((a, b) => a - b)
      const trim = Math.floor(sorted.length * ratio)
      const trimmed = sorted.slice(trim, sorted.length - trim)
      const finalVals = trimmed.length ? trimmed : sorted
      return calcMean(finalVals)
    }

    const calcByMode = (vals, mode) => {
      if (mode === 'median') return calcMedian(vals)
      if (mode === 'trim') return calcTrimmedMean(vals)
      return calcMean(vals)
    }

    const mode = industryBaseline
    const pes = getValues('pe')
    const pbs = getValues('pb')

    return {
      pe_ttm: calcByMode(pes, mode),
      pb: calcByMode(pbs, mode),
      roe: null,
      gross_margin: null,
      net_margin: null,
      debt_ratio: null,
      dividend_yield: null
    }
  }, [rawComp, industryBaseline])

  const expectation = growthMomentum?.expectation || '未知'
  const growthSummary = growthMomentum?.summary || '暂无'
  const growthQuality = growthMomentum?.growth_quality || '暂无'
  const qualityScore = growthMomentum?.quality_score
  const qualityNotes = Array.isArray(growthMomentum?.quality_notes) ? growthMomentum.quality_notes : []
  const signals = growthMomentum?.signals || {}
  const positiveSignals = Array.isArray(signals.positive) ? signals.positive : []
  const negativeSignals = Array.isArray(signals.negative) ? signals.negative : []
  const expectationMeta = (() => {
    if (expectation === '积极') return { cls: 'positive', label: '🟢 积极' }
    if (expectation === '中性') return { cls: 'neutral', label: '🟡 中性' }
    if (expectation === '谨慎') return { cls: 'negative', label: '🔴 谨慎' }
    return { cls: 'muted', label: '—' }
  })()

  const stockData = currentStockData

  const openLightbox = useCallback((idx) => {
    if (!displayImages.length) return
    setLightboxIndex(idx)
  }, [displayImages.length])

  const closeLightbox = useCallback(() => setLightboxIndex(null), [])

  const showPrev = useCallback(() => {
    if (!displayImages.length) return
    setLightboxIndex((prev) => {
      if (prev === null) return 0
      return (prev - 1 + displayImages.length) % displayImages.length
    })
  }, [displayImages.length])

  const showNext = useCallback(() => {
    if (!displayImages.length) return
    setLightboxIndex((prev) => {
      if (prev === null) return 0
      return (prev + 1) % displayImages.length
    })
  }, [displayImages.length])

  useEffect(() => {
    if (lightboxIndex === null) return
    const handleKey = (e) => {
      if (e.key === 'Escape') closeLightbox()
      if (e.key === 'ArrowLeft') showPrev()
      if (e.key === 'ArrowRight') showNext()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [lightboxIndex, closeLightbox, showPrev, showNext])

  return (
    <div className="animate-in">
      {/* Back Button */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={onBack} className="geek-btn" style={{background: 'var(--bg-tertiary)'}}>
          <ArrowLeft size={14} />
          <span>返回列表</span>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onUpdateLatest?.(report)}
            className="geek-btn"
            style={{background: 'var(--accent-primary)'}}
            disabled={quickUpdate?.running}
            title="按最新时间重新分析"
          >
            <RefreshCw size={14} className={quickUpdate?.running ? 'animate-spin' : ''} />
            <span>更新分析</span>
          </button>
          <button
            onClick={() => onDelete?.(report)}
            className="geek-btn"
            style={{background: 'var(--bg-tertiary)'}}
          >
            <XCircle size={14} />
            <span>删除</span>
          </button>
        </div>
      </div>

      {quickUpdate?.running && (
        <div className="alert alert-info mb-4">
          <Loader size={16} className="animate-spin" />
          <span>{quickUpdate.message || '正在更新分析...'}</span>
        </div>
      )}
      
      {/* Header Panel */}
      <div className="info-panel mb-6">
        <div className="flex flex-col gap-4" style={{position: 'relative', zIndex: 1}}>
          {/* Top Row: Code and Type */}
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div className="text-xs text-accent mb-1">
                {report.type === 'stock' ? '股票代码' : '期货品种'}
              </div>
              <div>
                <h1 className="text-3xl font-bold text-primary">{report.code}</h1>
                {summary.stock_name && <div className="text-sm text-secondary mt-1">{summary.stock_name}</div>}
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <span 
                className="text-xs px-3 py-1 rounded"
                style={{
                  background: report.type === 'stock' ? 'rgba(41, 98, 255, 0.15)' : 'rgba(255, 152, 0, 0.15)',
                  color: report.type === 'stock' ? 'var(--accent-primary)' : 'var(--color-warning)'
                }}
              >
                {report.type === 'stock' ? '股票' : '期货'}
              </span>
              <span className="text-sm text-secondary">{report.date}</span>
            </div>
          </div>

          {/* Metrics Row */}
          {summary.stock_name && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
              <MetricBox label="行业" value={summary.industry || '-'} />
              <MetricBox label="总股本" value={summary.total_shares ? (summary.total_shares / 1e8).toFixed(2) + '亿' : '-'} />
              <MetricBox label="市值" value={summary.market_cap ? (summary.market_cap / 1e8).toFixed(2) + '亿' : '-'} highlight />
              <MetricBox label="PE(TTM)" value={summary.pe_ttm ? summary.pe_ttm.toFixed(2) : '-'} />
            </div>
          )}
          
          {/* Key Insights */}
          {summary && Object.keys(summary).length > 0 && (
            <div className="border-t" style={{borderColor: 'var(--border-color)', paddingTop: '16px', marginTop: '16px'}}>
              <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                <span style={{width: 4, height: 4, borderRadius: '50%', background: 'var(--accent-primary)'}}></span>
                关键指标
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {summary.roe && <KeyInsightItem label="ROE" value={summary.roe.toFixed(2) + '%'} />}
                {summary.gross_margin && <KeyInsightItem label="毛利率" value={summary.gross_margin.toFixed(2) + '%'} />}
                {summary.net_margin && <KeyInsightItem label="净利率" value={summary.net_margin.toFixed(2) + '%'} />}
                {summary.debt_ratio && <KeyInsightItem label="负债比" value={summary.debt_ratio.toFixed(2) + '%'} />}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      {report.type === 'stock' && (
        <div className="tabs-container">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`tab-button ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Content by Tab */}
      {activeTab === 'ai' && (
        <AIReport 
          reportId={report.id} 
          currentPrice={fullData.valuation?.price || 0}
        />
      )}

      {activeTab === 'overview' && (
        <>
          {fullData && Object.keys(fullData).length > 0 ? (
            <AnalysisInsights data={fullData} summary={summary} />
          ) : (
            <div className="info-panel mb-6 text-center py-8">
              <AlertCircle size={32} className="mx-auto mb-2 text-muted" />
              <p className="text-secondary">暂无核心分析数据</p>
              <p className="text-xs text-muted mt-1">可能是分析未完成或数据加载失败</p>
            </div>
          )}
          
          {/* 概览Dashboard图片 */}
          {(categories.overview.length > 0 || report.type === 'futures') && (
            <div className="mt-6">
              <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2 px-2">
                <ImageIcon size={18} style={{color: 'var(--accent-primary)'}} />
                {report.type === 'futures' ? '期货分析报告' : '核心Dashboard'}
              </h3>
              <div className="chart-grid">
                {report.type === 'futures' ? (
                  report.images.map((img, idx) => (
                    <ImageCard key={idx} src={img} fullWidth onOpen={() => openLightbox(idx)} />
                  ))
                ) : (
                  categories.overview.map((img, idx) => (
                    <ImageCard key={idx} src={img} onOpen={() => openLightbox(idx)} />
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === 'interactive' && (
        <div className="flex flex-col gap-6 mb-8">
          {fullData && Object.keys(fullData).length > 0 ? (
            <>
              {/* 1. 交互式K线图 */}
              <div className="info-panel">
                 <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2">
                    <Activity size={18} style={{color: 'var(--accent-primary)'}} />
                    交互式价格趋势 (Zoom/Pan)
                 </h3>
                 <div style={{ height: 500 }}>
                   <InteractiveStockChart data={fullData.kline_history} title={`${summary.stock_name} - 股价走势`} theme={theme} />
                 </div>
                 <div className="text-xs text-muted mt-2 text-center">
                   支持鼠标滚轮缩放、拖拽平移、框选放大
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 {/* 2. 能力雷达图 */}
                 <div className="info-panel">
                   <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2">
                      <Activity size={18} style={{color: 'var(--color-up)'}} />
                      五维能力雷达
                   </h3>
                   <div style={{ height: 350 }}>
                     <AnalysisRadar scores={fullData.scores} theme={theme} />
                   </div>
                   <div className="growth-eval-card" style={{ marginTop: 16 }}>
                     <div className="growth-eval-header">
                       <h3 className="text-base font-bold text-primary">增量评价</h3>
                       <span className={`growth-tag ${expectationMeta.cls}`}>{expectationMeta.label}</span>
                     </div>
                     <div className="growth-eval-grid">
                       <div className="growth-eval-item">
                         <span className="label">增长类型</span>
                         <span className="value">{growthSummary}</span>
                       </div>
                       <div className="growth-eval-item">
                         <span className="label">增长质量</span>
                         <span className="value">{growthQuality}</span>
                       </div>
                       <div className="growth-eval-item">
                         <span className="label">质量评分</span>
                         <span className="value">{qualityScore != null ? `${qualityScore}/80` : '—'}</span>
                       </div>
                     </div>
                     {qualityNotes.length > 0 && (
                       <div className="growth-note-row">
                         {qualityNotes.map((n, idx) => (
                           <span key={`${n}-${idx}`} className="growth-tag muted">{n}</span>
                         ))}
                       </div>
                     )}
                     {(positiveSignals.length > 0 || negativeSignals.length > 0) && (
                       <div className="growth-signal-grid">
                         <div className="growth-signal-block">
                           <div className="growth-signal-title">积极信号</div>
                           <ul>
                             {positiveSignals.length > 0 ? positiveSignals.map((s, i) => (
                               <li key={`p-${i}`}>+ {s}</li>
                             )) : <li className="muted">暂无</li>}
                           </ul>
                         </div>
                         <div className="growth-signal-block">
                           <div className="growth-signal-title">风险信号</div>
                           <ul>
                             {negativeSignals.length > 0 ? negativeSignals.map((s, i) => (
                               <li key={`n-${i}`}>- {s}</li>
                             )) : <li className="muted">暂无</li>}
                           </ul>
                         </div>
                       </div>
                     )}
                   </div>
                 </div>

                 {/* 3. 同业对比表格 */}
                 <div className="info-panel">
                   <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2">
                      <Layers size={18} style={{color: 'var(--color-warning)'}} />
                      同行业对比
                   </h3>
                   <IndustryComparison 
                      stockData={stockData} 
                      industryData={industryData}
                      peers={peerList}
                      stockName={summary.stock_name}
                     growthMomentum={fullData.growth_momentum}
                      baseline={industryBaseline}
                      baselineOptions={baselineOptions}
                      onBaselineChange={setIndustryBaseline}
                   />
                 </div>
              </div>
            </>
          ) : (
            <div className="info-panel mb-6 text-center py-8">
              <AlertCircle size={32} className="mx-auto mb-2 text-muted" />
              <p className="text-secondary">暂无交互分析数据</p>
              <p className="text-xs text-muted mt-1">可能是摘要数据未加载或数据源暂不可用</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'charts' && (
        <>
          {fullData && Object.keys(fullData).length > 0 && (
            <DataCharts data={fullData} />
          )}
        </>
      )}

      {/* Chart Grid for other tabs */}
      {activeTab !== 'overview' && activeTab !== 'charts' && (
        <div className="chart-grid">
          {report.type === 'futures' ? (
            report.images.map((img, idx) => (
              <ImageCard key={idx} src={img} fullWidth onOpen={() => openLightbox(idx)} />
            ))
          ) : (
            currentImages.length > 0 ? (
              currentImages.map((img, idx) => (
                <ImageCard key={idx} src={img} onOpen={() => openLightbox(idx)} />
              ))
            ) : (
              <div className="empty-state col-span-full">
                <ImageIcon size={40} />
                <div>该分类下暂无图表</div>
              </div>
            )
          )}
        </div>
      )}

      {lightboxIndex !== null && displayImages[lightboxIndex] && (
        <div className="lightbox-overlay" onClick={closeLightbox}>
          <button className="lightbox-close" onClick={closeLightbox}>✕</button>
          <button className="lightbox-nav left" onClick={(e) => { e.stopPropagation(); showPrev(); }}>‹</button>
          <img 
            src={`http://localhost:5001${displayImages[lightboxIndex]}`}
            alt="chart"
            className="lightbox-image"
            onClick={(e) => e.stopPropagation()}
          />
          <button className="lightbox-nav right" onClick={(e) => { e.stopPropagation(); showNext(); }}>›</button>
        </div>
      )}
    </div>
  )
}

// 新增：分析洞察组件 - 展示报告精华
function AnalysisInsights({ data, summary }) {
  const scores = data.scores || {}
  const valuation = data.valuation || {}
  const fundamentals = data.fundamentals || {}
  const growthMomentum = data.growth_momentum || {}
  const cashFlow = data.cash_flow || {}
  const annualTrend = data.annual_trend || []
  
  // 计算投资评级
  const getInvestmentRating = (score) => {
    if (score >= 80) return { label: '强烈推荐', action: '可逢低分批建仓', color: 'var(--color-success)', bg: 'rgba(0, 200, 83, 0.1)' }
    if (score >= 70) return { label: '推荐', action: '可择机介入', color: 'var(--color-up)', bg: 'rgba(38, 166, 154, 0.1)' }
    if (score >= 60) return { label: '中性', action: '观望等待机会', color: 'var(--color-warning)', bg: 'rgba(255, 152, 0, 0.1)' }
    return { label: '观望', action: '建议暂时回避', color: 'var(--color-down)', bg: 'rgba(239, 83, 80, 0.1)' }
  }
  
  const rating = getInvestmentRating(scores.overall || 0)
  
  // 计算估值状态
  const getValuationStatus = () => {
    const dcfMargin = valuation.dcf_margin_of_safety
    const ddmGordon = valuation.ddm_gordon
    const ddmTwoStage = valuation.ddm_two_stage
    const currentPrice = valuation.price
    
    if (!currentPrice) return { status: '无法判断', color: 'var(--text-muted)' }
    
    // 综合DCF和DDM判断
    let undervaluedCount = 0
    let overvaluedCount = 0
    
    if (dcfMargin > 20) undervaluedCount++
    else if (dcfMargin < -20) overvaluedCount++
    
    if (ddmGordon && currentPrice < ddmGordon * 0.8) undervaluedCount++
    else if (ddmGordon && currentPrice > ddmGordon * 1.2) overvaluedCount++
    
    if (ddmTwoStage && currentPrice < ddmTwoStage * 0.8) undervaluedCount++
    else if (ddmTwoStage && currentPrice > ddmTwoStage * 1.2) overvaluedCount++
    
    if (undervaluedCount >= 2) return { status: '明显低估', color: 'var(--color-success)' }
    if (undervaluedCount >= 1) return { status: '相对低估', color: 'var(--color-up)' }
    if (overvaluedCount >= 2) return { status: '明显高估', color: 'var(--color-down)' }
    if (overvaluedCount >= 1) return { status: '相对高估', color: 'var(--color-warning)' }
    return { status: '估值合理', color: 'var(--accent-primary)' }
  }
  
  const valuationStatus = getValuationStatus()
  
  // 计算增长率
  const calcGrowthRate = () => {
    if (annualTrend.length < 2) return null
    const latest = annualTrend[annualTrend.length - 1]
    const prev = annualTrend[annualTrend.length - 2]
    if (!latest || !prev || !prev.revenue_yi) return null
    const revenueGrowth = ((latest.revenue_yi - prev.revenue_yi) / prev.revenue_yi * 100).toFixed(1)
    const profitGrowth = ((latest.net_profit_yi - prev.net_profit_yi) / prev.net_profit_yi * 100).toFixed(1)
    return { revenueGrowth, profitGrowth }
  }
  
  const growth = calcGrowthRate()
  
  // 现金流健康度判断
  const getCashFlowHealth = () => {
    const cfo = cashFlow.latest_cfo_yi
    const netProfit = fundamentals.net_profit_yi
    if (!cfo || !netProfit) return { status: '数据不足', color: 'var(--text-muted)', desc: '' }
    
    const ratio = cfo / netProfit
    if (ratio > 1.2) return { status: '优秀', color: 'var(--color-success)', desc: '经营现金流远超净利润' }
    if (ratio > 0.8) return { status: '良好', color: 'var(--color-up)', desc: '现金流与利润匹配' }
    if (ratio > 0.5) return { status: '一般', color: 'var(--color-warning)', desc: '现金流略低于利润' }
    return { status: '较差', color: 'var(--color-down)', desc: '利润质量存疑' }
  }
  
  const cashFlowHealth = getCashFlowHealth()
  
  // 生成投资亮点（更智能）
  const generateHighlights = () => {
    const highlights = []
    
    // ROE分析
    if (summary.roe > 20) {
      highlights.push({ text: `ROE ${summary.roe.toFixed(1)}% - 资本回报率卓越，属于优质资产`, priority: 1 })
    } else if (summary.roe > 15) {
      highlights.push({ text: `ROE ${summary.roe.toFixed(1)}% - 盈利能力强劲`, priority: 2 })
    }
    
    // 毛利率分析
    if (summary.gross_margin > 50) {
      highlights.push({ text: `毛利率 ${summary.gross_margin.toFixed(1)}% - 护城河深厚，定价权强`, priority: 1 })
    } else if (summary.gross_margin > 30) {
      highlights.push({ text: `毛利率 ${summary.gross_margin.toFixed(1)}% - 产品具有竞争力`, priority: 2 })
    }
    
    // 负债率分析
    if (summary.debt_ratio < 30) {
      highlights.push({ text: `负债率 ${summary.debt_ratio.toFixed(1)}% - 财务极其稳健，抗风险能力强`, priority: 1 })
    } else if (summary.debt_ratio < 50) {
      highlights.push({ text: `负债率 ${summary.debt_ratio.toFixed(1)}% - 财务结构健康`, priority: 2 })
    }
    
    // 增长分析
    if (growth && growth.revenueGrowth > 20) {
      highlights.push({ text: `营收同比增长 ${growth.revenueGrowth}% - 高速成长期`, priority: 1 })
    } else if (growth && growth.revenueGrowth > 10) {
      highlights.push({ text: `营收同比增长 ${growth.revenueGrowth}% - 稳健增长`, priority: 2 })
    }
    
    // 增长趋势
    if (growthMomentum.summary === '持续增长型') {
      highlights.push({ text: `增长趋势: 持续增长型 - 业绩稳定向上`, priority: 1 })
    } else if (growthMomentum.summary === '加速增长型') {
      highlights.push({ text: `增长趋势: 加速增长型 - 增长动能强劲`, priority: 1 })
    }
    
    // 股息率
    if (valuation.dividend_yield > 3) {
      highlights.push({ text: `股息率 ${valuation.dividend_yield.toFixed(2)}% - 分红慷慨，适合长期持有`, priority: 2 })
    }
    
    // 现金流
    if (cashFlowHealth.status === '优秀') {
      highlights.push({ text: `现金流质量优秀 - 利润含金量高`, priority: 1 })
    }
    
    // PE估值
    if (valuation.pe_ttm && valuation.pe_ttm < 15) {
      highlights.push({ text: `PE ${valuation.pe_ttm.toFixed(1)} - 估值较低，具有安全边际`, priority: 2 })
    }
    
    return highlights.sort((a, b) => a.priority - b.priority).slice(0, 5)
  }
  
  // 生成风险提示（更全面）
  const generateRisks = () => {
    const risks = []
    
    // 估值风险
    if (valuation.pe_ttm > 50) {
      risks.push({ text: `PE ${valuation.pe_ttm.toFixed(1)} - 估值偏高，需要业绩高增长支撑`, level: 'high' })
    } else if (valuation.pe_ttm > 30) {
      risks.push({ text: `PE ${valuation.pe_ttm.toFixed(1)} - 估值较高，需警惕回调风险`, level: 'medium' })
    }
    
    // DCF安全边际
    if (valuation.dcf_margin_of_safety < -30) {
      risks.push({ text: `DCF安全边际 ${valuation.dcf_margin_of_safety.toFixed(1)}% - 内在价值低于市价`, level: 'high' })
    }
    
    // 盈利能力
    if (summary.roe && summary.roe < 8) {
      risks.push({ text: `ROE ${summary.roe.toFixed(1)}% - 资本回报率偏低`, level: 'medium' })
    }
    
    // 负债风险
    if (summary.debt_ratio > 70) {
      risks.push({ text: `负债率 ${summary.debt_ratio.toFixed(1)}% - 财务杠杆过高，警惕债务风险`, level: 'high' })
    } else if (summary.debt_ratio > 60) {
      risks.push({ text: `负债率 ${summary.debt_ratio.toFixed(1)}% - 负债水平偏高`, level: 'medium' })
    }
    
    // 利润率
    if (summary.net_margin && summary.net_margin < 5) {
      risks.push({ text: `净利率 ${summary.net_margin.toFixed(1)}% - 利润空间薄，抗风险能力弱`, level: 'high' })
    }
    
    // 增长风险
    if (growth && growth.revenueGrowth < 0) {
      risks.push({ text: `营收同比下滑 ${Math.abs(growth.revenueGrowth)}% - 业务可能面临挑战`, level: 'high' })
    } else if (growth && growth.profitGrowth < 0) {
      risks.push({ text: `利润同比下滑 ${Math.abs(growth.profitGrowth)}% - 盈利能力下降`, level: 'medium' })
    }
    
    // 现金流风险
    if (cashFlowHealth.status === '较差') {
      risks.push({ text: `现金流质量较差 - 利润含金量不足，需警惕`, level: 'high' })
    }
    
    // 增长趋势
    if (growthMomentum.summary === '下滑型' || growthMomentum.summary === '衰退型') {
      risks.push({ text: `增长趋势: ${growthMomentum.summary} - 业绩拐点向下`, level: 'high' })
    }
    
    return risks.slice(0, 5)
  }
  
  const highlights = generateHighlights()
  const risks = generateRisks()
  
  return (
    <div className="grid grid-cols-1 gap-6 mb-6">
      {/* 综合评分卡片 - 增强版 */}
      <div className="info-panel">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div 
              className="flex items-center justify-center"
              style={{
                width: 48,
                height: 48,
                borderRadius: 'var(--radius-md)',
                background: rating.bg
              }}
            >
              <AlertCircle size={24} style={{color: rating.color}} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-primary">综合投资评分</h2>
              <div className="text-sm text-muted">BlackOil AI 量化分析系统</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold" style={{color: rating.color}}>{scores.overall || 0}</div>
            <div className="text-sm font-semibold" style={{color: rating.color}}>{rating.label}</div>
            <div className="text-xs text-muted mt-1">{rating.action}</div>
          </div>
        </div>
        
        {/* 分维度评分 - 带说明 */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <ScorePill label="成长性" score={scores.growth} tip="营收利润增速" />
          <ScorePill label="盈利能力" score={scores.profitability} tip="ROE/利润率" />
          <ScorePill label="稳定性" score={scores.stability} tip="业绩波动" />
          <ScorePill label="安全性" score={scores.safety} tip="负债/现金流" />
          <ScorePill label="估值" score={scores.valuation} tip="PE/PB/DCF" />
        </div>
        
        {/* 快速结论 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded" style={{background: 'var(--bg-tertiary)'}}>
          <div className="text-center">
            <div className="text-xs text-muted mb-1">估值状态</div>
            <div className="text-sm font-semibold" style={{color: valuationStatus.color}}>{valuationStatus.status}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted mb-1">增长趋势</div>
            <div className="text-sm font-semibold" style={{color: growthMomentum.summary?.includes('增长') ? 'var(--color-success)' : 'var(--color-warning)'}}>{growthMomentum.summary || '-'}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted mb-1">现金流质量</div>
            <div className="text-sm font-semibold" style={{color: cashFlowHealth.color}}>{cashFlowHealth.status}</div>
          </div>
          <div className="text-center">
            <div className="text-xs text-muted mb-1">股息回报</div>
            <div className="text-sm font-semibold" style={{color: valuation.dividend_yield > 2 ? 'var(--color-success)' : 'var(--text-secondary)'}}>{valuation.dividend_yield ? `${valuation.dividend_yield.toFixed(2)}%` : '-'}</div>
          </div>
        </div>
      </div>

      {/* 核心痛点/亮点 - 增强版 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 投资亮点 */}
        <div className="info-panel">
          <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2">
            <TrendingUp size={18} style={{color: 'var(--color-success)'}} />
            投资亮点
          </h3>
          <div className="flex flex-col gap-3">
            {highlights.length > 0 ? highlights.map((item, idx) => (
              <HighlightItem 
                key={idx}
                icon={<CheckCircle size={16} style={{color: 'var(--color-success)'}} />}
                text={item.text}
              />
            )) : (
              <div className="text-sm text-muted">暂无明显亮点</div>
            )}
          </div>
        </div>

        {/* 风险提示 */}
        <div className="info-panel">
          <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2">
            <TrendingDown size={18} style={{color: 'var(--color-down)'}} />
            风险提示
          </h3>
          <div className="flex flex-col gap-3">
            {risks.length > 0 ? risks.map((item, idx) => (
              <HighlightItem 
                key={idx}
                icon={<XCircle size={16} style={{color: item.level === 'high' ? 'var(--color-down)' : 'var(--color-warning)'}} />}
                text={item.text}
              />
            )) : (
              <div className="text-sm text-muted flex items-center gap-2">
                <CheckCircle size={16} style={{color: 'var(--color-success)'}} />
                暂无重大风险提示
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 估值分析 - 增强版 */}
      {valuation && Object.keys(valuation).length > 0 && (
        <div className="info-panel">
          <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2">
            <DollarSign size={18} style={{color: 'var(--accent-primary)'}} />
            估值分析
            <span className="text-xs font-normal px-2 py-1 rounded ml-2" style={{background: valuationStatus.color, color: 'white'}}>{valuationStatus.status}</span>
          </h3>
          
          {/* 核心估值指标 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <MetricBox label="当前价格" value={`¥${valuation.price?.toFixed(2) || '-'}`} highlight />
            <MetricBox label="PE(TTM)" value={valuation.pe_ttm?.toFixed(2) || '-'} />
            <MetricBox label="PB" value={valuation.pb?.toFixed(2) || '-'} />
            <MetricBox label="股息率" value={valuation.dividend_yield ? `${valuation.dividend_yield.toFixed(2)}%` : '-'} />
          </div>
          
          {/* DCF/DDM估值对比 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 rounded" style={{background: 'var(--bg-tertiary)'}}>
            <div>
              <div className="text-xs text-muted mb-1">DCF估值</div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-primary">¥{valuation.dcf_per_share?.toFixed(2) || '-'}</span>
                <span className={`text-xs ${valuation.dcf_margin_of_safety > 0 ? 'text-success' : 'text-danger'}`}>
                  {valuation.dcf_margin_of_safety > 0 ? '↑' : '↓'}{Math.abs(valuation.dcf_margin_of_safety || 0).toFixed(1)}%
                </span>
              </div>
              <div className="text-xs text-muted">安全边际</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">DDM估值(Gordon)</div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-primary">¥{valuation.ddm_gordon?.toFixed(2) || '-'}</span>
                {valuation.ddm_gordon && valuation.price && (
                  <span className={`text-xs ${valuation.price < valuation.ddm_gordon ? 'text-success' : 'text-warning'}`}>
                    {valuation.price < valuation.ddm_gordon ? '低估' : '高估'}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">永续增长模型</div>
            </div>
            <div>
              <div className="text-xs text-muted mb-1">DDM估值(两阶段)</div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold text-primary">¥{valuation.ddm_two_stage?.toFixed(2) || '-'}</span>
                {valuation.ddm_two_stage && valuation.price && (
                  <span className={`text-xs ${valuation.price < valuation.ddm_two_stage ? 'text-success' : 'text-warning'}`}>
                    {valuation.price < valuation.ddm_two_stage ? '低估' : '高估'}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted">高增长+永续</div>
            </div>
          </div>
        </div>
      )}

      {/* 财务健康度 */}
      <div className="info-panel">
        <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2">
          <Activity size={18} style={{color: 'var(--color-up)'}} />
          财务健康度
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-3 rounded" style={{background: 'var(--bg-tertiary)'}}>
            <div className="text-xs text-muted mb-1">营业收入</div>
            <div className="text-lg font-bold text-primary">{fundamentals.revenue_yi?.toFixed(1) || '-'}亿</div>
            {growth && <div className={`text-xs ${growth.revenueGrowth > 0 ? 'text-success' : 'text-danger'}`}>YoY {growth.revenueGrowth > 0 ? '+' : ''}{growth.revenueGrowth}%</div>}
          </div>
          <div className="p-3 rounded" style={{background: 'var(--bg-tertiary)'}}>
            <div className="text-xs text-muted mb-1">净利润</div>
            <div className="text-lg font-bold text-primary">{fundamentals.net_profit_yi?.toFixed(1) || '-'}亿</div>
            {growth && <div className={`text-xs ${growth.profitGrowth > 0 ? 'text-success' : 'text-danger'}`}>YoY {growth.profitGrowth > 0 ? '+' : ''}{growth.profitGrowth}%</div>}
          </div>
          <div className="p-3 rounded" style={{background: 'var(--bg-tertiary)'}}>
            <div className="text-xs text-muted mb-1">经营现金流</div>
            <div className="text-lg font-bold text-primary">{cashFlow.latest_cfo_yi?.toFixed(1) || '-'}亿</div>
            <div className="text-xs" style={{color: cashFlowHealth.color}}>{cashFlowHealth.status}</div>
          </div>
          <div className="p-3 rounded" style={{background: 'var(--bg-tertiary)'}}>
            <div className="text-xs text-muted mb-1">财报日期</div>
            <div className="text-lg font-bold text-primary">{fundamentals.report_date || '-'}</div>
            <div className="text-xs text-muted">最新报告期</div>
          </div>
        </div>
      </div>

      {/* 操作建议 */}
      <div className="info-panel" style={{borderLeft: `4px solid ${rating.color}`}}>
        <h3 className="text-base font-bold text-primary mb-3 flex items-center gap-2">
          <AlertTriangle size={18} style={{color: 'var(--color-warning)'}} />
          操作建议
        </h3>
        <div className="text-sm text-secondary leading-relaxed">
          {scores.overall >= 75 ? (
            <p>该股票综合评分较高，基本面扎实。{valuationStatus.status === '明显低估' || valuationStatus.status === '相对低估' ? '当前估值具有安全边际，' : '但需关注估值水平，'}建议在回调时逐步建仓，设置止损位于前期低点下方5-8%。长期投资者可考虑定投策略。</p>
          ) : scores.overall >= 60 ? (
            <p>该股票综合评分中等，{highlights.length > 0 ? '具有一定投资价值，但' : ''}存在部分风险点需要关注。建议控制仓位在20%以内，等待更好的入场时机。若已持有，可继续观察业绩边际变化。</p>
          ) : (
            <p>该股票综合评分偏低，当前风险收益比不佳。建议暂时观望，等待基本面改善或估值大幅回落后再考虑介入。已持有者可考虑逢高减仓。</p>
          )}
        </div>
      </div>
    </div>
  )
}

// 评分徽章组件
function ScorePill({ label, score, tip }) {
  const getColor = (s) => {
    if (s >= 80) return 'var(--color-success)'
    if (s >= 60) return 'var(--color-up)'
    if (s >= 40) return 'var(--color-warning)'
    return 'var(--color-down)'
  }
  
  return (
    <div className="flex flex-col items-center p-3 rounded" style={{background: 'var(--bg-tertiary)'}} title={tip}>
      <div className="text-xs text-secondary mb-1">{label}</div>
      <div className="text-xl font-bold" style={{color: getColor(score)}}>{score || 0}</div>
      {tip && <div className="text-xs text-muted mt-1">{tip}</div>}
    </div>
  )
}

// 亮点/风险条目
function HighlightItem({ icon, text }) {
  return (
    <div className="flex items-start gap-2">
      <div style={{marginTop: 2}}>{icon}</div>
      <span className="text-sm text-secondary flex-1">{text}</span>
    </div>
  )
}

// 新增：数据图表组件 - JSON数据可视化
function DataCharts({ data }) {
  const annualTrend = data.annual_trend || []
  const cashFlow = data.cash_flow?.trend || []
  const growthQuarterly = data.growth_momentum?.quarterly_trend || []
  
  // 准备年度趋势数据
  const annualData = annualTrend.slice(-5).map(item => ({
    year: item.year,
    revenue: (item.revenue_yi || 0).toFixed(2),
    profit: (item.net_profit_yi || 0).toFixed(2),
    margin: (item.gross_margin_pct || 0).toFixed(1),
    roe: (item.roe_pct || 0).toFixed(1)
  }))
  
  // 准备现金流数据
  const cashFlowData = cashFlow.slice(-8).map(item => ({
    date: item.date,
    经营: (item.cfo_yi || 0).toFixed(1),
    投资: (item.cfi_yi || 0).toFixed(1),
    筹资: (item.cff_yi || 0).toFixed(1)
  }))
  
  // 准备季度增长数据
  const quarterlyData = growthQuarterly.slice(-8).map(item => ({
    quarter: item.quarter,
    revenue: (item.revenue_yi || 0).toFixed(1),
    profit: (item.profit_yi || 0).toFixed(1)
  }))
  
  const COLORS = {
    primary: '#2962ff',
    success: '#26a69a',
    warning: '#ff9800',
    danger: '#ef5350'
  }
  
  return (
    <div className="grid grid-cols-1 gap-6 mb-6">
      {/* 年度营收与利润趋势 */}
      {annualData.length > 0 && (
        <div className="info-panel">
          <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2">
            <BarChart2 size={18} style={{color: 'var(--accent-primary)'}} />
            年度营收与利润趋势 (亿元)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={annualData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="year" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip 
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)'
                }}
              />
              <Legend />
              <Bar dataKey="revenue" name="营收" fill={COLORS.primary} />
              <Bar dataKey="profit" name="净利润" fill={COLORS.success} />
              <Line type="monotone" dataKey="roe" name="ROE(%)" stroke={COLORS.warning} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 现金流结构 */}
      {cashFlowData.length > 0 && (
        <div className="info-panel">
          <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2">
            <LineChart size={18} style={{color: 'var(--color-success)'}} />
            现金流结构 (亿元)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <ReBarChart data={cashFlowData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="date" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip 
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)'
                }}
              />
              <Legend />
              <Bar dataKey="经营" fill={COLORS.success} />
              <Bar dataKey="投资" fill={COLORS.primary} />
              <Bar dataKey="筹资" fill={COLORS.warning} />
            </ReBarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 季度增长趋势 */}
      {quarterlyData.length > 0 && (
        <div className="info-panel">
          <h3 className="text-base font-bold text-primary mb-4 flex items-center gap-2">
            <TrendingUp size={18} style={{color: 'var(--color-up)'}} />
            季度增长趋势 (亿元)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={quarterlyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
              <XAxis dataKey="quarter" stroke="var(--text-secondary)" />
              <YAxis stroke="var(--text-secondary)" />
              <Tooltip 
                contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)'
                }}
              />
              <Legend />
              <Area type="monotone" dataKey="revenue" name="营收" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.3} />
              <Area type="monotone" dataKey="profit" name="利润" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.3} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

function MetricBox({ label, value, highlight = false }) {
  return (
    <div className={`metric-box ${highlight ? 'highlight' : ''}`}>
      <div className="metric-label">{label}</div>
      <div className="metric-value truncate">{value ?? '-'}</div>
    </div>
  )
}

function KeyInsightItem({ label, value }) {
  return (
    <div className="flex items-center justify-between p-3 rounded" style={{background: 'var(--bg-tertiary)'}}>
      <span className="text-sm text-secondary">{label}</span>
      <span className="font-semibold text-primary">{value ?? '-'}</span>
    </div>
  )
}

// 优化的图片卡片组件 - 带懒加载、错误处理和缓存
const ImageCard = memo(function ImageCard({ src, fullWidth = false, onOpen }) {
  const [imageStatus, setImageStatus] = useState('loading') // loading | loaded | error
  const [retryCount, setRetryCount] = useState(0)
  
  const fileName = useMemo(() => {
    return src?.split('/').pop()?.replace(/\.(png|jpg|jpeg)$/i, '') || 'image'
  }, [src])
  
  const imageUrl = useMemo(() => `http://localhost:5001${src}`, [src])
  
  const handleImageLoad = useCallback(() => {
    setImageStatus('loaded')
  }, [])
  
  const handleImageError = useCallback(() => {
    if (retryCount < 2) {
      // 自动重试 2 次
      setRetryCount(prev => prev + 1)
    } else {
      setImageStatus('error')
    }
  }, [retryCount])
  
  const handleRetry = useCallback(() => {
    setRetryCount(0)
    setImageStatus('loading')
  }, [])
  

  
  return (
    <>
      <div className={`chart-card ${fullWidth ? 'full-width' : ''}`}>
        <div className="chart-card-header">
          <span title={fileName}>{fileName}</span>
          <div className={`status-dot ${imageStatus === 'loaded' ? 'online' : imageStatus === 'error' ? 'offline' : ''}`}></div>
        </div>
        <div 
          className="chart-card-body cursor-pointer" 
          onClick={imageStatus === 'loaded' ? onOpen : undefined}
          style={{ minHeight: 200 }}
        >
          {imageStatus === 'loading' && (
            <div className="flex items-center justify-center" style={{position: 'absolute', inset: 0, background: 'var(--bg-tertiary)'}}>
              <Loader size={24} className="animate-spin" style={{color: 'var(--accent-primary)'}} />
            </div>
          )}
          
          {imageStatus === 'error' && (
            <div 
              className="flex flex-col items-center justify-center gap-2" 
              style={{position: 'absolute', inset: 0, background: 'var(--bg-tertiary)'}}
            >
              <AlertCircle size={32} style={{color: 'var(--color-down)'}} />
              <span className="text-sm text-muted">加载失败</span>
              <button 
                onClick={handleRetry}
                className="text-xs px-3 py-1 rounded"
                style={{background: 'var(--accent-primary)', color: 'white'}}
              >
                重试
              </button>
            </div>
          )}
          
          <img 
            key={retryCount} // 强制重新加载
            src={imageUrl}
            alt={fileName}
            loading="lazy"
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ 
              opacity: imageStatus === 'loaded' ? 1 : 0,
              transition: 'opacity 0.3s ease'
            }}
          />
          
          {imageStatus === 'loaded' && (
            <div 
              className="flex items-center justify-center gap-2"
              style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(41, 98, 255, 0.05)',
                opacity: 0,
                transition: 'opacity 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
              onMouseLeave={(e) => e.currentTarget.style.opacity = 0}
            >
              <span 
                className="flex items-center gap-1 text-sm"
                style={{
                  background: 'var(--bg-secondary)',
                  padding: '6px 12px',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)'
                }}
              >
                <Maximize2 size={14} />
                点击放大
              </span>
            </div>
          )}
        </div>
      </div>

    </>
  )
})

export default App
