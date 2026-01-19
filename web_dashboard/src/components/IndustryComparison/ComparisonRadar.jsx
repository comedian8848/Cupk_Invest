import React from 'react';
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend, Tooltip } from 'recharts';
import './styles.css';

const ComparisonRadar = ({ stockData, industryData, stockName, metrics }) => {
  if (!stockData || !industryData) return null;

  // Normalize data for radar chart (0-100 scale ideally, or relative)
  // For simplicity, we'll map a few key metrics. 
  // Note: This requires careful normalization logic in a real app. 
  // Here we just display raw values which might be off-scale if units differ vastly.
  // Better approach: Calculate percentile or ratio.
  
  const radarMetrics = [
    { key: 'roe', label: 'ROE', isHigherBetter: true },
    { key: 'gross_margin', label: '毛利', isHigherBetter: true },
    { key: 'net_margin', label: '净利', isHigherBetter: true },
    { key: 'debt_ratio', label: '安全', isHigherBetter: false },
    { key: 'pe_ttm', label: '估值', isHigherBetter: false },
  ];

  const data = radarMetrics.map(m => {
    const sRaw = stockData[m.key]
    const iRaw = industryData[m.key]
    if (sRaw == null || iRaw == null || iRaw === 0 || sRaw === 0) {
      return { subject: m.label, stock: 0, industry: 100, fullMark: 200 }
    }

    const ratio = m.isHigherBetter ? (sRaw / iRaw) : (iRaw / sRaw)
    const stockScore = Math.min(Math.max(ratio * 100, 0), 200)
    return {
      subject: m.label,
      stock: stockScore,
      industry: 100,
      fullMark: 200
    }
  });

  return (
    <div className="comparison-card radar-card-centered">
      <h3 className="text-base font-bold text-primary mb-2 text-center">五维能力对比</h3>
      <div className="radar-container-large">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
            <PolarGrid stroke="var(--border-color)" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }} 
            />
            <PolarRadiusAxis angle={90} domain={[0, 'auto']} tick={false} axisLine={false} />
            <Radar
              name={stockName || "当前股票"}
              dataKey="stock"
              stroke="var(--accent-primary)"
              fill="var(--accent-primary)"
              fillOpacity={0.45}
              strokeWidth={2}
            />
            <Radar
              name="行业基准(=100)"
              dataKey="industry"
              stroke="var(--text-muted)"
              fill="var(--text-muted)"
              fillOpacity={0.15}
              strokeWidth={1.5}
              strokeDasharray="4 4"
            />
            <Legend 
              wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} 
              iconType="circle"
            />
            <Tooltip 
               contentStyle={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)'
                }}
               formatter={(value) => `${value.toFixed(0)}`}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="radar-note text-center">行业=100为基准线，数值越大相对行业越优</div>
    </div>
  );
};

export default ComparisonRadar;
