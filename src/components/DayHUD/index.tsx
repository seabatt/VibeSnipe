'use client';

import { useEffect, useState } from 'react';
import { useSchedule } from '@/stores/useSchedule';
import { useOrders } from '@/stores/useOrders';
import { useQuotes } from '@/stores/useQuotes';
import { Underlying } from '@/types';

export function DayHUD() {
  const { currentBlock, nextBlock, getCurrentBlock, getNextBlock, activeUnderlying, setActiveUnderlying } = useSchedule();
  const { positions } = useOrders();
  const { getQuote } = useQuotes();
  const [countdown, setCountdown] = useState<number | null>(null);
  const [scalpCount, setScalpCount] = useState(0);
  const [exposure, setExposure] = useState({ spx: 0, qqq: 0 });

  useEffect(() => {
    const interval = setInterval(() => {
      const block = getCurrentBlock();
      getNextBlock();

      if (block) {
        const now = new Date();
        const [startHour, startMin] = block.windowStart.split(':').map(Number);
        const [endHour, endMin] = block.windowEnd.split(':').map(Number);
        const blockStart = new Date();
        blockStart.setHours(startHour, startMin, 0, 0);
        const blockEnd = new Date();
        blockEnd.setHours(endHour, endMin, 0, 0);
        
        if (now >= blockStart && now < blockEnd) {
          const remaining = blockEnd.getTime() - now.getTime();
          setCountdown(Math.floor(remaining / 1000));
        } else {
          setCountdown(null);
        }
      } else {
        setCountdown(null);
      }

      // Calculate exposure
      const spxExposure = positions
        .filter((p) => p.underlying === 'SPX')
        .reduce((sum, p) => sum + p.avgPrice * p.qty * 100, 0);
      
      const qqqExposure = positions
        .filter((p) => p.underlying === 'QQQ')
        .reduce((sum, p) => sum + p.avgPrice * p.qty * 100, 0);

      setExposure({ spx: spxExposure, qqq: qqqExposure });
    }, 100);

    return () => clearInterval(interval);
  }, [getCurrentBlock, getNextBlock, positions]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const spxQuote = getQuote('SPX');
  const qqqQuote = getQuote('QQQ');

  return (
    <div className="space-y-16">
      {/* Dual 13:30 Tabs */}
      <div className="flex gap-4 border-b border-border-dark dark:border-border-dark">
        <button
          onClick={() => setActiveUnderlying('SPX')}
          className={`px-12 py-8 text-sm font-medium border-b-2 transition-colors duration-200 ${
            activeUnderlying === 'SPX'
              ? 'border-info text-info'
              : 'border-transparent text-text-secondary-dark dark:text-text-secondary-dark hover:text-text-primary-dark dark:hover:text-text-primary-dark'
          }`}
        >
          SPX 13:30
        </button>
        <button
          onClick={() => setActiveUnderlying('QQQ')}
          className={`px-12 py-8 text-sm font-medium border-b-2 transition-colors duration-200 ${
            activeUnderlying === 'QQQ'
              ? 'border-info text-info'
              : 'border-transparent text-text-secondary-dark dark:text-text-secondary-dark hover:text-text-primary-dark dark:hover:text-text-primary-dark'
          }`}
        >
          QQQ 13:30
        </button>
      </div>

      {/* Current Block Info */}
      {currentBlock ? (
        <div className="space-y-12">
          <div className="px-12 py-8 bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-12">
            <div className="text-xs text-text-secondary-dark dark:text-text-secondary-dark mb-4">
              Current Block
            </div>
            <div className="text-sm font-medium text-text-primary-dark dark:text-text-primary-dark">
              {currentBlock.label} — {currentBlock.strategy}
            </div>
            <div className="text-xs text-text-secondary-dark dark:text-text-secondary-dark mt-4">
              {currentBlock.underlying}
            </div>
          </div>

          {/* Countdown */}
          {countdown !== null && (
            <div className="px-12 py-8 bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-12">
              <div className="text-xs text-text-secondary-dark dark:text-text-secondary-dark mb-4">
                Countdown
              </div>
              <div className="text-2xl font-bold tabular-nums text-info">
                {formatTime(countdown)}
              </div>
            </div>
          )}

          {/* Strategy Rules */}
          <div className="px-12 py-8 bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-12">
            <div className="text-xs text-text-secondary-dark dark:text-text-secondary-dark mb-8">
              Rules
            </div>
            <div className="flex flex-wrap gap-4">
              {currentBlock.rules && (
                <>
                  <span className="px-8 py-4 bg-info/20 text-info text-xs rounded-12">
                    TP: {currentBlock.rules.tpPct}%
                  </span>
                  <span className="px-8 py-4 bg-risk/20 text-risk text-xs rounded-12">
                    SL: {currentBlock.rules.slPct}%
                  </span>
                  {currentBlock.rules.timeExitEt && (
                    <span className="px-8 py-4 bg-warning/20 text-warning text-xs rounded-12">
                      Time: {currentBlock.rules.timeExitEt}
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Scalp Counter */}
          <div className="px-12 py-8 bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-12">
            <div className="text-xs text-text-secondary-dark dark:text-text-secondary-dark mb-4">
              Scalp Counter
            </div>
            <div className="text-lg font-bold tabular-nums text-text-primary-dark dark:text-text-primary-dark">
              {scalpCount} / 3
            </div>
          </div>
        </div>
      ) : (
        <div className="px-12 py-8 bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-12 text-text-secondary-dark dark:text-text-secondary-dark text-sm text-center">
          No active block
        </div>
      )}

      {/* Exposure Meters */}
      <div className="space-y-8">
        <div className="text-xs text-text-secondary-dark dark:text-text-secondary-dark font-medium">
          Exposure
        </div>
        <div className="space-y-8">
          <div>
            <div className="flex justify-between text-xs text-text-secondary-dark dark:text-text-secondary-dark mb-4">
              <span>SPX</span>
              <span className="tabular-nums">${exposure.spx.toFixed(0)}</span>
            </div>
            <div className="h-2 bg-border-dark dark:bg-border-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-info transition-all duration-200"
                style={{ width: `${Math.min(100, (exposure.spx / 10000) * 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-text-secondary-dark dark:text-text-secondary-dark mb-4">
              <span>QQQ</span>
              <span className="tabular-nums">${exposure.qqq.toFixed(0)}</span>
            </div>
            <div className="h-2 bg-border-dark dark:bg-border-dark rounded-full overflow-hidden">
              <div
                className="h-full bg-info transition-all duration-200"
                style={{ width: `${Math.min(100, (exposure.qqq / 10000) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Next Block */}
      {nextBlock && (
        <div className="px-12 py-8 bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-12">
          <div className="text-xs text-text-secondary-dark dark:text-text-secondary-dark mb-4">
            Next Block
          </div>
          <div className="text-sm font-medium text-text-primary-dark dark:text-text-primary-dark">
            {nextBlock.time} — {nextBlock.strategy}
          </div>
          <div className="text-xs text-text-secondary-dark dark:text-text-secondary-dark mt-4">
            {nextBlock.underlying}
          </div>
        </div>
      )}

      {/* Underlying Prices */}
      <div className="space-y-8 pt-12 border-t border-border-dark dark:border-border-dark">
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-secondary-dark dark:text-text-secondary-dark">SPX</span>
          <span className="text-sm font-medium tabular-nums text-text-primary-dark dark:text-text-primary-dark">
            {spxQuote?.last.toFixed(2) || '—'}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-xs text-text-secondary-dark dark:text-text-secondary-dark">QQQ</span>
          <span className="text-sm font-medium tabular-nums text-text-primary-dark dark:text-text-primary-dark">
            {qqqQuote?.last.toFixed(2) || '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
