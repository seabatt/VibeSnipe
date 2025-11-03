'use client';

import { useEffect, useState } from 'react';
import { Position } from '@/types';
import { RiskGraph } from '../RiskGraph';

function PositionTile({ position }: { position: Position }) {
  const pnlPercent = position.avgPrice > 0 ? (position.pnl / (position.avgPrice * position.qty * 100)) * 100 : 0;

  const handleClose = () => {
    // TODO: Implement position closing via API
    console.log('Close position:', position.id);
  };

  const handleChangeTarget = () => {
    const newTp = prompt('New Take Profit %:', position.ruleBundle.takeProfitPct.toString());
    if (newTp) {
      // TODO: Implement target update via API
      console.log('Update target:', position.id, newTp);
    }
  };

  const handleChangeStop = () => {
    const newSl = prompt('New Stop Loss %:', position.ruleBundle.stopLossPct.toString());
    if (newSl) {
      // TODO: Implement stop update via API
      console.log('Update stop:', position.id, newSl);
    }
  };

  return (
    <div className="px-16 py-12 bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-12 space-y-12">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="text-sm font-medium text-text-primary-dark dark:text-text-primary-dark">
            {position.underlying} {position.strategy}
          </div>
          <div className="text-xs text-text-secondary-dark dark:text-text-secondary-dark mt-4">
            {position.legs.map((leg, i) => (
              <span key={i} className="mr-8">
                {leg.action} {leg.strike}{leg.right[0]} x{leg.quantity}
              </span>
            ))}
          </div>
        </div>
        <div className={`px-8 py-4 rounded-12 text-xs font-medium ${
          position.state === 'FILLED'
            ? 'bg-profit/20 text-profit'
            : position.state === 'WORKING'
            ? 'bg-warning/20 text-warning'
            : 'bg-text-secondary-dark/20 text-text-secondary-dark dark:text-text-secondary-dark'
        }`}>
          {position.state}
        </div>
      </div>

      {/* P/L Ring */}
      <div className="flex items-center gap-16">
        <div className="relative w-16 h-16">
          <svg className="w-16 h-16 transform -rotate-90">
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              className="text-border-dark dark:text-border-dark"
            />
            <circle
              cx="32"
              cy="32"
              r="28"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
              strokeDasharray={`${Math.abs(pnlPercent) * 1.76} 176`}
              className={position.pnl >= 0 ? 'text-profit' : 'text-risk'}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className={`text-xs font-medium tabular-nums ${
                position.pnl >= 0 ? 'text-profit' : 'text-risk'
              }`}>
                ${position.pnl.toFixed(2)}
              </div>
              <div className="text-[10px] text-text-secondary-dark dark:text-text-secondary-dark">
                {pnlPercent.toFixed(1)}%
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary-dark dark:text-text-secondary-dark">Avg Price</span>
            <span className="tabular-nums text-text-primary-dark dark:text-text-primary-dark">
              ${position.avgPrice.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-text-secondary-dark dark:text-text-secondary-dark">Quantity</span>
            <span className="tabular-nums text-text-primary-dark dark:text-text-primary-dark">
              {position.qty}
            </span>
          </div>
        </div>
      </div>

      {/* TP/SL Bars */}
      <div className="space-y-4">
        <div className="flex items-center gap-8">
          <span className="text-xs text-text-secondary-dark dark:text-text-secondary-dark w-16">
            TP
          </span>
          <div className="flex-1 h-2 bg-border-dark dark:bg-border-dark rounded-full overflow-hidden">
            <div
              className="h-full bg-profit transition-all duration-200"
              style={{ width: `${position.ruleBundle.takeProfitPct}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-text-secondary-dark dark:text-text-secondary-dark">
            {position.ruleBundle.takeProfitPct}%
          </span>
        </div>
        <div className="flex items-center gap-8">
          <span className="text-xs text-text-secondary-dark dark:text-text-secondary-dark w-16">
            SL
          </span>
          <div className="flex-1 h-2 bg-border-dark dark:bg-border-dark rounded-full overflow-hidden">
            <div
              className="h-full bg-risk transition-all duration-200"
              style={{ width: `${position.ruleBundle.stopLossPct}%` }}
            />
          </div>
          <span className="text-xs tabular-nums text-text-secondary-dark dark:text-text-secondary-dark">
            {position.ruleBundle.stopLossPct}%
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-4 pt-8 border-t border-border-dark dark:border-border-dark">
        <button
          onClick={handleClose}
          className="flex-1 px-8 py-4 bg-risk hover:bg-risk/80 text-white text-xs font-medium rounded-12 transition-colors duration-200"
        >
          Close
        </button>
        <button
          onClick={handleChangeTarget}
          className="flex-1 px-8 py-4 bg-bg-dark dark:bg-bg-dark border border-border-dark dark:border-border-dark text-text-primary-dark dark:text-text-primary-dark text-xs font-medium rounded-12 hover:bg-border-dark dark:hover:bg-border-dark transition-colors duration-200"
        >
          Change Target
        </button>
        <button
          onClick={handleChangeStop}
          className="flex-1 px-8 py-4 bg-bg-dark dark:bg-bg-dark border border-border-dark dark:border-border-dark text-text-primary-dark dark:text-text-primary-dark text-xs font-medium rounded-12 hover:bg-border-dark dark:hover:bg-border-dark transition-colors duration-200"
        >
          Change Stop
        </button>
      </div>
    </div>
  );
}

export function Positions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPositions();
    
    // Refresh positions every 30 seconds
    const interval = setInterval(fetchPositions, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/tastytrade/positions');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch positions: ${response.statusText}`);
      }
      
      const data = await response.json();
      setPositions(data.positions || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to fetch positions:', err);
    } finally {
      setLoading(false);
    }
  };

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
    return (
      <div className="h-full flex items-center justify-center bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-16">
        <div className="text-center">
          <p className="text-risk text-sm mb-4">Failed to load positions</p>
          <p className="text-text-secondary-dark dark:text-text-secondary-dark text-xs mb-4">
            {error}
          </p>
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
        <h2 className="text-sm font-medium text-text-primary-dark dark:text-text-primary-dark">
          Positions ({positions.length})
        </h2>
        <button
          onClick={fetchPositions}
          disabled={loading}
          className="text-xs text-text-secondary-dark dark:text-text-secondary-dark hover:text-text-primary-dark dark:hover:text-text-primary-dark transition-colors disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>
      <div className="space-y-12 max-h-[600px] overflow-y-auto">
        {positions.map((position) => (
          <PositionTile key={position.id} position={position} />
        ))}
      </div>
    </div>
  );
}
