'use client';

import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { useOrders } from '@/stores/useOrders';
import { useTheme } from '@/stores/useTheme';

export function RiskGraph() {
  const { pendingOrder } = useOrders();
  const { theme } = useTheme();

  const plotData = useMemo(() => {
    if (!pendingOrder) return null;

    // Calculate risk graph data
    const underlyingPrices = [];
    const pnlValues = [];
    const maxLoss = pendingOrder.maxLoss || 0;
    const maxGain = pendingOrder.maxGain || 0;

    // Simple P/L curve calculation (simplified)
    for (let price = 4900; price <= 5300; price += 5) {
      underlyingPrices.push(price);
      
      // Simplified P/L calculation based on spread
      let pnl = 0;
      if (pendingOrder.legs.length >= 2) {
        // Vertical spread approximation
        const entryPrice = pendingOrder.spreadPrice || 1.0;
        const lowerStrike = Math.min(...pendingOrder.legs.map((l) => l.strike));
        const upperStrike = Math.max(...pendingOrder.legs.map((l) => l.strike));
        const width = upperStrike - lowerStrike;

        if (price <= lowerStrike) {
          pnl = -entryPrice * 100; // Max loss
        } else if (price >= upperStrike) {
          pnl = (width - entryPrice) * 100; // Max gain
        } else {
          pnl = ((price - lowerStrike) / width) * width * 100 - entryPrice * 100;
        }
      }

      pnlValues.push(pnl);
    }

    const isDark = theme === 'dark';
    const bgColor = isDark ? '#0F1115' : '#FFFFFF';
    const textColor = isDark ? '#E6E7EB' : '#0E1220';
    const gridColor = isDark ? '#232734' : '#E2E6F0';

    const data: any[] = [
      {
        x: underlyingPrices,
        y: pnlValues,
        type: 'scatter',
        mode: 'lines',
        name: 'P/L Curve',
        line: {
          color: '#4DA1FF',
          width: 2,
        },
        hovertemplate: 'Price: $%{x}<br>P/L: $%{y:.2f}<extra></extra>',
      },
    ];

    // Add TP/SL bands
    if (pendingOrder.ruleBundle && pendingOrder.ruleBundle.takeProfitPct != null && pendingOrder.ruleBundle.stopLossPct != null) {
      const tpLevel = maxGain * (pendingOrder.ruleBundle.takeProfitPct / 100);
      const slLevel = maxLoss * (pendingOrder.ruleBundle.stopLossPct / 100);

      data.push({
        x: [underlyingPrices[0], underlyingPrices[underlyingPrices.length - 1]],
        y: [tpLevel, tpLevel],
        type: 'scatter',
        mode: 'lines',
        name: 'Take Profit',
        line: {
          color: '#82D895',
          width: 1,
          dash: 'dash',
        },
        showlegend: false,
      });

      data.push({
        x: [underlyingPrices[0], underlyingPrices[underlyingPrices.length - 1]],
        y: [slLevel, slLevel],
        type: 'scatter',
        mode: 'lines',
        name: 'Stop Loss',
        line: {
          color: '#EC612B',
          width: 1,
          dash: 'dash',
        },
        showlegend: false,
      });
    }

    const layout: any = {
      autosize: true,
      margin: { l: 50, r: 20, t: 20, b: 50 },
      plot_bgcolor: bgColor,
      paper_bgcolor: bgColor,
      font: { color: textColor, family: 'Inter' },
      xaxis: {
        title: 'Underlying Price',
        gridcolor: gridColor,
        showgrid: true,
        fixedrange: true,
      },
      yaxis: {
        title: 'P/L ($)',
        gridcolor: gridColor,
        showgrid: true,
        fixedrange: true,
      },
      showlegend: false,
      hovermode: 'x unified',
    };

    const config: any = {
      displayModeBar: false,
      responsive: true,
    };

    return { data, layout, config };
  }, [pendingOrder, theme]);

  if (!pendingOrder || !plotData) {
    return (
      <div className="h-full flex items-center justify-center border rounded-16" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          No order to preview
        </p>
      </div>
    );
  }

  return (
    <div className="h-full border rounded-16 p-16" style={{ backgroundColor: 'var(--surface)', borderColor: 'var(--border)' }}>
      <Plot
        data={plotData.data}
        layout={plotData.layout}
        config={plotData.config}
        style={{ width: '100%', height: '100%' }}
      />
    </div>
  );
}
