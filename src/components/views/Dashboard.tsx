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
import { Positions } from '@/components/Positions';

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
  const [todayTrades, setTodayTrades] = useState<any[]>([]);
  const [loadingTodayTrades, setLoadingTodayTrades] = useState(false);

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

  // Fetch today's trades
  useEffect(() => {
    const fetchTodayTrades = async () => {
      try {
        setLoadingTodayTrades(true);
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(`/api/tastytrade/orders/history?startDate=${today}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Dashboard today trades API response:', {
            tradesCount: data.trades?.length || 0,
            count: data.count,
            errorDetails: data.errorDetails,
            debug: data.debug,
          });
          
          if (data.errorDetails) {
            console.error('Dashboard API error details:', data.errorDetails);
          }
          
          setTodayTrades(data.trades || []);
        } else {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          console.error('Dashboard today trades API error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
        }
      } catch (error) {
        console.error('Failed to fetch today\'s trades:', error);
      } finally {
        setLoadingTodayTrades(false);
      }
    };

    fetchTodayTrades();
    // Refresh today's trades every 30 seconds
    const interval = setInterval(fetchTodayTrades, 30000);
    return () => clearInterval(interval);
  }, []);

  // Calculate KPIs from positions
  // Handle both 'CLOSED' and 'FILLED' states for closed positions
  const openPositions = positions.filter(p => p.state !== 'CLOSED' && p.state !== 'FILLED');
  const closedPositions = positions.filter(p => p.state === 'CLOSED' || p.state === 'FILLED');
  
  // Debug logging
  console.log('Dashboard KPI calculations:', {
    totalPositions: positions.length,
    openPositions: openPositions.length,
    closedPositions: closedPositions.length,
    todayTrades: todayTrades.length,
    positionsWithPnl: positions.filter(p => p.pnl !== undefined && p.pnl !== 0).length,
    openPositionsWithPnl: openPositions.filter(p => p.pnl !== undefined && p.pnl !== 0).length,
    sampleOpenPosition: openPositions[0] ? {
      id: openPositions[0].id,
      pnl: openPositions[0].pnl,
      state: openPositions[0].state,
    } : null,
  });
  
  // Calculate today's net P/L from today's trades
  const todayNetPL = todayTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
  
  // Calculate overall net P/L from closed positions (for historical context)
  const overallNetPL = closedPositions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  
  // Use today's net P/L OR open P/L if no trades today
  // If we have open positions with P/L, use that as fallback
  const openPL = openPositions.reduce((sum, p) => sum + (p.pnl || 0), 0);
  
  // Prioritize: today's trades P/L > open positions P/L > closed positions P/L
  const netPL = todayNetPL !== 0 ? todayNetPL : (openPL !== 0 ? openPL : overallNetPL);
  
  // Calculate entry cost as avgPrice * qty * 100 (for options)
  const openEntryCost = openPositions.reduce((sum, p) => sum + (p.avgPrice * p.qty * 100), 0);
  const openPLPercent = openEntryCost > 0 ? (openPL / openEntryCost) * 100 : 0;
  
  // Calculate net P/L percentage from today's trades
  const todayEntryCost = todayTrades.reduce((sum, trade) => sum + (trade.entryCredit || 0), 0);
  const netPLPercent = todayEntryCost > 0 ? (netPL / todayEntryCost) * 100 : 0;
  
  // Calculate win rate from today's trades
  const todayWins = todayTrades.filter(t => (t.profitLoss || 0) > 0).length;
  const todayLosses = todayTrades.filter(t => (t.profitLoss || 0) <= 0).length;
  const winRate = todayWins + todayLosses > 0 ? (todayWins / (todayWins + todayLosses)) * 100 : 0;
  
  console.log('Dashboard calculated values:', {
    netPL,
    openPL,
    todayNetPL,
    overallNetPL,
    todayWins,
    todayLosses,
    winRate,
  });

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

  // Check if market is open (9:30 AM - 4:00 PM ET, weekdays only)
  const isMarketOpen = (): boolean => {
    const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
    const hours = et.getHours();
    const minutes = et.getMinutes();
    const currentMinutes = hours * 60 + minutes;
    
    // Market hours: 9:30 AM - 4:00 PM ET (930 minutes - 960 minutes)
    const marketOpen = 930; // 9:30 AM
    const marketClose = 960; // 4:00 PM
    
    // Check if it's a weekday (Monday-Friday = 1-5)
    const dayOfWeek = et.getDay();
    const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
    
    return isWeekday && currentMinutes >= marketOpen && currentMinutes < marketClose;
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
                  textAlign: 'left',
                }}>
                  Win Rate
                </div>
                
                <div style={{ 
                  fontSize: `${tokens.type.sizes.xl}px`,
                  color: colors.textPrimary,
                  fontVariantNumeric: 'tabular-nums',
                  marginBottom: `${tokens.space.xs}px`,
                  fontWeight: tokens.type.weights.semibold,
                  textAlign: 'left',
                }}>
                  {winRate.toFixed(1)}%
                </div>
                
                <div style={{ 
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  fontVariantNumeric: 'tabular-nums',
                  textAlign: 'left',
                }}>
                  {todayWins}W / {todayLosses}L
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
              nextBlock={nextBlock}
              now={now} 
              getTimeRemaining={getTimeRemaining}
              isMobile={isMobile}
              tokens={tokens}
              colors={colors}
              positions={positions}
              isMarketOpen={isMarketOpen()}
            />
          </div>

          {/* Open Positions */}
          <div>
            <Positions />
          </div>
        </div>
      </div>
    </div>
  );
}

interface TradingBlocksProps {
  blocks: any[];
  currentBlock: any;
  nextBlock: any;
  now: Date;
  getTimeRemaining: (time: string) => string;
  isMobile: boolean;
  tokens: any;
  colors: any;
  positions: Position[];
  isMarketOpen: boolean;
}

function TradingBlocks({ blocks, currentBlock, nextBlock, now, getTimeRemaining, isMobile, tokens, colors, positions, isMarketOpen }: TradingBlocksProps) {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  // Helper function to convert 24-hour to 12-hour format
  const formatTo12Hour = (time24: string): string => {
    const [hours, minutes] = time24.split(':').map(Number);
    const hour12 = hours % 12 || 12; // Convert 0 to 12, 13 to 1, etc.
    return `${hour12}:${String(minutes).padStart(2, '0')}`;
  };

  // Helper function to get time until a block starts
  const getTimeUntilStart = (blockStartTime: string): string => {
    const [startHour, startMin] = blockStartTime.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const remaining = startMinutes - currentMinutes;
    const mins = Math.max(0, Math.floor(remaining));
    const secs = Math.max(0, 60 - now.getSeconds());
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Helper function to get positions for a specific block
  const getBlockPositions = (block: any) => {
    return positions.filter(pos => {
      // Match underlying and strategy
      if (pos.underlying !== block.underlying || pos.strategy !== block.strategy) {
        return false;
      }
      
      // Check if position was opened during this block's time window
      const openedAt = new Date(pos.openedAt);
      const openedMinutes = openedAt.getHours() * 60 + openedAt.getMinutes();
      const [startHour, startMin] = block.windowStart.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const [endHour, endMin] = block.windowEnd.split(':').map(Number);
      const endMinutes = endHour * 60 + endMin;
      
      return openedMinutes >= startMinutes && openedMinutes < endMinutes;
    });
  };

  // Helper function to get dot color for a block
  const getBlockDotColor = (block: any) => {
    const [startHour, startMin] = block.windowStart.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const [endHour, endMin] = block.windowEnd.split(':').map(Number);
    const endMinutes = endHour * 60 + endMin;
    const isActive = currentBlock?.id === block.id;
    const isInTimeWindow = currentMinutes >= startMinutes && currentMinutes < endMinutes;
    const isFuture = currentMinutes < startMinutes;
    const isPast = currentMinutes >= endMinutes;
    
    // Blue for upcoming blocks
    if (isFuture) {
      return colors.semantic.info; // Blue
    }
    
    // Get positions for this block
    const blockPositions = getBlockPositions(block);
    
    if (blockPositions.length === 0) {
      // No trades for this block - default to blue
      return colors.semantic.info;
    }
    
    // Yellow for active block (in time window) with open positions
    if (isInTimeWindow) {
      const hasOpenPositions = blockPositions.some(p => p.state !== 'CLOSED');
      if (hasOpenPositions) {
        return '#FFD700'; // Yellow
      }
    }
    
    // For past blocks, check closed positions
    if (isPast) {
      const closedPositions = blockPositions.filter(p => p.state === 'CLOSED');
      
      if (closedPositions.length === 0) {
        // No closed positions yet - default to blue
        return colors.semantic.info;
      }
      
      // Calculate aggregate P/L for closed positions
      const totalPnL = closedPositions.reduce((sum, p) => sum + (p.pnl || 0), 0);
      
      // Green for won, Red for lost
      if (totalPnL > 0) {
        return colors.semantic.profit; // Green
      } else if (totalPnL < 0) {
        return colors.semantic.risk; // Red
      }
      
      // Break-even - default to blue
      return colors.semantic.info;
    }
    
    // Default to blue for any other case
    return colors.semantic.info;
  };

  return (
    <div style={{ 
      display: 'grid',
      gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: `${tokens.space.md}px`,
    }}>
      {blocks.map((block) => {
        const [startHour, startMin] = block.windowStart.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const [endHour, endMin] = block.windowEnd.split(':').map(Number);
        const endMinutes = endHour * 60 + endMin;
        
        // Use currentBlock prop to determine if this is the active block
        const isActive = currentBlock?.id === block.id;
        const isPast = currentMinutes >= endMinutes;
        const isFuture = currentMinutes < startMinutes;
        const isNext = nextBlock?.id === block.id && !isActive;

        // Get dot color based on block status and positions
        const dotColor = getBlockDotColor(block);

        return (
          <div
            key={block.id}
            style={{
              padding: `${tokens.space.md}px ${tokens.space.lg}px`,
              borderRadius: `${tokens.radius.md}px`,
              border: `1px solid ${
                isActive 
                  ? colors.semantic.info + '80' // Stronger border for active
                  : isFuture && isMarketOpen
                    ? colors.semantic.info + '60' // Blue border for upcoming blocks when market is open
                    : isNext && isMarketOpen
                      ? colors.semantic.info + '40' // Highlight next block when market is open
                      : colors.border
              }`,
              backgroundColor: isActive 
                ? colors.semantic.info + '15' // More visible background for active
                : isFuture && isMarketOpen
                  ? colors.semantic.info + '10' // Subtle background for upcoming blocks
                  : isNext && isMarketOpen
                    ? colors.semantic.info + '08' // Subtle highlight for next block
                    : isPast
                      ? colors.surface + '40'
                      : colors.surface,
              opacity: isPast ? 0.5 : 1,
              boxShadow: isActive ? `0 0 0 2px ${colors.semantic.info}30` : 'none',
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
              <span>{formatTo12Hour(block.windowStart)} - {formatTo12Hour(block.windowEnd)}</span>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: dotColor,
                opacity: 1,
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
                  Active · {getTimeRemaining(block.windowEnd)}
                </span>
              </div>
            )}
            
            {isNext && isMarketOpen && !isActive && (
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
                    backgroundColor: colors.semantic.info + '15',
                    border: `1px solid ${colors.semantic.info}30`,
                  }}
                >
                  Next · {getTimeUntilStart(block.windowStart)}
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
