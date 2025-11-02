'use client';

import { useState, useEffect } from 'react';
import { Clock, TrendingUp, TrendingDown, X, Target, StopCircle, History, ChevronRight } from 'lucide-react';
import { useTokens } from '@/hooks/useTokens';
import { useIsMobile } from '@/components/ui/use-mobile';
import { useThemeContext } from '@/components/providers/ThemeProvider';
import { useOrders } from '@/stores/useOrders';
import { useQuotes } from '@/stores/useQuotes';
import { useSchedule } from '@/stores/useSchedule';
import { Position, ScheduledBlock } from '@/types';

export function Dashboard() {
  const [mounted, setMounted] = useState(false);
  const isMobile = useIsMobile();
  const tokens = useTokens();
  const colors = tokens.colors;
  const { resolvedTheme } = useThemeContext();
  const { positions } = useOrders();
  const { blocks, getCurrentBlock, getNextBlock } = useSchedule();
  const [currentBlock, setCurrentBlock] = useState<ScheduledBlock | null>(null);
  const [nextBlock, setNextBlock] = useState<ScheduledBlock | null>(null);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    setMounted(true);
    setCurrentBlock(getCurrentBlock());
    setNextBlock(getNextBlock());
  }, [getCurrentBlock, getNextBlock]);

  // Update current/next blocks and time every second
  useEffect(() => {
    const interval = setInterval(() => {
      setNow(new Date());
      setCurrentBlock(getCurrentBlock());
      setNextBlock(getNextBlock());
    }, 1000);
    return () => clearInterval(interval);
  }, [getCurrentBlock, getNextBlock]);

  // Calculate KPIs from positions
  const openPositions = positions.filter(p => p.state !== 'CLOSED');
  const closedPositions = positions.filter(p => p.state === 'CLOSED');
  
  const netPL = closedPositions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  const openPL = openPositions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  
  // Calculate entry cost as avgPrice * qty * 100 (for options)
  const openEntryCost = openPositions.reduce((sum, p) => sum + (p.avgPrice * p.qty * 100), 0);
  const openPLPercent = openEntryCost > 0 ? (openPL / openEntryCost) * 100 : 0;
  
  const closedEntryCost = closedPositions.reduce((sum, p) => sum + (p.avgPrice * p.qty * 100), 0);
  const netPLPercent = closedEntryCost > 0 ? (netPL / closedEntryCost) * 100 : 0;
  
  const wins = closedPositions.filter(p => (p.pnl || 0) > 0).length;
  const losses = closedPositions.filter(p => (p.pnl || 0) <= 0).length;
  const winRate = wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0;

  // Mock timing metrics (would calculate from actual trade history)
  const avgTTFF = 1.8;
  const avgHold = 12.5;

  const sparkData = [10, 25, -15, 40, 35, 60, 45, 70, 85, 90];

  // Get time remaining in current block
  const getTimeRemaining = (blockEndTime: string): string => {
    if (!mounted) return '00:00';
    const [endHour, endMin] = blockEndTime.split(':').map(Number);
    const endMinutes = endHour * 60 + endMin;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const remaining = endMinutes - currentMinutes;
    const mins = Math.max(0, Math.floor(remaining));
    const secs = Math.max(0, 60 - now.getSeconds());
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  if (!mounted) {
    return (
      <div style={{ 
        minHeight: '100vh',
        backgroundColor: colors.bg,
        color: colors.textPrimary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: colors.bg,
      color: colors.textPrimary,
    }}>
      {/* Header */}
      <div style={{ 
        maxWidth: '1400px', 
        margin: '0 auto', 
        padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xl}px ${tokens.space.xl}px ${tokens.space.lg}px`,
      }}>
        <div style={{ 
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: isMobile ? `${tokens.space.md}px` : `${tokens.space.lg}px`,
        }}>
          {/* Title */}
          <div>
            <h1 style={{ 
              fontSize: isMobile ? `${tokens.type.sizes.lg}px` : `${tokens.type.sizes.xl}px`,
              color: colors.textPrimary,
              fontWeight: tokens.type.weights.semibold,
              margin: 0,
              marginBottom: `${tokens.space.xs}px`,
            }}>
              VibeSnipe
            </h1>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? `${tokens.space.sm}px` : `${tokens.space.md}px` }}>
            {/* Account Chip */}
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: `${tokens.space.sm}px`,
              padding: isMobile ? `${tokens.space.xs}px ${tokens.space.md}px` : `${tokens.space.sm}px ${tokens.space.lg}px`,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: `${tokens.radius.md}px`,
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: colors.semantic.profit,
                boxShadow: `0 0 0 2px ${colors.semantic.profit}20`,
              }} />
              <span style={{ 
                fontSize: `${tokens.type.sizes.sm}px`,
                color: colors.textPrimary,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {isMobile ? '#4521' : 'Account #4521'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ 
        maxWidth: '1400px',
        margin: '0 auto',
        padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xl}px`,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${tokens.space.xxl}px` }}>
          {/* Today's Roll-up */}
          <div>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: `${tokens.space.lg}px`,
            }}>
              <h2 style={{ 
                fontSize: `${tokens.type.sizes.lg}px`,
                color: colors.textPrimary,
                fontWeight: tokens.type.weights.medium,
                margin: 0,
              }}>
                Today's Roll-up
              </h2>
              <button
                onClick={() => {}}
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: `${tokens.space.xs}px`,
                  padding: `${tokens.space.xs}px ${tokens.space.md}px`,
                  fontSize: `${tokens.type.sizes.xs}px`,
                  borderRadius: `${tokens.space.sm}px`,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: 'transparent',
                  color: colors.textPrimary,
                  cursor: 'pointer',
                  transition: tokens.motion.base,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = colors.surface;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <History className="w-3 h-3" />
                View History
                <ChevronRight className="w-3 h-3" />
              </button>
            </div>

            <div style={{ 
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: `${tokens.space.lg}px`,
            }}>
              {/* Net P/L */}
              <div style={{ 
                padding: `${tokens.space.lg}px`,
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: `${tokens.radius.md}px`,
              }}>
                <div style={{ 
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: `${tokens.space.sm}px`,
                }}>
                  Net P/L
                </div>
                <div style={{ 
                  fontSize: `${tokens.type.sizes.xxl}px`,
                  color: netPL >= 0 ? colors.semantic.profit : colors.semantic.risk,
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: `${tokens.space.xs}px`,
                  fontWeight: tokens.type.weights.semibold,
                }}>
                  {netPL >= 0 ? '+' : ''}${netPL.toFixed(0)}
                </div>
                <div style={{ 
                  fontSize: `${tokens.type.sizes.sm}px`,
                  color: colors.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {netPLPercent >= 0 ? '+' : ''}{netPLPercent.toFixed(1)}%
                </div>
                
                {/* Spark */}
                <svg width="100%" height="24" style={{ marginTop: `${tokens.space.sm}px` }}>
                  <polyline
                    points={sparkData.map((v, i) => `${(i / (sparkData.length - 1)) * 100}%,${24 - ((v + 20) / 120) * 20}`).join(' ')}
                    fill="none"
                    stroke={colors.semantic.profit}
                    strokeWidth="1.5"
                  />
                </svg>
              </div>

              {/* Open P/L */}
              <div style={{ 
                padding: `${tokens.space.lg}px`,
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: `${tokens.radius.md}px`,
              }}>
                <div style={{ 
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: `${tokens.space.sm}px`,
                }}>
                  Open P/L
                </div>
                <div style={{ 
                  fontSize: `${tokens.type.sizes.xxl}px`,
                  color: openPL >= 0 ? colors.semantic.profit : colors.semantic.risk,
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: `${tokens.space.xs}px`,
                  fontWeight: tokens.type.weights.semibold,
                }}>
                  {openPL >= 0 ? '+' : ''}${openPL.toFixed(0)}
                </div>
                <div style={{ 
                  fontSize: `${tokens.type.sizes.sm}px`,
                  color: colors.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: `${tokens.space.xs}px`,
                }}>
                  {openPLPercent >= 0 ? '+' : ''}{openPLPercent.toFixed(1)}%
                </div>
                <div style={{ 
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  marginTop: `${tokens.space.sm}px`,
                }}>
                  {openPositions.length} position{openPositions.length !== 1 ? 's' : ''}
                </div>
              </div>

              {/* Win Rate */}
              <div style={{ 
                padding: `${tokens.space.lg}px`,
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: `${tokens.radius.md}px`,
              }}>
                <div style={{ 
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: `${tokens.space.sm}px`,
                }}>
                  Win Rate
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.lg}px` }}>
                  <svg width="60" height="60">
                    <circle
                      cx="30"
                      cy="30"
                      r="22"
                      fill="none"
                      stroke={colors.semantic.risk}
                      strokeWidth="8"
                      strokeDasharray={`${(losses / (wins + losses || 1)) * 138.23} 138.23`}
                    />
                    <circle
                      cx="30"
                      cy="30"
                      r="22"
                      fill="none"
                      stroke={colors.semantic.profit}
                      strokeWidth="8"
                      strokeDasharray={`${(wins / (wins + losses || 1)) * 138.23} 138.23`}
                      strokeDashoffset={`-${(losses / (wins + losses || 1)) * 138.23}`}
                      transform="rotate(-90 30 30)"
                    />
                  </svg>
                  
                  <div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.xl}px`,
                      color: colors.textPrimary,
                      fontVariantNumeric: 'tabular-nums',
                      marginBottom: `${tokens.space.xs}px`,
                      fontWeight: tokens.type.weights.semibold,
                    }}>
                      {winRate.toFixed(1)}%
                    </div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.xs}px`,
                      color: colors.textSecondary,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {wins}W / {losses}L
                    </div>
                  </div>
                </div>
              </div>

              {/* Timing */}
              <div style={{ 
                padding: `${tokens.space.lg}px`,
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: `${tokens.radius.md}px`,
              }}>
                <div style={{ 
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  marginBottom: `${tokens.space.lg}px`,
                }}>
                  Timing
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: `${tokens.space.md}px` }}>
                  <div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.xs}px`,
                      color: colors.textSecondary,
                      marginBottom: '2px',
                    }}>
                      Avg TTFF
                    </div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.lg}px`,
                      color: colors.textPrimary,
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: tokens.type.weights.medium,
                    }}>
                      {avgTTFF.toFixed(1)}m
                    </div>
                  </div>
                  
                  <div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.xs}px`,
                      color: colors.textSecondary,
                      marginBottom: '2px',
                    }}>
                      Avg Hold
                    </div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.lg}px`,
                      color: colors.textPrimary,
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: tokens.type.weights.medium,
                    }}>
                      {avgHold.toFixed(1)}m
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Trading Blocks */}
          <div>
            <h2 style={{ 
              fontSize: `${tokens.type.sizes.lg}px`,
              color: colors.textPrimary,
              fontWeight: tokens.type.weights.medium,
              marginBottom: `${tokens.space.lg}px`,
            }}>
              Trading Blocks
            </h2>
            <TradingBlocks 
              blocks={blocks} 
              currentBlock={currentBlock} 
              now={now} 
              getTimeRemaining={getTimeRemaining}
              isMobile={isMobile}
              tokens={tokens}
              colors={colors}
            />
          </div>

          {/* Open Positions */}
          <OpenPositions 
            positions={openPositions}
            isMobile={isMobile}
            tokens={tokens}
            colors={colors}
          />
        </div>
      </div>
    </div>
  );
}

interface TradingBlocksProps {
  blocks: any[];
  currentBlock: any;
  now: Date;
  getTimeRemaining: (time: string) => string;
  isMobile: boolean;
  tokens: any;
  colors: any;
}

function TradingBlocks({ blocks, currentBlock, now, getTimeRemaining, isMobile, tokens, colors }: TradingBlocksProps) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return (
    <div style={{ 
      display: 'grid',
      gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: `${tokens.space.md}px`,
    }}>
      {blocks.map((block) => {
        const [startHour, startMin] = (block.time || '09:30').split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = startMinutes + 30; // 30-minute blocks
        const blockEndTime = `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
        
        const isActive = currentMinutes >= startMinutes && currentMinutes < endMinutes;
        const isPast = currentMinutes >= endMinutes;
        const isFuture = currentMinutes < startMinutes;

        // Mock performance (would come from actual trade history)
        const performance = isPast ? (Math.random() > 0.5 ? 'win' : 'loss') : null;

        return (
          <div
            key={block.id}
            style={{
              padding: `${tokens.space.md}px ${tokens.space.lg}px`,
              borderRadius: `${tokens.radius.md}px`,
              border: `1px solid ${isActive ? colors.semantic.info + '60' : colors.border}`,
              backgroundColor: isActive 
                ? colors.semantic.info + '10'
                : isPast
                  ? colors.surface + '40'
                  : colors.surface,
              opacity: isPast ? 0.5 : 1,
            }}
          >
            <div style={{ 
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: `${tokens.type.sizes.base}px`,
              color: isActive ? colors.textPrimary : isPast ? colors.textSecondary : colors.textPrimary,
              fontVariantNumeric: 'tabular-nums',
              marginBottom: `${tokens.space.xs}px`,
            }}>
              <span>{block.time || '09:30'}-{blockEndTime}</span>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: isPast 
                  ? (performance === 'win' 
                      ? colors.semantic.profit 
                      : performance === 'loss'
                        ? colors.semantic.risk
                        : colors.semantic.info)
                  : colors.semantic.info,
                opacity: isPast ? 1 : 0.5,
              }} />
            </div>
            
            <div style={{ 
              fontSize: `${tokens.type.sizes.xs}px`,
              color: colors.textSecondary,
              marginBottom: isActive ? `${tokens.space.sm}px` : 0,
            }}>
              {block.underlying || 'SPX'} {block.strategy || 'Vertical'}
            </div>
            
            {isActive && (
              <div style={{ marginTop: `${tokens.space.sm}px` }}>
                <span 
                  style={{
                    display: 'inline-block',
                    padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                    borderRadius: `${tokens.space.xs}px`,
                    fontSize: `10px`,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: colors.semantic.info,
                    backgroundColor: colors.semantic.info + '20',
                    border: `1px solid ${colors.semantic.info}40`,
                  }}
                >
                  Active · {getTimeRemaining(blockEndTime)}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface OpenPositionsProps {
  positions: Position[];
  isMobile: boolean;
  tokens: any;
  colors: any;
}

function OpenPositions({ positions, isMobile, tokens, colors }: OpenPositionsProps) {
  const PLRing = ({ percent }: { percent: number }) => {
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
          stroke={colors.border}
          strokeWidth="2"
        />
        <circle
          cx="14"
          cy="14"
          r="10"
          fill="none"
          stroke={isProfit ? colors.semantic.profit : colors.semantic.risk}
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 14 14)"
        />
      </svg>
    );
  };

  const MiniCurve = ({ data }: { data: number[] }) => {
    if (!data || data.length === 0) return null;
    
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    
    const points = data.map((value, i) => {
      const x = (i / (data.length - 1)) * 40;
      const y = 16 - ((value - min) / range) * 12;
      return `${x},${y}`;
    }).join(' ');

    const lastValue = data[data.length - 1];
    const firstValue = data[0];
    const isProfit = lastValue > firstValue;

    return (
      <svg width="40" height="16" style={{ display: 'block' }}>
        <polyline
          points={points}
          fill="none"
          stroke={isProfit ? colors.semantic.profit : colors.semantic.risk}
          strokeWidth="1.5"
        />
      </svg>
    );
  };

  if (positions.length === 0) {
    return (
      <div>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: `${tokens.space.lg}px`,
        }}>
          <h2 style={{ 
            fontSize: `${tokens.type.sizes.lg}px`,
            color: colors.textPrimary,
            fontWeight: tokens.type.weights.medium,
            margin: 0,
          }}>
            Open Positions
          </h2>
          <span style={{ 
            fontSize: `${tokens.type.sizes.xs}px`,
            color: colors.textSecondary,
          }}>
            0 active
          </span>
        </div>
        <div style={{
          padding: `${tokens.space.xl}px`,
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: `${tokens.radius.md}px`,
          textAlign: 'center',
        }}>
          <p style={{ 
            fontSize: `${tokens.type.sizes.base}px`,
            color: colors.textSecondary,
          }}>
            No open positions
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: `${tokens.space.lg}px`,
      }}>
        <h2 style={{ 
          fontSize: `${tokens.type.sizes.lg}px`,
          color: colors.textPrimary,
          fontWeight: tokens.type.weights.medium,
          margin: 0,
        }}>
          Open Positions
        </h2>
        <span style={{ 
          fontSize: `${tokens.type.sizes.xs}px`,
          color: colors.textSecondary,
        }}>
          {positions.length} active {!isMobile && <kbd style={{ marginLeft: '8px', opacity: 0.7 }}>⌘P</kbd>}
        </span>
      </div>

      {isMobile ? (
        /* Mobile Card View */
        <div style={{ display: 'flex', flexDirection: 'column', gap: `${tokens.space.md}px` }}>
          {positions.map((pos) => {
            const entryCost = pos.avgPrice * pos.qty * 100;
            const plPercent = entryCost > 0 ? ((pos.pnl || 0) / entryCost) * 100 : 0;
            
            return (
              <div
                key={pos.id}
                style={{
                  padding: `${tokens.space.md}px`,
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: `${tokens.radius.md}px`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: `${tokens.space.md}px` }}>
                  <div>
                    <div style={{ fontSize: `${tokens.type.sizes.base}px`, color: colors.textPrimary, marginBottom: '2px' }}>
                      {pos.underlying || 'SPX'}
                    </div>
                    <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary }}>
                      {pos.strategy || 'Vertical'}
                    </div>
                  </div>
                  <PLRing percent={plPercent} />
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: `${tokens.space.md}px`, marginBottom: `${tokens.space.md}px` }}>
                  <div>
                    <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginBottom: '2px' }}>Qty</div>
                    <div style={{ fontSize: `${tokens.type.sizes.base}px`, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>{pos.qty || 0}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginBottom: '2px' }}>Entry</div>
                    <div style={{ fontSize: `${tokens.type.sizes.base}px`, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>${(pos.avgPrice || 0).toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginBottom: '2px' }}>P/L</div>
                    <div style={{ fontSize: `${tokens.type.sizes.base}px`, color: (pos.pnl || 0) >= 0 ? colors.semantic.profit : colors.semantic.risk, fontVariantNumeric: 'tabular-nums' }}>
                      {(pos.pnl || 0) >= 0 ? '+' : ''}${(pos.pnl || 0).toFixed(0)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginBottom: '2px' }}>State</div>
                    <span style={{ 
                      display: 'inline-block',
                      padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                      borderRadius: `${tokens.space.sm}px`,
                      fontSize: `${tokens.type.sizes.xs}px`,
                      backgroundColor: (pos.pnl || 0) > 0 ? colors.semantic.profit + '15' : (pos.pnl || 0) < 0 ? colors.semantic.risk + '15' : colors.border,
                      border: `1px solid ${(pos.pnl || 0) > 0 ? colors.semantic.profit + '40' : (pos.pnl || 0) < 0 ? colors.semantic.risk + '40' : colors.border}`,
                      color: (pos.pnl || 0) > 0 ? colors.semantic.profit : (pos.pnl || 0) < 0 ? colors.semantic.risk : colors.textSecondary,
                    }}>
                      {(pos.pnl || 0) > 0 ? 'Profit' : (pos.pnl || 0) < 0 ? 'Risk' : 'Neutral'}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', gap: `${tokens.space.xs}px` }}>
                  <button style={{ 
                    flex: 1, 
                    padding: `${tokens.space.sm}px`, 
                    fontSize: `${tokens.type.sizes.xs}px`, 
                    borderRadius: `${tokens.space.sm}px`, 
                    border: `1px solid ${colors.border}`, 
                    backgroundColor: 'transparent', 
                    color: colors.textPrimary, 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    gap: `${tokens.space.xs}px`,
                    transition: tokens.motion.base,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.surfaceAlt;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  >
                    <X className="w-3 h-3" />
                    Close
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Desktop Table View */
        <div style={{ 
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: `${tokens.radius.md}px`,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: '2fr 0.6fr 1fr 0.8fr 1.2fr 0.8fr 0.6fr 2fr',
            gap: `${tokens.space.lg}px`,
            padding: `${tokens.space.md}px ${tokens.space.lg}px`,
            borderBottom: `1px solid ${colors.border}`,
            fontSize: `${tokens.type.sizes.xs}px`,
            color: colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
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
          {positions.map((pos, index) => {
            const entryCost = pos.avgPrice * pos.qty * 100;
            const plPercent = entryCost > 0 ? ((pos.pnl || 0) / entryCost) * 100 : 0;
            const targetPrice = pos.avgPrice * (1 + (pos.ruleBundle?.takeProfitPct || 50) / 100); // TP from ruleBundle
            const stopPrice = pos.avgPrice * (1 - (pos.ruleBundle?.stopLossPct || 100) / 100); // SL from ruleBundle
            const currentPrice = pos.avgPrice + (pos.pnl || 0) / (pos.qty * 100); // Approximate current price
            // Generate mock curve data (would come from actual price history)
            const curveData = Array.from({ length: 7 }, (_, i) => {
              const progress = i / 6;
              return pos.avgPrice + (currentPrice - pos.avgPrice) * progress;
            });

            return (
              <div
                key={pos.id}
                style={{ 
                  display: 'grid',
                  gridTemplateColumns: '2fr 0.6fr 1fr 0.8fr 1.2fr 0.8fr 0.6fr 2fr',
                  gap: `${tokens.space.lg}px`,
                  padding: `${tokens.space.md}px ${tokens.space.lg}px`,
                  borderBottom: index < positions.length - 1 ? `1px solid ${colors.border}` : 'none',
                  alignItems: 'center',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = colors.border + '40'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {/* Symbol/Strategy */}
                <div>
                  <div style={{ 
                    fontSize: `${tokens.type.sizes.sm}px`,
                    color: colors.textPrimary,
                    marginBottom: '2px',
                  }}>
                    {pos.underlying || 'SPX'}
                  </div>
                  <div style={{ 
                    fontSize: `${tokens.type.sizes.xs}px`,
                    color: colors.textSecondary,
                  }}>
                    {pos.strategy || 'Vertical'}
                  </div>
                </div>

                {/* Qty */}
                <div style={{ 
                  fontSize: `${tokens.type.sizes.sm}px`,
                  color: colors.textPrimary,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {pos.qty || 0}
                </div>

                {/* Entry */}
                <div style={{ 
                  fontSize: `${tokens.type.sizes.sm}px`,
                  color: colors.textPrimary,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  ${(pos.avgPrice || 0).toFixed(2)}
                </div>

                {/* P/L */}
                <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.sm}px` }}>
                  <PLRing percent={plPercent} />
                  <div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.sm}px`,
                      color: (pos.pnl || 0) >= 0 ? colors.semantic.profit : colors.semantic.risk,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {(pos.pnl || 0) >= 0 ? '+' : ''}${(pos.pnl || 0).toFixed(0)}
                    </div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.xs}px`,
                      color: colors.textSecondary,
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      {plPercent >= 0 ? '+' : ''}{plPercent.toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* TP/SL Bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: `${tokens.space.xs}px` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.xs}px` }}>
                    <span style={{ 
                      fontSize: `${tokens.type.sizes.xs}px`,
                      color: colors.textSecondary,
                      width: '20px',
                    }}>
                      TP
                    </span>
                    <div style={{ 
                      flex: 1,
                      height: '4px',
                      backgroundColor: colors.border,
                      borderRadius: '2px',
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      <div style={{ 
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${Math.min(100, Math.max(0, ((currentPrice - pos.avgPrice) / (targetPrice - pos.avgPrice)) * 100))}%`,
                        backgroundColor: colors.semantic.profit,
                        borderRadius: '2px',
                      }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.xs}px` }}>
                    <span style={{ 
                      fontSize: `${tokens.type.sizes.xs}px`,
                      color: colors.textSecondary,
                      width: '20px',
                    }}>
                      SL
                    </span>
                    <div style={{ 
                      flex: 1,
                      height: '4px',
                      backgroundColor: colors.border,
                      borderRadius: '2px',
                      position: 'relative',
                      overflow: 'hidden',
                    }}>
                      <div style={{ 
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: `${Math.max(0, Math.min(100, ((pos.avgPrice - currentPrice) / (pos.avgPrice - stopPrice)) * 100))}%`,
                        backgroundColor: colors.semantic.risk,
                        borderRadius: '2px',
                      }} />
                    </div>
                  </div>
                </div>

                {/* State Chip */}
                <div>
                  <span style={{ 
                    display: 'inline-block',
                    padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                    borderRadius: `${tokens.space.lg}px`,
                    fontSize: `${tokens.type.sizes.xs}px`,
                    backgroundColor: (pos.pnl || 0) > 0 
                      ? colors.semantic.profit + '15'
                      : (pos.pnl || 0) < 0
                        ? colors.semantic.risk + '15'
                        : colors.border,
                    border: `1px solid ${(pos.pnl || 0) > 0 
                      ? colors.semantic.profit + '40'
                      : (pos.pnl || 0) < 0
                        ? colors.semantic.risk + '40'
                        : colors.border}`,
                    color: (pos.pnl || 0) > 0 
                      ? colors.semantic.profit
                      : (pos.pnl || 0) < 0
                        ? colors.semantic.risk
                        : colors.textSecondary,
                  }}>
                    {(pos.pnl || 0) > 0 ? 'Profit' : (pos.pnl || 0) < 0 ? 'Risk' : 'Neutral'}
                  </span>
                </div>

                {/* Mini Curve */}
                <div>
                  <MiniCurve data={curveData} />
                </div>

                {/* Actions */}
                <div style={{ 
                  display: 'flex', 
                  gap: `${tokens.space.xs}px`,
                  justifyContent: 'flex-end',
                }}>
                  <button
                    onClick={() => {}}
                    style={{ 
                      padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                      fontSize: `${tokens.type.sizes.xs}px`,
                      borderRadius: `${tokens.space.sm}px`,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: 'transparent',
                      color: colors.textPrimary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: `${tokens.space.xs}px`,
                      transition: tokens.motion.base,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.surfaceAlt;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <X className="w-3 h-3" />
                    Close
                  </button>
                  <button
                    onClick={() => {}}
                    style={{ 
                      padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                      fontSize: `${tokens.type.sizes.xs}px`,
                      borderRadius: `${tokens.space.sm}px`,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: 'transparent',
                      color: colors.textPrimary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: `${tokens.space.xs}px`,
                      transition: tokens.motion.base,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.surfaceAlt;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <Target className="w-3 h-3" />
                    TP
                  </button>
                  <button
                    onClick={() => {}}
                    style={{ 
                      padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                      fontSize: `${tokens.type.sizes.xs}px`,
                      borderRadius: `${tokens.space.sm}px`,
                      border: `1px solid ${colors.border}`,
                      backgroundColor: 'transparent',
                      color: colors.textPrimary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: `${tokens.space.xs}px`,
                      transition: tokens.motion.base,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.surfaceAlt;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <StopCircle className="w-3 h-3" />
                    SL
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
