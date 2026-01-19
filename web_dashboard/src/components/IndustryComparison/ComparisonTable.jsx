import React from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import './styles.css';

const ComparisonTable = ({ stockData, industryData, stockName, metrics }) => {
  if (!stockData || !industryData) return null;

  const activeMetrics = Array.isArray(metrics) && metrics.length > 0 ? metrics : []

  const renderDiff = (val1, val2, isHigherBetter) => {
    if (val1 == null || val2 == null) return <Minus size={14} className="text-muted" />;
    
    const diff = val1 - val2;
    const isBetter = isHigherBetter ? diff > 0 : diff < 0;
    const colorClass = isBetter ? 'diff-positive' : 'diff-negative';
    const Icon = isBetter ? ArrowUp : ArrowDown;

    const pct = val2 !== 0 ? (diff / val2) * 100 : null;

    return (
      <div className={`flex items-center gap-2 ${colorClass}`}>
        <Icon size={14} />
        <div className="diff-stack">
          <span>{Math.abs(diff).toFixed(2)}</span>
          <span className="text-xs">
            {pct == null ? '-' : `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`}
          </span>
        </div>
        <span className="text-xs ml-1">{isBetter ? '优于行业' : '弱于行业'}</span>
      </div>
    );
  };

  return (
    <div className="comparison-card">
      <h3 className="text-base font-bold text-primary mb-4">行业数据对比</h3>
      <table className="comparison-table">
        <thead>
          <tr>
            <th>指标</th>
            <th>{stockName || '当前股票'}</th>
            <th>行业平均</th>
            <th>差异值 / 溢价%</th>
            <th>结论</th>
          </tr>
        </thead>
        <tbody>
          {activeMetrics.map((metric) => {
            const stockVal = stockData[metric.key];
            const industryVal = industryData[metric.key];
            const diff = (stockVal != null && industryVal != null) ? (stockVal - industryVal) : null
            const isBetter = diff == null ? null : (metric.isHigherBetter ? diff > 0 : diff < 0)
            const conclusion = diff == null ? '数据不足' : (Math.abs(diff) < 0.01 ? '持平' : (isBetter ? '优于行业' : '弱于行业'))

            return (
              <tr key={metric.key}>
                <td>{metric.label}</td>
                <td>{stockVal != null ? `${stockVal.toFixed(2)}${metric.unit}` : '-'}</td>
                <td>{industryVal != null ? `${industryVal.toFixed(2)}${metric.unit}` : '-'}</td>
                <td>{renderDiff(stockVal, industryVal, metric.isHigherBetter)}</td>
                <td>
                  <span className={`tag ${isBetter == null ? 'muted' : (isBetter ? 'positive' : 'negative')}`}>
                    {conclusion}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default ComparisonTable;
