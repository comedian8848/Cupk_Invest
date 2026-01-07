import { useState, useEffect } from 'react'
import axios from 'axios'
import { BarChart3, Activity, DollarSign, TrendingUp, FileText, Image as ImageIcon, ArrowLeft, RefreshCw, Cpu, Box, Layers, AlertTriangle, Play, Loader, CheckCircle, XCircle, LayoutGrid } from 'lucide-react'

const API_BASE = 'http://localhost:5001/api'

function App() {
  const [reports, setReports] = useState([])
  const [selectedReport, setSelectedReport] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showAnalyzer, setShowAnalyzer] = useState(false)

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await axios.get(`${API_BASE}/reports`)
      setReports(res.data)
    } catch (err) {
      console.error(err)
      setError("无法连接到服务器，请确保 Python 后端正在运行。")
    } finally {
      setLoading(false)
    }
  }

  const loadReportDetails = async (report) => {
    setLoading(true)
    try {
      // Parallel fetch: details (images) and summary (json)
      const [detailsRes, summaryRes] = await Promise.all([
        axios.get(`${API_BASE}/reports/${report.id}`),
        report.type === 'stock' ? axios.get(`${API_BASE}/reports/${report.id}/summary`).catch(() => ({data: null})) : Promise.resolve({data: null})
      ])
      
      setSelectedReport({
        ...report,
        ...detailsRes.data,
        summaryData: summaryRes.data
      })
      setShowAnalyzer(false)
    } catch (err) {
      console.error(err)
      alert("加载报告详情失败")
    } finally {
      setLoading(false)
    }
  }

  const handleAnalysisComplete = (code) => {
    fetchReports()
    setTimeout(() => {
      const newReport = reports.find(r => r.code === code)
      if (newReport) loadReportDetails(newReport)
    }, 1000)
  }

  return (
    <div className="geek-container min-h-screen">
      <header className="geek-header">
        <div className="flex items-center gap-3">
          <BarChart3 size={28} className="text-blue-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-800">Analysis Pro</h1>
            <div className="text-xs text-gray-500">股票分析报告查看器</div>
          </div>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => {
              setShowAnalyzer(!showAnalyzer)
              setSelectedReport(null)
            }} 
            className={`geek-btn flex items-center gap-2 ${showAnalyzer ? 'bg-green-600' : ''}`}
          >
            <Play size={16} />
            新建分析
          </button>
          <button onClick={fetchReports} className="geek-btn flex items-center gap-2" disabled={loading}>
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            刷新
          </button>
        </div>
      </header>

      {error && (
        <div className="border border-red-300 bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex items-center gap-3">
          <AlertTriangle size={20} />
          {error}
        </div>
      )}

      {showAnalyzer ? (
        <StockAnalyzer onComplete={handleAnalysisComplete} onBack={() => setShowAnalyzer(false)} />
      ) : selectedReport ? (
        <ReportDetail 
          report={selectedReport} 
          onBack={() => setSelectedReport(null)} 
        />
      ) : (
        <div className="animate-in">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {reports.map((report) => (
              <div 
                key={report.id} 
                onClick={() => loadReportDetails(report)}
                className="geek-card group"
              >
                <div className="flex items-center gap-2 mb-3">
                  <div className={`p-2 rounded-lg ${report.type === 'stock' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                    {report.type === 'stock' ? <Activity size={18} /> : <Layers size={18} />}
                  </div>
                  <span className="text-xs text-gray-400 font-mono">
                    {report.type === 'stock' ? '股票' : '期货'}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                  {report.code}
                </h3>
                <div className="text-sm text-gray-500 mt-1">
                  {report.date}
                </div>
              </div>
            ))}
          </div>
          
          {reports.length === 0 && !loading && !error && (
            <div className="flex flex-col items-center justify-center py-24 text-gray-400 space-y-4">
              <Box size={48} />
              <div className="text-lg">暂无分析报告</div>
              <div className="text-sm">点击"新建分析"生成第一份报告</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function StockAnalyzer({ onComplete, onBack }) {
  const [code, setCode] = useState('')
  const [taskId, setTaskId] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  const startAnalysis = async () => {
    if (!code.trim()) {
      setError('请输入股票代码')
      return
    }

    setError(null)
    try {
      const res = await axios.post(`${API_BASE}/analyze`, { code: code.trim() })
      setTaskId(res.data.task_id)
      pollStatus(res.data.task_id)
    } catch (err) {
      setError(err.response?.data?.error || '启动分析失败')
    }
  }

  const pollStatus = async (id) => {
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`${API_BASE}/analyze/${id}`)
        setStatus(res.data)

        if (res.data.status === 'completed') {
          clearInterval(interval)
          setTimeout(() => {
            onComplete(res.data.code)
          }, 1500)
        } else if (res.data.status === 'error') {
          clearInterval(interval)
          setError(res.data.message)
        }
      } catch (err) {
        clearInterval(interval)
        setError('获取状态失败')
      }
    }, 2000)
  }

  return (
    <div className="max-w-xl mx-auto animate-in">
      <button onClick={onBack} className="geek-btn mb-6 flex items-center gap-2 text-sm bg-gray-500">
        <ArrowLeft size={16} /> 返回
      </button>

      <div className="geek-card border-l-4 border-l-blue-500">
        <h2 className="text-xl font-bold mb-6 text-gray-800">🚀 新建股票分析</h2>
        
        {!taskId ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm mb-2 text-gray-600">股票代码</label>
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && startAnalysis()}
                placeholder="如：600519, 000858"
                className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-3 text-gray-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
            </div>

            {error && (
              <div className="border border-red-300 bg-red-50 text-red-600 p-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              onClick={startAnalysis}
              className="geek-btn w-full py-3 flex items-center justify-center gap-2 text-base"
            >
              <Play size={18} />
              开始分析
            </button>

            <div className="text-sm text-gray-500 border-t border-gray-200 pt-4 space-y-1">
              <p>• 支持 A 股（6位代码）</p>
              <p>• 分析耗时约 10-30 分钟</p>
              <p>• 将生成 20+ 张图表和综合报告</p>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              {status?.status === 'running' && <Loader size={24} className="animate-spin text-blue-500" />}
              {status?.status === 'completed' && <CheckCircle size={24} className="text-green-500" />}
              {status?.status === 'error' && <XCircle size={24} className="text-red-500" />}
              
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-1">状态</div>
                <div className="text-lg font-semibold text-gray-800">
                  {status?.message || '初始化中...'}
                </div>
              </div>
            </div>

            {status?.status === 'running' && (
              <div className="space-y-2">
                <div className="h-2 bg-gray-200 rounded overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${status.progress || 5}%` }}
                  />
                </div>
                <div className="text-xs text-gray-500 text-right">
                  {status.progress || 0}% 完成
                </div>
              </div>
            )}

            {error && (
              <div className="border border-red-400 bg-red-50 text-red-600 p-3 rounded text-sm">
                {error}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ReportDetail({ report, onBack }) {
  const [activeTab, setActiveTab] = useState('overview')
  
  // Categorize images
  const images = report.images || []
  const categories = {
    overview: images.filter(i => i.includes('Dashboard') || i.includes('增量分析') || i.includes('概览')),
    trend: images.filter(i => i.match(/\/(00|01|02|03|05|06|08)_/)),
    valuation: images.filter(i => i.match(/\/(04|11|12|13|21)_/)),
    financials: images.filter(i => i.includes('财务') || i.match(/\/(07|09|14|15|16|18|20)_/)),
    technicals: images.filter(i => i.includes('技术') || i.includes('回测') || i.includes('99_')),
    all: images
  }
  
  // If no categorization works (e.g. futures or unknown naming), fallback to 'all'
  const currentImages = (report.type === 'stock' && categories[activeTab]?.length > 0) 
    ? categories[activeTab] 
    : (activeTab === 'all' ? images : [])

  const TABS = [
    { id: 'overview', label: 'DASHBOARD', icon: <Activity size={16} /> },
    { id: 'trend', label: 'TREND', icon: <TrendingUp size={16} /> },
    { id: 'valuation', label: 'VALUATION', icon: <DollarSign size={16} /> },
    { id: 'financials', label: 'FINANCIALS', icon: <FileText size={16} /> },
    { id: 'technicals', label: 'TECH', icon: <Cpu size={16} /> },
    { id: 'all', label: 'ALL FILES', icon: <ImageIcon size={16} /> },
  ]

  // Parse key metrics from summaryData if available
  const summary = report.summaryData || {}
  
  return (
    <div className="animate-in slide-in-from-right-8 duration-300">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 mb-6 transition-all">
        <ArrowLeft size={16} /> ← 返回列表
      </button>
      
      {/* Header Info */}
      <div className="bg-white rounded-xl shadow-sm p-6 mb-8 border-l-4 border-l-blue-500 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5 text-gray-400">
          <Activity size={120} />
        </div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="text-xs text-blue-600 mb-1">股票代码</div>
            <h1 className="text-4xl font-bold text-gray-800 tracking-tight mb-2">{report.code}</h1>
            <div className="flex gap-4 text-sm text-gray-500">
              <span className="bg-blue-50 px-2 py-1 rounded text-blue-600">类型: {report.type === 'stock' ? '股票' : '期货'}</span>
              <span className="py-1">日期: {report.date}</span>
            </div>
          </div>

          {/* Key Metrics from JSON if available */}
          {summary.stock_name && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full md:w-auto">
              <MetricBox label="名称" value={summary.stock_name} />
              <MetricBox label="行业" value={summary.industry} />
              <MetricBox label="评分" value="N/A" glow />
              <MetricBox label="评级" value="N/A" />
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      {report.type === 'stock' && (
        <div className="flex flex-wrap gap-1 mb-8 border-b border-gray-200 pb-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-2.5 text-sm transition-all border-b-2 -mb-px
                ${activeTab === tab.id 
                  ? 'border-blue-500 text-blue-600 bg-blue-50' 
                  : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'}
              `}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Analysis Text Report */}
      {summary.raw_text && activeTab === 'overview' && (
        <div className="bg-white rounded-xl shadow-sm p-5 mb-8 border border-gray-100">
           <div className="flex items-center gap-2 mb-4 text-blue-600 border-b border-gray-100 pb-2">
             <FileText size={16} />
             <h3 className="font-semibold">分析报告</h3>
           </div>
           <pre className="text-sm text-gray-600 whitespace-pre-wrap h-64 overflow-y-auto bg-gray-50 p-4 rounded-lg">
             {summary.raw_text}
           </pre>
        </div>
      )}

      {/* Images Grid - Optimized for smaller, cleaner layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {report.type === 'futures' ? (
          // Futures usually have one big image
          report.images.map((img, idx) => (
             <ImageCard key={idx} src={img} idx={idx} fullWidth />
          ))
        ) : (
          // Stock images based on active tab
          currentImages.length > 0 ? (
            currentImages.map((img, idx) => (
              <ImageCard key={idx} src={img} idx={idx} />
            ))
          ) : (
            <div className="text-center py-20 text-gray-400 col-span-full border-2 border-dashed border-gray-200 rounded-lg">
              该分类下暂无图表数据
            </div>
          )
        )}
      </div>
    </div>
  )
}

function MetricBox({ label, value, glow = false }) {
  return (
    <div className={`
      bg-gray-50 border border-gray-200 p-3 rounded-lg
      ${glow ? 'shadow-sm border-blue-200 bg-blue-50' : ''}
    `}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className="text-sm font-semibold text-gray-800 truncate">{value}</div>
    </div>
  )
}

function ImageCard({ src, idx, fullWidth = false }) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <>
      <div className={`bg-white rounded-xl shadow-sm overflow-hidden border border-gray-100 hover:shadow-md hover:border-blue-200 transition-all duration-300 group ${fullWidth ? 'md:col-span-2 xl:col-span-3' : ''}`}>
        <div className="bg-gray-50 px-3 py-2 border-b border-gray-100 flex justify-between items-center">
          <span className="text-xs text-gray-500 truncate flex-1 mr-2">
            {src.split('/').pop().replace(/\.(png|jpg|jpeg)$/i, '')}
          </span>
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
        </div>
        <div className="relative overflow-hidden cursor-pointer bg-white p-2" onClick={() => setIsExpanded(true)}>
          <img 
            src={`http://localhost:5001${src}`} 
            alt="分析图表" 
            className="w-full h-auto object-contain rounded"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
            <span className="text-blue-600 text-sm bg-white/90 px-3 py-1.5 rounded-full shadow">点击放大</span>
          </div>
        </div>
      </div>

      {/* Lightbox Modal */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsExpanded(false)}
        >
          <button 
            className="absolute top-4 right-4 text-white bg-black/50 w-10 h-10 rounded-full text-xl font-bold hover:bg-black/70 transition-colors"
            onClick={() => setIsExpanded(false)}
          >
            ✕
          </button>
          <img 
            src={`http://localhost:5001${src}`} 
            alt="分析图表" 
            className="max-w-[95vw] max-h-[90vh] object-contain bg-white rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  )
}

export default App
