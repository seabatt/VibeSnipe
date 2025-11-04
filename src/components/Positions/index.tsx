'use client';

import { useEffect, useState, useCallback } from 'react';
import { Position } from '@/types';
import { X, Target, StopCircle } from 'lucide-react';

// Design tokens matching Figma
const TOKENS = {
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { md: 12, lg: 16 },
  type: { xs: 12, sm: 14, base: 16, lg: 18, xl: 24, xxl: 32 },
  color: {
    semantic: {
      profit: '#82D895',
      risk: '#EC612B',
    }
  }
};

// Helper function to extract symbol and strategy separately
function getSymbolAndStrategy(position: Position): { symbol: string; strategy: string } {
  if (position.strategy === 'SPOT') {
    return { symbol: position.underlying, strategy: '' };
  }
  
  // For spreads, extract strikes
  const strikes = position.legs
    .filter(leg => leg.strike > 0)
    .map(leg => leg.strike)
    .sort((a, b) => a - b);
  
  if (strikes.length === 0) {
    return { symbol: position.underlying, strategy: position.strategy };
  }
  
  // For butterfly, show all strikes
  if (position.strategy === 'Butterfly' && strikes.length === 3) {
    const callOrPut = position.legs[0]?.right === 'CALL' ? 'Call' : 'Put';
    return {
      symbol: position.underlying,
      strategy: `${strikes[0]}/${strikes[1]}/${strikes[2]} ${callOrPut} ${position.strategy}`
    };
  }
  
  // For vertical, show two strikes
  if (position.strategy === 'Vertical' && strikes.length >= 2) {
    const uniqueStrikes = [...new Set(strikes)];
    const callOrPut = position.legs[0]?.right === 'CALL' ? 'Call' : 'Put';
    if (uniqueStrikes.length === 2) {
      return {
        symbol: position.underlying,
        strategy: `${uniqueStrikes[0]}/${uniqueStrikes[1]} ${callOrPut} ${position.strategy}`
      };
    }
    return {
      symbol: position.underlying,
      strategy: `${uniqueStrikes[0]}/${uniqueStrikes[uniqueStrikes.length - 1]} ${callOrPut} ${position.strategy}`
    };
  }
  
  return { symbol: position.underlying, strategy: position.strategy };
}

// Helper function to determine state (Profit, Risk, Neutral)
function getPositionState(position: Position): 'profit' | 'risk' | 'neutral' {
  if (position.pnl > 0) return 'profit';
  if (position.pnl < 0) return 'risk';
  return 'neutral';
}

// P/L Ring component matching Figma (28x28px, 10px radius)
function PLRing({ percent }: { percent: number }) {
  const isProfit = percent >= 0;
  const absPercent = Math.min(Math.abs(percent), 100);
  const circumference = 2 * Math.PI * 10;
  const offset = circumference - (absPercent / 100) * circumference;

  return (
    <svg width="28" height="28">
      <circle
        cx="14"
        cy="14"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-border-dark dark:text-border-dark"
      />
      <circle
        cx="14"
        cy="14"
        r="10"
        fill="none"
        stroke={isProfit ? TOKENS.color.semantic.profit : TOKENS.color.semantic.risk}
        strokeWidth="2"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 14 14)"
      />
    </svg>
  );
}

// MiniCurve component matching Figma (40x16px polyline)
function MiniCurve({ data }: { data: number[] }) {
  if (!data || data.length === 0) {
    // Generate simple curve from P/L direction
    const isProfit = data && data.length > 0 ? data[data.length - 1] > data[0] : false;
    return (
      <svg width="40" height="16" style={{ display: 'block' }}>
        <polyline
          points={isProfit ? "0,12 8,8 16,6 24,4 32,4 40,4" : "0,4 8,6 16,8 24,10 32,12 40,12"}
          fill="none"
          stroke={isProfit ? TOKENS.color.semantic.profit : TOKENS.color.semantic.risk}
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 40;
    const y = 16 - ((value - min) / range) * 12;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="40" height="16" style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={data[data.length - 1] > data[0] ? TOKENS.color.semantic.profit : TOKENS.color.semantic.risk}
        strokeWidth="1.5"
      />
    </svg>
  );
}

function PositionRow({ position, index, total }: { position: Position; index: number; total: number }) {
  const pnlPercent = position.avgPrice > 0 && position.qty > 0 
    ? (position.pnl / (position.avgPrice * position.qty * (position.strategy === 'SPOT' ? 1 : 100))) * 100 
    : 0;
  
  const state = getPositionState(position);
  const { symbol, strategy } = getSymbolAndStrategy(position);

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

  // Calculate TP/SL progress using Figma formula
  // TP: ((current - entry) / (target - entry)) * 100
  // SL: ((entry - current) / (entry - stop)) * 100
  // For now, use simplified calculation based on P/L
  const currentPrice = position.avgPrice + (position.pnl / (position.qty * (position.strategy === 'SPOT' ? 1 : 100)));
  const targetPrice = position.avgPrice * (1 + position.ruleBundle.takeProfitPct / 100);
  const stopPrice = position.avgPrice * (1 - position.ruleBundle.stopLossPct / 100);
  
  const tpProgress = position.pnl > 0 && targetPrice > position.avgPrice
    ? Math.max(0, Math.min(100, ((currentPrice - position.avgPrice) / (targetPrice - position.avgPrice)) * 100))
    : 0;
  
  const slProgress = position.pnl < 0 && stopPrice < position.avgPrice
    ? Math.max(0, Math.min(100, ((position.avgPrice - currentPrice) / (position.avgPrice - stopPrice)) * 100))
    : 0;

  // Generate curve data (simplified - would need actual historical data)
  const curveData = position.pnl >= 0 
    ? [position.avgPrice * 0.9, position.avgPrice * 0.92, position.avgPrice * 0.95, position.avgPrice * 0.97, position.avgPrice * 0.99, currentPrice, currentPrice]
    : [position.avgPrice * 1.1, position.avgPrice * 1.08, position.avgPrice * 1.05, position.avgPrice * 1.03, position.avgPrice * 1.01, currentPrice, currentPrice];

  return (
    <div
      className={`grid items-center transition-colors ${index < total - 1 ? 'border-b border-border-dark dark:border-border-dark' : ''}`}
      style={{
        gridTemplateColumns: '2fr 0.6fr 1fr 0.8fr 1.2fr 0.8fr 0.6fr 2fr',
        padding: `${TOKENS.space.md}px ${TOKENS.space.lg}px`,
        gap: `${TOKENS.space.lg}px`,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'rgba(35, 39, 52, 0.4)'; // border + 40 opacity
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      {/* Symbol/Strategy */}
      <div>
        <div 
          className="text-text-primary-dark dark:text-text-primary-dark"
          style={{ 
            fontSize: `${TOKENS.type.sm}px`,
            marginBottom: '2px',
          }}
        >
          {symbol}
        </div>
        {strategy && (
          <div 
            className="text-text-secondary-dark dark:text-text-secondary-dark"
            style={{ 
              fontSize: `${TOKENS.type.xs}px`,
            }}
          >
            {strategy}
          </div>
        )}
      </div>

      {/* Qty */}
      <div 
        className="text-text-primary-dark dark:text-text-primary-dark tabular-nums"
        style={{ 
          fontSize: `${TOKENS.type.sm}px`,
        }}
      >
        {position.qty}
      </div>

      {/* Entry */}
      <div 
        className="text-text-primary-dark dark:text-text-primary-dark tabular-nums"
        style={{ 
          fontSize: `${TOKENS.type.sm}px`,
        }}
      >
        ${position.avgPrice.toFixed(2)}
      </div>

      {/* P/L */}
      <div className="flex items-center gap-2">
        <PLRing percent={pnlPercent} />
        <div>
          <div 
            className="tabular-nums"
            style={{ 
              fontSize: `${TOKENS.type.sm}px`,
              color: position.pnl >= 0 ? TOKENS.color.semantic.profit : TOKENS.color.semantic.risk,
            }}
          >
            {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
          </div>
          <div 
            className="text-text-secondary-dark dark:text-text-secondary-dark tabular-nums"
            style={{ 
              fontSize: `${TOKENS.type.xs}px`,
            }}
          >
            {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* TP/SL Bars */}
      <div className="flex flex-col gap-1">
        {/* TP Bar */}
        <div className="flex items-center gap-1">
          <span 
            className="text-text-secondary-dark dark:text-text-secondary-dark"
            style={{ 
              fontSize: `${TOKENS.type.xs}px`,
              width: '20px',
            }}
          >
            TP
          </span>
          <div 
            className="bg-border-dark dark:bg-border-dark rounded-sm relative overflow-hidden"
            style={{ 
              flex: 1,
              height: '4px',
              borderRadius: '2px',
            }}
          >
            <div 
              className="bg-profit transition-all duration-200"
              style={{ 
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${Math.max(0, Math.min(100, tpProgress))}%`,
                borderRadius: '2px',
              }}
            />
          </div>
        </div>
        {/* SL Bar */}
        <div className="flex items-center gap-1">
          <span 
            className="text-text-secondary-dark dark:text-text-secondary-dark"
            style={{ 
              fontSize: `${TOKENS.type.xs}px`,
              width: '20px',
            }}
          >
            SL
          </span>
          <div 
            className="bg-border-dark dark:bg-border-dark rounded-sm relative overflow-hidden"
            style={{ 
              flex: 1,
              height: '4px',
              borderRadius: '2px',
            }}
          >
            <div 
              className="bg-risk transition-all duration-200"
              style={{ 
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${Math.max(0, Math.min(100, slProgress))}%`,
                borderRadius: '2px',
              }}
            />
          </div>
        </div>
      </div>

      {/* State Chip */}
      <div>
        <span 
          className="inline-block text-center tabular-nums"
          style={{ 
            padding: `${TOKENS.space.xs}px ${TOKENS.space.sm}px`,
            borderRadius: `${TOKENS.space.lg}px`,
            fontSize: `${TOKENS.type.xs}px`,
            backgroundColor: state === 'profit' 
              ? TOKENS.color.semantic.profit + '15'
              : state === 'risk'
                ? TOKENS.color.semantic.risk + '15'
                : 'rgba(35, 39, 52, 1)', // border color
            border: `1px solid ${state === 'profit' 
              ? TOKENS.color.semantic.profit + '40'
              : state === 'risk'
                ? TOKENS.color.semantic.risk + '40'
                : 'rgba(35, 39, 52, 1)'}`,
            color: state === 'profit' 
              ? TOKENS.color.semantic.profit
              : state === 'risk'
                ? TOKENS.color.semantic.risk
                : 'rgb(169, 175, 195)', // textSecondary
          }}
        >
          {state === 'profit' ? 'Profit' : state === 'risk' ? 'Risk' : 'Neutral'}
        </span>
      </div>

      {/* Mini Curve */}
      <div>
        <MiniCurve data={curveData} />
      </div>

      {/* Actions */}
      <div 
        className="flex gap-1 justify-end"
      >
        <button
          onClick={handleClose}
          className="flex items-center gap-1 px-2 py-1 text-text-primary-dark dark:text-text-primary-dark hover:text-text-primary-dark dark:hover:text-text-primary-dark transition-colors border border-border-dark dark:border-border-dark rounded-sm bg-transparent"
          style={{
            fontSize: `${TOKENS.type.xs}px`,
          }}
        >
          <X className="w-3 h-3" />
          Close
        </button>
        <button
          onClick={handleTP}
          className="flex items-center gap-1 px-2 py-1 text-text-primary-dark dark:text-text-primary-dark hover:text-text-primary-dark dark:hover:text-text-primary-dark transition-colors border border-border-dark dark:border-border-dark rounded-sm bg-transparent"
          style={{
            fontSize: `${TOKENS.type.xs}px`,
          }}
        >
          <Target className="w-3 h-3" />
          TP
        </button>
        <button
          onClick={handleSL}
          className="flex items-center gap-1 px-2 py-1 text-text-primary-dark dark:text-text-primary-dark hover:text-text-primary-dark dark:hover:text-text-primary-dark transition-colors border border-border-dark dark:border-border-dark rounded-sm bg-transparent"
          style={{
            fontSize: `${TOKENS.type.xs}px`,
          }}
        >
          <StopCircle className="w-3 h-3" />
          SL
        </button>
      </div>
    </div>
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
    <div>
      <div 
        className="flex items-center justify-between mb-4"
      >
        <h2 
          className="text-text-primary-dark dark:text-text-primary-dark"
          style={{ 
            fontSize: `${TOKENS.type.lg}px`,
          }}
        >
          Open Positions
        </h2>
        <span 
          className="text-text-secondary-dark dark:text-text-secondary-dark"
          style={{ 
            fontSize: `${TOKENS.type.xs}px`,
          }}
        >
          {positions.length} active
        </span>
      </div>

      {/* Desktop Table View - CSS Grid */}
      <div 
        className="bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-12 overflow-hidden"
      >
        {/* Header */}
        <div 
          className="grid gap-4 border-b border-border-dark dark:border-border-dark bg-surface-dark/50"
          style={{
            gridTemplateColumns: '2fr 0.6fr 1fr 0.8fr 1.2fr 0.8fr 0.6fr 2fr',
            padding: `${TOKENS.space.md}px ${TOKENS.space.lg}px`,
            fontSize: `${TOKENS.type.xs}px`,
            color: 'rgb(169, 175, 195)', // textSecondary
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <div>Symbol / Strategy</div>
          <div>Qty</div>
          <div>Entry</div>
          <div>P/L</div>
          <div>TP / SL</div>
          <div>State</div>
          <div>Curve</div>
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>

        {/* Rows */}
        {positions.map((position, index) => (
          <PositionRow 
            key={position.id} 
            position={position} 
            index={index}
            total={positions.length}
          />
        ))}
      </div>
    </div>
  );
}
