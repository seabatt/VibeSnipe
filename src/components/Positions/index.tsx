'use client';

import { useEffect, useState, useCallback } from 'react';
import { Position } from '@/types';

// Helper function to format strategy name for display
function formatStrategyName(position: Position): string {
  if (position.strategy === 'SPOT') {
    return position.underlying;
  }
  
  // For spreads, format as "SYMBOL STRIKE1/STRIKE2 Strategy"
  const strikes = position.legs
    .filter(leg => leg.strike > 0)
    .map(leg => leg.strike)
    .sort((a, b) => a - b);
  
  if (strikes.length === 0) {
    return `${position.underlying} ${position.strategy}`;
  }
  
  // For butterfly, show all strikes
  if (position.strategy === 'Butterfly' && strikes.length === 3) {
    return `${position.underlying} ${strikes[0]}/${strikes[1]}/${strikes[2]} ${position.legs[0]?.right === 'CALL' ? 'Call' : 'Put'} ${position.strategy}`;
  }
  
  // For vertical, show two strikes
  if (position.strategy === 'Vertical' && strikes.length >= 2) {
    const uniqueStrikes = [...new Set(strikes)];
    const callOrPut = position.legs[0]?.right === 'CALL' ? 'Call' : 'Put';
    if (uniqueStrikes.length === 2) {
      return `${position.underlying} ${uniqueStrikes[0]}/${uniqueStrikes[1]} ${callOrPut} ${position.strategy}`;
    }
    return `${position.underlying} ${uniqueStrikes[0]}/${uniqueStrikes[uniqueStrikes.length - 1]} ${callOrPut} ${position.strategy}`;
  }
  
  return `${position.underlying} ${position.strategy}`;
}

// Helper function to determine state (Profit, Risk, Neutral)
function getPositionState(position: Position): 'Profit' | 'Risk' | 'Neutral' {
  if (position.pnl > 0) return 'Profit';
  if (position.pnl < 0) return 'Risk';
  return 'Neutral';
}

function PositionRow({ position }: { position: Position }) {
  const pnlPercent = position.avgPrice > 0 && position.qty > 0 
    ? (position.pnl / (position.avgPrice * position.qty * (position.strategy === 'SPOT' ? 1 : 100))) * 100 
    : 0;
  
  const state = getPositionState(position);
  const strategyName = formatStrategyName(position);

  const handleClose = () => {
    // TODO: Implement position closing via API
    console.log('Close position:', position.id);
  };

  const handleTP = () => {
    // TODO: Implement take profit action
    console.log('Take Profit:', position.id);
  };

  const handleSL = () => {
    // TODO: Implement stop loss action
    console.log('Stop Loss:', position.id);
  };

  const pnlColor = position.pnl >= 0 ? 'text-profit' : 'text-risk';
  const stateColor = state === 'Profit' ? 'bg-profit/20 text-profit' : 
                     state === 'Risk' ? 'bg-risk/20 text-risk' : 
                     'bg-text-secondary-dark/20 text-text-secondary-dark';
  
  // Calculate TP/SL progress (simplified - would need actual price targets)
  const tpProgress = position.pnl > 0 ? Math.min(100, (position.pnl / (position.avgPrice * position.qty * 0.5)) * 100) : 0;
  const slProgress = position.pnl < 0 ? Math.min(100, Math.abs(position.pnl / (position.avgPrice * position.qty))) * 100 : 0;

  return (
    <tr className="border-b border-border-dark dark:border-border-dark hover:bg-surface-dark/50 transition-colors">
      {/* SYMBOL / STRATEGY */}
      <td className="px-16 py-12">
        <div className="text-sm font-medium text-text-primary-dark dark:text-text-primary-dark">
          {strategyName}
        </div>
      </td>
      
      {/* QTY */}
      <td className="px-16 py-12 text-sm text-text-primary-dark dark:text-text-primary-dark tabular-nums">
        {position.qty}
      </td>
      
      {/* ENTRY */}
      <td className="px-16 py-12 text-sm text-text-primary-dark dark:text-text-primary-dark tabular-nums">
        ${position.avgPrice.toFixed(2)}
      </td>
      
      {/* P/L */}
      <td className="px-16 py-12">
        <div className="flex items-center gap-8">
          <div className={`text-sm font-medium tabular-nums ${pnlColor}`}>
            {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
          </div>
          <div className={`text-xs tabular-nums ${pnlColor}`}>
            ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
          </div>
          {/* P/L Ring Icon */}
          <div className="relative w-12 h-12">
            <svg className="w-12 h-12 transform -rotate-90">
              <circle
                cx="16"
                cy="16"
                r="12"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                className="text-border-dark dark:text-border-dark opacity-30"
              />
              <circle
                cx="16"
                cy="16"
                r="12"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeDasharray={`${Math.abs(pnlPercent) * 0.75} 75`}
                className={pnlColor}
              />
            </svg>
          </div>
        </div>
      </td>
      
      {/* TP / SL */}
      <td className="px-16 py-12">
        <div className="space-y-4">
          {/* TP Bar */}
          <div className="h-2 bg-border-dark dark:bg-border-dark rounded-full overflow-hidden">
            <div
              className="h-full bg-profit transition-all duration-200"
              style={{ width: `${Math.max(0, Math.min(100, tpProgress))}%` }}
            />
          </div>
          {/* SL Bar */}
          <div className="h-2 bg-border-dark dark:bg-border-dark rounded-full overflow-hidden">
            <div
              className="h-full bg-risk transition-all duration-200"
              style={{ width: `${Math.max(0, Math.min(100, slProgress))}%` }}
            />
          </div>
        </div>
      </td>
      
      {/* STATE */}
      <td className="px-16 py-12">
        <div className={`px-8 py-4 rounded-full text-xs font-medium text-center ${stateColor}`}>
          {state}
        </div>
      </td>
      
      {/* CURVE */}
      <td className="px-16 py-12">
        <div className="w-32 h-16 flex items-center">
          {/* Simple curve visualization */}
          <svg className="w-full h-full" viewBox="0 0 32 16" preserveAspectRatio="none">
            <path
              d={position.pnl >= 0 
                ? "M 0,12 Q 8,4 16,8 T 32,4"
                : "M 0,4 Q 8,12 16,8 T 32,12"
              }
              stroke={position.pnl >= 0 ? '#10b981' : '#f59e0b'}
              strokeWidth="1.5"
              fill="none"
            />
          </svg>
        </div>
      </td>
      
      {/* ACTIONS */}
      <td className="px-16 py-12">
        <div className="flex items-center gap-4">
          <button
            onClick={handleClose}
            className="px-8 py-4 text-xs font-medium text-text-secondary-dark dark:text-text-secondary-dark hover:text-text-primary-dark dark:hover:text-text-primary-dark transition-colors"
          >
            Close
          </button>
          <button
            onClick={handleTP}
            className="px-8 py-4 text-xs font-medium text-text-secondary-dark dark:text-text-secondary-dark hover:text-text-primary-dark dark:hover:text-text-primary-dark transition-colors"
          >
            TP
          </button>
          <button
            onClick={handleSL}
            className="px-8 py-4 text-xs font-medium text-text-secondary-dark dark:text-text-secondary-dark hover:text-text-primary-dark dark:hover:text-text-primary-dark transition-colors"
          >
            SL
          </button>
        </div>
      </td>
    </tr>
  );
}

export function Positions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/tastytrade/positions');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || errorData.details || `Failed to fetch positions: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Positions API response:', data);
      
      if (data.error) {
        throw new Error(data.details || data.error || 'Failed to fetch positions');
      }
      
      setPositions(data.positions || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to fetch positions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPositions();
    
    // Refresh positions every 30 seconds
    const interval = setInterval(fetchPositions, 30000);
    
    return () => clearInterval(interval);
  }, [fetchPositions]);

  if (loading && positions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-16">
        <p className="text-text-secondary-dark dark:text-text-secondary-dark text-sm">
          Loading positions...
        </p>
      </div>
    );
  }

  if (error) {
    // Check if this is a configuration error
    const isConfigError = error.toLowerCase().includes('not configured') || 
                         error.toLowerCase().includes('tastytrade api not configured') ||
                         error.toLowerCase().includes('set tastytrde') ||
                         error.toLowerCase().includes('tastytrde_env') ||
                         error.toLowerCase().includes('tastytrde_username') ||
                         error.toLowerCase().includes('tastytrde_password') ||
                         error.toLowerCase().includes('missing required environment');

    return (
      <div className="h-full flex items-center justify-center bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-16">
        <div className="text-center max-w-md px-6">
          <p className="text-risk text-sm mb-4 font-medium">
            {isConfigError ? 'Tastytrade API Not Configured' : 'Failed to load positions'}
          </p>
          
          {isConfigError ? (
            <div className="space-y-3">
              <p className="text-text-secondary-dark dark:text-text-secondary-dark text-xs">
                The Tastytrade API credentials are not configured. To view your positions, please set the following environment variables in Vercel:
              </p>
              <div className="text-left bg-surface dark:bg-surface border border-border-dark dark:border-border-dark rounded-8 p-3 text-xs space-y-1 font-mono">
                <div className="text-text-primary-dark dark:text-text-primary-dark">
                  <span className="text-text-secondary-dark dark:text-text-secondary-dark">Required (OAuth2):</span>
                  <div className="mt-2 ml-2 space-y-1">
                    <div>TASTYTRADE_ENV=prod</div>
                    <div>TASTYTRADE_CLIENT_SECRET=your_client_secret</div>
                    <div>TASTYTRADE_REFRESH_TOKEN=your_refresh_token</div>
                  </div>
                  <span className="text-text-secondary-dark dark:text-text-secondary-dark block mt-2">Optional:</span>
                  <div className="mt-2 ml-2">
                    <div>TASTYTRADE_CLIENT_ID=your_client_id</div>
                    <div>TASTYTRADE_ACCOUNT_NUMBER=5WZ54420</div>
                  </div>
                </div>
              </div>
              <p className="text-text-secondary-dark dark:text-text-secondary-dark text-xs mt-3">
                After setting these variables, redeploy your application in Vercel.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-text-secondary-dark dark:text-text-secondary-dark text-xs mb-4">
                {error}
              </p>
              <p className="text-text-secondary-dark dark:text-text-secondary-dark text-xs opacity-75">
                Check the browser console (F12) for more details, or check Vercel logs for server-side errors.
              </p>
            </div>
          )}
          
          <button
            onClick={fetchPositions}
            className="px-4 py-2 bg-surface dark:bg-surface border border-border-dark dark:border-border-dark text-text-primary-dark dark:text-text-primary-dark text-xs rounded-12 hover:bg-border-dark dark:hover:bg-border-dark transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-16">
        <p className="text-text-secondary-dark dark:text-text-secondary-dark text-sm">
          No open positions
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary-dark dark:text-text-primary-dark">
          Open Positions
        </h2>
        <div className="flex items-center gap-8">
          <span className="text-sm text-text-secondary-dark dark:text-text-secondary-dark">
            {positions.length} active
          </span>
          <button
            onClick={fetchPositions}
            disabled={loading}
            className="text-xs text-text-secondary-dark dark:text-text-secondary-dark hover:text-text-primary-dark dark:hover:text-text-primary-dark transition-colors disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>
      
      {/* Table */}
      <div className="bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-12 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border-dark dark:border-border-dark bg-surface-dark/50">
                <th className="px-16 py-12 text-left text-xs font-medium text-text-secondary-dark dark:text-text-secondary-dark uppercase tracking-wider">
                  SYMBOL / STRATEGY
                </th>
                <th className="px-16 py-12 text-left text-xs font-medium text-text-secondary-dark dark:text-text-secondary-dark uppercase tracking-wider">
                  QTY
                </th>
                <th className="px-16 py-12 text-left text-xs font-medium text-text-secondary-dark dark:text-text-secondary-dark uppercase tracking-wider">
                  ENTRY
                </th>
                <th className="px-16 py-12 text-left text-xs font-medium text-text-secondary-dark dark:text-text-secondary-dark uppercase tracking-wider">
                  P/L
                </th>
                <th className="px-16 py-12 text-left text-xs font-medium text-text-secondary-dark dark:text-text-secondary-dark uppercase tracking-wider">
                  TP / SL
                </th>
                <th className="px-16 py-12 text-left text-xs font-medium text-text-secondary-dark dark:text-text-secondary-dark uppercase tracking-wider">
                  STATE
                </th>
                <th className="px-16 py-12 text-left text-xs font-medium text-text-secondary-dark dark:text-text-secondary-dark uppercase tracking-wider">
                  CURVE
                </th>
                <th className="px-16 py-12 text-left text-xs font-medium text-text-secondary-dark dark:text-text-secondary-dark uppercase tracking-wider">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <PositionRow key={position.id} position={position} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
