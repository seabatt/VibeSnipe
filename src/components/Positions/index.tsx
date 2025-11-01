'use client';

import { useOrders } from '@/stores/useOrders';
import { Position } from '@/types';
import { RiskGraph } from '../RiskGraph';

function PositionTile({ position }: { position: Position }) {
  const { updatePosition, removePosition } = useOrders();
  const pnlPercent = position.avgPrice > 0 ? (position.pnl / (position.avgPrice * position.qty * 100)) * 100 : 0;

  const handleClose = () => {
    // Close position at mid price
    updatePosition(position.id, { state: 'CLOSED' });
    setTimeout(() => removePosition(position.id), 100);
  };

  const handleChangeTarget = () => {
    const newTp = prompt('New Take Profit %:', position.ruleBundle.takeProfitPct.toString());
    if (newTp) {
      updatePosition(position.id, {
        ruleBundle: {
          ...position.ruleBundle,
          takeProfitPct: parseInt(newTp) || position.ruleBundle.takeProfitPct,
        },
      });
    }
  };

  const handleChangeStop = () => {
    const newSl = prompt('New Stop Loss %:', position.ruleBundle.stopLossPct.toString());
    if (newSl) {
      updatePosition(position.id, {
        ruleBundle: {
          ...position.ruleBundle,
          stopLossPct: parseInt(newSl) || position.ruleBundle.stopLossPct,
        },
      });
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
  const { positions } = useOrders();

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
      </div>
      <div className="space-y-12 max-h-[600px] overflow-y-auto">
        {positions.map((position) => (
          <PositionTile key={position.id} position={position} />
        ))}
      </div>
    </div>
  );
}
