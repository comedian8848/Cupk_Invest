import React, { useEffect, useRef, useMemo } from 'react';

const InteractiveStockChart = ({ data, title, theme = 'light' }) => {
  const containerRef = useRef(null);
  
  // Data processing
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return null;

    const dates = data.map(item => item.date);
    const open = data.map(item => item.open);
    const high = data.map(item => item.high);
    const low = data.map(item => item.low);
    const close = data.map(item => item.close);
    const volume = data.map(item => item.volume);

    // Calculate MA
    const calculateMA = (days) => {
      return close.map((val, idx, arr) => {
        if (idx < days - 1) return null;
        const slice = arr.slice(idx - days + 1, idx + 1);
        const sum = slice.reduce((a, b) => a + b, 0);
        return sum / days;
      });
    };

    // Calculate STD (Standard Deviation) for BOLL
    const calculateSTD = (days, ma) => {
      return close.map((val, idx, arr) => {
        if (idx < days - 1) return null;
        const avg = ma[idx];
        const slice = arr.slice(idx - days + 1, idx + 1);
        const sumSquareDiff = slice.reduce((a, b) => a + Math.pow(b - avg, 2), 0);
        return Math.sqrt(sumSquareDiff / days);
      });
    };

    const ma5 = calculateMA(5);
    const ma20 = calculateMA(20);
    const ma60 = calculateMA(60);
    const ma120 = calculateMA(120);

    // BOLL: MB=MA20, UP=MB+2*STD, DN=MB-2*STD
    const std20 = calculateSTD(20, ma20);
    const bollUp = ma20.map((v, i) => (v !== null && std20[i] !== null) ? v + 2 * std20[i] : null);
    const bollDn = ma20.map((v, i) => (v !== null && std20[i] !== null) ? v - 2 * std20[i] : null);

    const upColor = '#ef5350';
    const downColor = '#26a69a';
    
    const volColors = close.map((c, i) => {
      if (i === 0) return upColor;
      return c >= close[i-1] ? upColor : downColor;
    });

    return {
      dates, open, high, low, close, volume,
      ma5, ma20, ma60, ma120,
      bollUp, bollDn,
      volColors, upColor, downColor
    };
  }, [data]);

  useEffect(() => {
    if (!processedData || !containerRef.current || !window.Plotly) return;

    const styles = getComputedStyle(document.documentElement)
    const bg = styles.getPropertyValue('--bg-secondary').trim() || '#ffffff'
    const text = styles.getPropertyValue('--text-primary').trim() || '#1f2937'
    const grid = styles.getPropertyValue('--border-color').trim() || '#e5e7eb'

    const {
      dates, open, high, low, close, volume,
      ma5, ma20, ma60, ma120,
      bollUp, bollDn,
      volColors, upColor, downColor
    } = processedData;

    const traces = [
      // Candlestick
      {
        x: dates,
        close: close,
        decreasing: { line: { color: downColor } },
        high: high,
        increasing: { line: { color: upColor } },
        line: { color: 'rgba(31,119,180,1)' },
        low: low,
        open: open,
        type: 'candlestick',
        xaxis: 'x',
        yaxis: 'y',
        name: 'K线',
        showlegend: false
      },
      // BOLL Lower
      {
        x: dates,
        y: bollDn,
        type: 'scatter',
        mode: 'lines',
        line: { color: theme === 'dark' ? 'rgba(0, 200, 255, 0.85)' : 'rgba(0, 122, 255, 0.8)', width: 1.5, dash: 'dot' },
        name: 'BOLL下轨',
        hoverinfo: 'y+name',
        legendgroup: 'BOLL'
      },
      // BOLL Upper
      {
        x: dates,
        y: bollUp,
        type: 'scatter',
        mode: 'lines',
        line: { color: theme === 'dark' ? 'rgba(255, 193, 7, 0.85)' : 'rgba(245, 158, 11, 0.85)', width: 1.5, dash: 'dot' },
        fill: 'tonexty', // Fill area between Upper and Lower (Lower must be plotted before Upper)
        fillcolor: theme === 'dark' ? 'rgba(255, 193, 7, 0.12)' : 'rgba(245, 158, 11, 0.15)',
        name: 'BOLL上轨',
        hoverinfo: 'y+name',
        legendgroup: 'BOLL'
      },
      // MA5
      {
        x: dates,
        y: ma5,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#f39c12', width: 1 },
        name: 'MA5',
        hoverinfo: 'y+name'
      },
      // MA20 (BOLL Middle)
      {
        x: dates,
        y: ma20,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#4fc3f7', width: 1.5 },
        name: 'MA20',
        hoverinfo: 'y+name'
      },
      // MA60
      {
        x: dates,
        y: ma60,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#8e44ad', width: 1 },
        name: 'MA60',
        hoverinfo: 'y+name'
      },
      // MA120
      {
        x: dates,
        y: ma120,
        type: 'scatter',
        mode: 'lines',
        line: { color: '#2ecc71', width: 1 },
        name: 'MA120',
        hoverinfo: 'y+name'
      },
      // Volume
      {
        x: dates,
        y: volume,
        type: 'bar',
        yaxis: 'y2',
        marker: { color: volColors },
        name: '成交量',
        hoverinfo: 'y+name'
      }
    ];

    const layout = {
      title: {
        text: title || '股价走势',
        font: { size: 16, color: text }
      },
      paper_bgcolor: bg,
      plot_bgcolor: bg,
      font: { color: text },
      dragmode: 'zoom',
      margin: { r: 50, t: 40, b: 40, l: 50 },
      showlegend: true,
      legend: { orientation: 'h', x: 0, y: 1.05 },
      xaxis: {
        autorange: true,
        type: 'date',
        rangeslider: { visible: false },
        gridcolor: grid,
        rangeselector: {
          buttons: [
            { count: 1, label: '1月', step: 'month', stepmode: 'backward' },
            { count: 3, label: '3月', step: 'month', stepmode: 'backward' },
            { count: 6, label: '6月', step: 'month', stepmode: 'backward' },
            { count: 1, label: '1年', step: 'year', stepmode: 'backward' },
            { step: 'all', label: '全部' }
          ]
        }
      },
      yaxis: {
        autorange: true,
        domain: [0.3, 1],
        type: 'linear',
        title: '价格',
        gridcolor: grid
      },
      yaxis2: {
        domain: [0, 0.2],
        type: 'linear',
        title: '成交量',
        gridcolor: grid
      },
      autosize: true
    };

    const config = {
      responsive: true,
      displayModeBar: true,
      modeBarButtonsToRemove: ['lasso2d', 'select2d']
    };

    window.Plotly.newPlot(containerRef.current, traces, layout, config);

    // Cleanup
    return () => {
      if (containerRef.current && window.Plotly) {
        window.Plotly.purge(containerRef.current);
      }
    };
  }, [processedData, title, theme]);

  if (!data || data.length === 0) {
    return <div className="text-center text-muted p-4">暂无K线数据</div>;
  }

  return (
    <div className="interactive-chart-container">
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default InteractiveStockChart;