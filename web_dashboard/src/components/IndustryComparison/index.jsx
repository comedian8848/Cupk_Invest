import React from 'react';
import ComparisonTable from './ComparisonTable';
import ComparisonRadar from './ComparisonRadar';
import './styles.css';

const IndustryComparison = ({ stockData, industryData, stockName, baseline, baselineOptions = [], onBaselineChange, peers = [], growthMomentum = {} }) => {
  if (!stockData || !industryData) {
    return (
      <div className="p-4 text-center" style={{background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)'}}>
        <div style={{color: 'var(--text-muted)', fontSize: '14px', marginBottom: '8px'}}>
          📊 暂无行业对比数据
        </div>
        <div style={{color: 'var(--text-muted)', fontSize: '12px'}}>
          该股票的行业对比数据可能暂未生成或获取失败
        </div>
        <div style={{color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px'}}>
          建议：点击"更新分析"重新生成报告
        </div>
      </div>
    );
  }

  const metrics = [
    { key: 'roe', label: 'ROE', unit: '%', isHigherBetter: true },
    { key: 'gross_margin', label: '毛利率', unit: '%', isHigherBetter: true },
    { key: 'net_margin', label: '净利率', unit: '%', isHigherBetter: true },
    { key: 'debt_ratio', label: '负债率', unit: '%', isHigherBetter: false },
    { key: 'pe_ttm', label: 'PE(TTM)', unit: '', isHigherBetter: false },
    { key: 'pb', label: 'PB', unit: '', isHigherBetter: false },
    { key: 'dividend_yield', label: '股息率', unit: '%', isHigherBetter: true }
  ]

  const formatVal = (val, unit) => (val != null ? `${Number(val).toFixed(2)}${unit}` : '-')

  const summary = metrics.reduce((acc, m) => {
    const s = stockData[m.key]
    const i = industryData[m.key]
    if (s == null || i == null) {
      acc.missing += 1
      return acc
    }
    const diff = s - i
    if (Math.abs(diff) < 0.01) {
      acc.tie += 1
      return acc
    }
    const isBetter = m.isHigherBetter ? diff > 0 : diff < 0
    if (isBetter) acc.better += 1
    else acc.worse += 1
    return acc
  }, { better: 0, worse: 0, tie: 0, missing: 0 })

  const exportCSV = () => {
    const rows = metrics.map(m => {
      const s = stockData[m.key]
      const i = industryData[m.key]
      const diff = (s != null && i != null) ? (s - i) : null
      return [
        m.label,
        formatVal(s, m.unit),
        formatVal(i, m.unit),
        diff != null ? diff.toFixed(2) : '-'
      ]
    })

    const header = ['指标', stockName || '当前股票', '行业平均', '差异']
    const csv = [header, ...rows].map(r => r.join(',')).join('\n')
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${stockName || 'stock'}_industry_comparison.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportJSON = () => {
    const payload = {
      stock: stockName || '当前股票',
      baseline: baseline || 'mean',
      data: metrics.map(m => ({
        metric: m.label,
        stock_value: stockData[m.key] ?? null,
        industry_value: industryData[m.key] ?? null
      }))
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${stockName || 'stock'}_industry_comparison.json`
    a.click()
    URL.revokeObjectURL(url)
  }

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

  return (
    <div className="industry-comparison-container">
       <div className="comparison-header">
         <div className="comparison-title">行业对比基准</div>
         <div className="comparison-actions">
           {baselineOptions.length > 0 && (
             <select
               className="comparison-select"
               value={baseline || baselineOptions[0].id}
               onChange={(e) => onBaselineChange?.(e.target.value)}
             >
               {baselineOptions.map(opt => (
                 <option key={opt.id} value={opt.id}>{opt.label}</option>
               ))}
             </select>
           )}
           <button className="comparison-button" onClick={exportCSV}>导出CSV</button>
           <button className="comparison-button" onClick={exportJSON}>导出JSON</button>
         </div>
       </div>
       <div className="comparison-summary">
         <span className="summary-chip positive">优于行业 {summary.better}</span>
         <span className="summary-chip negative">弱于行业 {summary.worse}</span>
         <span className="summary-chip neutral">持平 {summary.tie}</span>
         <span className="summary-chip muted">缺失 {summary.missing}</span>
       </div>
       
       {/* 五维能力雷达图 - 独立一行，居中显示 */}
       <ComparisonRadar stockData={stockData} industryData={industryData} stockName={stockName} metrics={metrics} />

       {/* 增量评价 */}
       <div className="comparison-card growth-eval-card">
         <div className="growth-eval-header">
           <h3 className="text-base font-bold text-primary">增量评价</h3>
           <span className={`tag ${expectationMeta.cls}`}>{expectationMeta.label}</span>
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
               <span key={`${n}-${idx}`} className="tag muted">{n}</span>
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
       
       {/* 详细对比表格 */}
       <ComparisonTable stockData={stockData} industryData={industryData} stockName={stockName} metrics={metrics} />
       {Array.isArray(peers) && peers.length > 0 && (
         <div className="comparison-card">
           <div className="flex items-center justify-between mb-3">
             <h3 className="text-base font-bold text-primary">同行业股票信息</h3>
             <span className="text-xs text-muted">Top {Math.min(12, peers.length)}</span>
           </div>
           <div className="peer-table-wrapper">
             <table className="peer-table">
               <thead>
                 <tr>
                   <th>代码</th>
                   <th>名称</th>
                   <th>现价</th>
                   <th>涨跌幅</th>
                   <th>PE</th>
                   <th>PB</th>
                   <th>市值(亿)</th>
                 </tr>
               </thead>
               <tbody>
                 {peers.slice(0, 12).map((p, idx) => (
                   <tr key={`${p.code || p.name || idx}`}>
                     <td>{p.code || '-'}</td>
                     <td>{p.name || '-'}</td>
                     <td>{p.price != null ? Number(p.price).toFixed(2) : '-'}</td>
                     <td className={p.change_pct > 0 ? 'diff-positive' : (p.change_pct < 0 ? 'diff-negative' : '')}>
                       {p.change_pct != null ? `${p.change_pct > 0 ? '+' : ''}${Number(p.change_pct).toFixed(2)}%` : '-'}
                     </td>
                     <td>{p.pe != null ? Number(p.pe).toFixed(2) : '-'}</td>
                     <td>{p.pb != null ? Number(p.pb).toFixed(2) : '-'}</td>
                     <td>{p.market_cap != null ? Number(p.market_cap).toFixed(2) : '-'}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
         </div>
       )}
    </div>
  );
};

export default IndustryComparison;
