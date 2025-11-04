'use client';

import { useState, useMemo, useEffect } from 'react';
import { Download, Clock, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useTokens } from '@/hooks/useTokens';
import { useIsMobile } from '@/components/ui/use-mobile';
import { useTradeHistory } from '@/hooks/useTradeHistory';
import type { TradeHistoryRecord } from '@/lib/tradeHistoryService';
import { TradeState } from '@/lib/tradeStateMachine';
import { getDateRangeFilter } from '@/lib/api/tradeHistory';
import { TradeDetail } from '@/components/TradeDetail';

type DateRange = 'today' | 'week' | '2weeks' | 'month' | '3months' | 'all';
type UnderlyingFilter = 'ALL' | 'SPX' | 'QQQ' | 'NDX' | 'AAPL' | 'TSLA' | 'SPY' | 'RUT';
type StrategyFilter = 'ALL' | 'Vertical' | 'Butterfly';

export interface TradeHistory {
  id: string;
  date: string;
  time: string;
  underlying: 'SPX' | 'QQQ' | 'NDX' | 'AAPL' | 'TSLA' | 'SPY' | 'RUT';
  strategy: string;
  entry: number;
  exit: number;
  plDollar: number;
  plPercent: number;
  exitReason: 'TP' | 'SL' | 'TIME' | 'MANUAL';
  duration: number; // minutes
  notes: string;
  state: TradeState;
  chaseInfo?: {
    attempts: number;
    initialPrice: number;
    finalPrice?: number;
    totalTimeMs: number;
    strategy: string;
  };
  hasBrackets: boolean;
  originalRecord: TradeHistoryRecord;
}

/**
 * Extract underlying symbol from trade legs.
 */
function extractUnderlying(legs: TradeHistoryRecord['legs']): 'SPX' | 'QQQ' | 'NDX' | 'AAPL' | 'TSLA' | 'SPY' | 'RUT' {
  if (legs.length === 0) return 'SPX';
  
  // Try to extract from symbol format
  const firstSymbol = legs[0]?.symbol || '';
  
  // Check for common underlying symbols
  const underlyings: Array<'SPX' | 'QQQ' | 'NDX' | 'AAPL' | 'TSLA' | 'SPY' | 'RUT'> = 
    ['SPX', 'QQQ', 'NDX', 'AAPL', 'TSLA', 'SPY', 'RUT'];
  
  for (const underlying of underlyings) {
    if (firstSymbol.includes(underlying) || firstSymbol.startsWith(underlying)) {
      return underlying;
    }
  }
  
  // Default to SPX
  return 'SPX';
}

/**
 * Determine exit reason from trade record.
 */
function determineExitReason(record: TradeHistoryRecord): 'TP' | 'SL' | 'TIME' | 'MANUAL' {
  if (record.exitOrder) {
    if (record.exitOrder.exitType === 'take_profit') return 'TP';
    if (record.exitOrder.exitType === 'stop_loss') return 'SL';
    if (record.exitOrder.exitType === 'manual') return 'MANUAL';
  }
  
  // Check if there's a time exit in rule bundle
  if (record.ruleBundle?.timeExit) {
    return 'TIME';
  }
  
  return 'MANUAL';
}

/**
 * Calculate duration in minutes.
 */
function calculateDuration(record: TradeHistoryRecord): number {
  if (!record.exitOrder?.filledAt) {
    // If not exited, calculate from creation to now
    const created = new Date(record.createdAt);
    const now = new Date();
    return Math.floor((now.getTime() - created.getTime()) / (1000 * 60));
  }
  
  const created = new Date(record.createdAt);
  const exited = new Date(record.exitOrder.filledAt);
  return Math.floor((exited.getTime() - created.getTime()) / (1000 * 60));
}

/**
 * Calculate P/L percentage.
 */
function calculatePercentage(record: TradeHistoryRecord): number {
  if (!record.entryCredit || !record.profitLoss) return 0;
  if (record.entryCredit === 0) return 0;
  
  // For credit spreads: P/L % = (P/L / entry credit) * 100
  return (record.profitLoss / record.entryCredit) * 100;
}

/**
 * Map TradeHistoryRecord to TradeHistory interface.
 */
function mapTradeRecord(record: TradeHistoryRecord): TradeHistory {
  const createdAt = new Date(record.createdAt);
  
  return {
    id: record.tradeId,
    date: createdAt.toISOString().split('T')[0],
    time: createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    underlying: extractUnderlying(record.legs),
    strategy: record.strategy?.name || 'Unknown',
    entry: record.entryCredit || 0,
    exit: record.exitCredit || record.entryCredit || 0,
    plDollar: record.profitLoss || 0,
    plPercent: calculatePercentage(record),
    exitReason: determineExitReason(record),
    duration: calculateDuration(record),
    notes: record.metadata?.notes || '',
    state: record.currentState,
    chaseInfo: record.chaseInfo,
    hasBrackets: !!(record.brackets?.takeProfit || record.brackets?.stopLoss),
    originalRecord: record,
  };
}

export function History() {
  const isMobile = useIsMobile();
  const tokens = useTokens();
  const colors = tokens.colors;
  
  const [dateRange, setDateRange] = useState<DateRange>('2weeks');
  const [underlying, setUnderlying] = useState<UnderlyingFilter>('ALL');
  const [strategyFilter, setStrategyFilter] = useState<StrategyFilter>('ALL');
  const [now, setNow] = useState(new Date());
  const [selectedTrade, setSelectedTrade] = useState<TradeHistory | null>(null);

  // Use trade history hook with 2 weeks default
  const {
    trades: rawTrades,
    stats,
    loading,
    error,
    refetch,
    setFilters,
    isPolling,
    setPolling,
  } = useTradeHistory({
    dateRange: '2weeks',
    enablePolling: true,
    pollingInterval: 10000, // 10 seconds
  });

  // Add state for TastyTrade trades
  const [tastyTrades, setTastyTrades] = useState<TradeHistoryRecord[]>([]);
  const [loadingTasty, setLoadingTasty] = useState(false);

  // Fetch TastyTrade trades
  useEffect(() => {
    const fetchTastyTrades = async () => {
      try {
        setLoadingTasty(true);
        const startDate = '2025-11-01'; // Start from 11/1/2025
        const response = await fetch(`/api/tastytrade/orders/history?startDate=${startDate}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log('History API response:', {
            tradesCount: data.trades?.length || 0,
            count: data.count,
            errorDetails: data.errorDetails,
            debug: data.debug,
          });
          
          if (data.errorDetails) {
            console.error('History API error details:', data.errorDetails);
          }
          
          setTastyTrades(data.trades || []);
        } else {
          const errorData = await response.json().catch(() => ({ error: response.statusText }));
          console.error('History API error response:', {
            status: response.status,
            statusText: response.statusText,
            error: errorData,
          });
        }
      } catch (error) {
        console.error('Failed to fetch TastyTrade trades:', error);
      } finally {
        setLoadingTasty(false);
      }
    };
    
    fetchTastyTrades();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchTastyTrades, 30000);
    return () => clearInterval(interval);
  }, []);

  // Merge trades from both sources
  const allTrades = useMemo(() => {
    // Combine app trades and TastyTrade trades
    const combined = [...rawTrades, ...tastyTrades];
    
    // Remove duplicates by trade ID (prefer app version if duplicate)
    const tradeMap = new Map<string, TradeHistory>();
    combined.forEach(trade => {
      if (!tradeMap.has(trade.id) || trade.originalRecord?.source === 'app') {
        tradeMap.set(trade.id, trade);
      }
    });
    
    // Sort by date (newest first)
    return Array.from(tradeMap.values()).sort((a, b) => {
      return new Date(b.date + ' ' + b.time).getTime() - new Date(a.date + ' ' + a.time).getTime();
    });
  }, [rawTrades, tastyTrades]);

  // Update filteredTrades to use allTrades instead of tradeHistory
  const filteredTrades = useMemo(() => {
    return allTrades.filter(trade => {
      if (underlying !== 'ALL' && trade.underlying !== underlying) return false;
      if (strategyFilter !== 'ALL' && !trade.strategy.includes(strategyFilter)) return false;
      return true;
    });
  }, [allTrades, underlying, strategyFilter]);

  // Update filters when date range changes
  useEffect(() => {
    const dateFilter = getDateRangeFilter(dateRange);
    setFilters({
      ...dateFilter,
      underlying: underlying !== 'ALL' ? underlying : undefined,
    });
  }, [dateRange, underlying, setFilters]);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Map trade records to TradeHistory interface
  const tradeHistory: TradeHistory[] = useMemo(() => {
    return rawTrades.map(mapTradeRecord);
  }, [rawTrades]);

  // Calculate KPIs - use stats from hook when available, fallback to filtered trades
  const kpis = useMemo(() => {
    // Use stats from hook if available (for closed trades)
    if (stats) {
      const total = stats.totalTrades;
      const wins = stats.winningTrades;
      const losses = stats.losingTrades;
      const winRate = total > 0 ? (wins / total) * 100 : 0;
      const totalPL = stats.totalProfitLoss || 0;
      
      // Calculate averages from filtered trades
      const avgReturn = filteredTrades.length > 0
        ? filteredTrades.reduce((sum, t) => sum + t.plPercent, 0) / filteredTrades.length
        : 0;
      const avgHoldTime = filteredTrades.length > 0
        ? filteredTrades.reduce((sum, t) => sum + t.duration, 0) / filteredTrades.length
        : 0;
      
      const avgWin = wins > 0 && totalPL > 0
        ? filteredTrades.filter(t => t.plDollar > 0).reduce((sum, t) => sum + t.plDollar, 0) / wins
        : 0;
      const avgLoss = losses > 0
        ? Math.abs(filteredTrades.filter(t => t.plDollar < 0).reduce((sum, t) => sum + t.plDollar, 0)) / losses
        : 0;
      const expectancy = avgLoss > 0 ? (avgWin / avgLoss) : 0;

      return { winRate, avgHoldTime, avgReturn, totalPL, expectancy };
    }
    
    // Fallback to calculating from filtered trades
    const wins = filteredTrades.filter(t => t.plDollar > 0).length;
    const total = filteredTrades.length;
    const winRate = total > 0 ? (wins / total) * 100 : 0;
    
    const totalPL = filteredTrades.reduce((sum, t) => sum + t.plDollar, 0);
    const avgReturn = total > 0 
      ? filteredTrades.reduce((sum, t) => sum + t.plPercent, 0) / total 
      : 0;
    const avgHoldTime = total > 0
      ? filteredTrades.reduce((sum, t) => sum + t.duration, 0) / total
      : 0;
    
    const avgWin = wins > 0
      ? filteredTrades.filter(t => t.plDollar > 0).reduce((sum, t) => sum + t.plDollar, 0) / wins
      : 0;
    const losses = total - wins;
    const avgLoss = losses > 0
      ? Math.abs(filteredTrades.filter(t => t.plDollar < 0).reduce((sum, t) => sum + t.plDollar, 0)) / losses
      : 0;
    const expectancy = avgLoss > 0 ? (avgWin / avgLoss) : 0;

    return { winRate, avgHoldTime, avgReturn, totalPL, expectancy };
  }, [filteredTrades, stats]);

  // Equity curve data
  const equityCurveData = useMemo(() => {
    let cumulative = 0;
    let lastTen: boolean[] = [];
    
    return filteredTrades.map((trade, idx) => {
      cumulative += trade.plDollar;
      lastTen.push(trade.plDollar > 0);
      if (lastTen.length > 10) lastTen.shift();
      
      const rollingWinRate = lastTen.length > 0
        ? (lastTen.filter(w => w).length / lastTen.length) * 100
        : 0;
      
      return {
        name: `T${idx + 1}`,
        equity: cumulative,
        winRate: rollingWinRate,
      };
    });
  }, [filteredTrades]);

  const formatCurrency = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  };

  const formatPercent = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const getExitReasonLabel = (reason: 'TP' | 'SL' | 'TIME' | 'MANUAL'): string => {
    const labels = { TP: 'Target', SL: 'Stop', TIME: 'Time Exit', MANUAL: 'Manual' };
    return labels[reason];
  };

  const getExitReasonColor = (reason: 'TP' | 'SL' | 'TIME' | 'MANUAL'): string => {
    switch(reason) {
      case 'TP': return colors.semantic.profit;
      case 'SL': return colors.semantic.risk;
      case 'TIME': return colors.semantic.warning;
      case 'MANUAL': return colors.semantic.info;
    }
  };

  const getStateColor = (state: TradeState): string => {
    switch(state) {
      case TradeState.CLOSED: return colors.semantic.profit;
      case TradeState.FILLED:
      case TradeState.OCO_ATTACHED: return colors.semantic.info;
      case TradeState.WORKING:
      case TradeState.SUBMITTED: return colors.semantic.warning;
      case TradeState.PENDING: return colors.textSecondary;
      case TradeState.CANCELLED:
      case TradeState.REJECTED:
      case TradeState.ERROR: return colors.semantic.risk;
      default: return colors.textSecondary;
    }
  };

  const getStateLabel = (state: TradeState): string => {
    switch(state) {
      case TradeState.PENDING: return 'Pending';
      case TradeState.SUBMITTED: return 'Submitted';
      case TradeState.WORKING: return 'Working';
      case TradeState.FILLED: return 'Filled';
      case TradeState.OCO_ATTACHED: return 'OCO Attached';
      case TradeState.CLOSED: return 'Closed';
      case TradeState.CANCELLED: return 'Cancelled';
      case TradeState.REJECTED: return 'Rejected';
      case TradeState.ERROR: return 'Error';
      default: return state;
    }
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Time', 'Underlying', 'Strategy', 'Entry', 'Exit', 'P/L $', 'P/L %', 'Exit Reason', 'Duration (min)', 'Notes'];
    const rows = filteredTrades.map(t => [
      t.date,
      t.time,
      t.underlying,
      t.strategy,
      t.entry.toString(),
      t.exit.toString(),
      t.plDollar.toString(),
      t.plPercent.toString(),
      t.exitReason,
      t.duration.toString(),
      t.notes,
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vibesnipe-history-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const currentTime = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) + ' ET';

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: colors.bg,
      color: colors.textPrimary,
    }}>
      {/* HEADER */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: isMobile ? `${tokens.space.xl}px ${tokens.space.lg}px` : `${tokens.space.xxxl}px ${tokens.space.xl}px ${tokens.space.xl}px`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: `${tokens.space.xxl}px`, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? `${tokens.space.md}px` : 0 }}>
          <div>
            <h1 style={{ 
              fontSize: `${tokens.type.sizes.xxxl}px`, 
              marginBottom: `${tokens.space.sm}px`,
              color: colors.textPrimary,
              fontWeight: tokens.type.weights.semibold,
              letterSpacing: '-0.02em',
            }}>
              History
            </h1>
            <p style={{ fontSize: `${tokens.type.sizes.base}px`, color: colors.textSecondary }}>
              Performance analysis and trade log
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.md}px`, flexWrap: 'wrap' }}>
            {/* Exposure Chip */}
            <div style={{
              padding: `${tokens.space.sm}px ${tokens.space.md}px`,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: `${tokens.radius.md}px`,
              fontSize: `${tokens.type.sizes.sm}px`,
              color: colors.textSecondary,
              fontVariantNumeric: 'tabular-nums',
            }}>
              Exposure: <span style={{ color: colors.textPrimary }}>$0</span>
            </div>

            {/* Clock */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${tokens.space.sm}px`,
              padding: `${tokens.space.sm}px ${tokens.space.md}px`,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: `${tokens.radius.md}px`,
              fontSize: `${tokens.type.sizes.sm}px`,
              color: colors.textSecondary,
              fontVariantNumeric: 'tabular-nums',
            }}>
              <Clock size={14} />
              {currentTime}
            </div>
          </div>
        </div>

        {/* FILTERS + SUMMARY */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            marginBottom: `${tokens.space.xxl}px`,
          }}
        >
          {/* Filters Row */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${tokens.space.md}px`,
            marginBottom: `${tokens.space.xl}px`,
            flexWrap: 'wrap',
          }}>
            {/* Date Range */}
            <div style={{ display: 'flex', gap: `${tokens.space.xs}px`, flexWrap: 'wrap' }}>
              {(['today', 'week', '2weeks', 'month', '3months', 'all'] as DateRange[]).map(range => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  style={{
                    padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                    backgroundColor: dateRange === range ? colors.semantic.info + '20' : colors.surface,
                    border: `1px solid ${dateRange === range ? colors.semantic.info : colors.border}`,
                    borderRadius: `${tokens.radius.md}px`,
                    color: dateRange === range ? colors.semantic.info : colors.textSecondary,
                    cursor: 'pointer',
                    fontSize: `${tokens.type.sizes.sm}px`,
                    textTransform: range === '2weeks' ? 'none' : range === '3months' ? 'none' : 'capitalize',
                    transition: tokens.motion.base,
                  }}
                >
                  {range === '2weeks' ? '2 Weeks' : range === '3months' ? '3 Months' : range}
                </button>
              ))}
            </div>

            {/* Underlying Filter */}
            <div style={{ display: 'flex', gap: `${tokens.space.xs}px` }}>
              {(['ALL', 'SPX', 'QQQ'] as UnderlyingFilter[]).map(u => (
                <button
                  key={u}
                  onClick={() => setUnderlying(u)}
                  style={{
                    padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                    backgroundColor: underlying === u ? colors.semantic.info + '20' : colors.surface,
                    border: `1px solid ${underlying === u ? colors.semantic.info : colors.border}`,
                    borderRadius: `${tokens.radius.md}px`,
                    color: underlying === u ? colors.semantic.info : colors.textSecondary,
                    cursor: 'pointer',
                    fontSize: `${tokens.type.sizes.sm}px`,
                    transition: tokens.motion.base,
                  }}
                >
                  {u}
                </button>
              ))}
            </div>

            {/* Strategy Filter */}
            <div style={{ display: 'flex', gap: `${tokens.space.xs}px` }}>
              {(['ALL', 'Vertical', 'Butterfly'] as StrategyFilter[]).map(s => (
                <button
                  key={s}
                  onClick={() => setStrategyFilter(s)}
                  style={{
                    padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                    backgroundColor: strategyFilter === s ? colors.semantic.info + '20' : colors.surface,
                    border: `1px solid ${strategyFilter === s ? colors.semantic.info : colors.border}`,
                    borderRadius: `${tokens.radius.md}px`,
                    color: strategyFilter === s ? colors.semantic.info : colors.textSecondary,
                    cursor: 'pointer',
                    fontSize: `${tokens.type.sizes.sm}px`,
                    transition: tokens.motion.base,
                  }}
                >
                  {s}
                </button>
              ))}
            </div>

            <div style={{ flex: 1 }} />

            {/* Export Button */}
            <button
              onClick={handleExportCSV}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: `${tokens.space.sm}px`,
                padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                backgroundColor: colors.semantic.profit + '20',
                border: `1px solid ${colors.semantic.profit}`,
                borderRadius: `${tokens.radius.md}px`,
                color: colors.semantic.profit,
                cursor: 'pointer',
                fontSize: `${tokens.type.sizes.sm}px`,
                transition: tokens.motion.base,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = colors.semantic.profit + '30';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = colors.semantic.profit + '20';
              }}
            >
              <Download size={16} />
              Export CSV
            </button>
          </div>

          {/* KPIs Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)',
            gap: `${tokens.space.md}px`,
          }}>
            {/* Win Rate */}
            <div style={{
              padding: `${tokens.space.lg}px`,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: `${tokens.radius.lg}px`,
            }}>
              <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginBottom: `${tokens.space.xs}px`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Win Rate
              </div>
              <div style={{ fontSize: `${tokens.type.sizes.xxl}px`, fontVariantNumeric: 'tabular-nums', color: colors.textPrimary, fontWeight: tokens.type.weights.semibold }}>
                {kpis.winRate.toFixed(1)}%
              </div>
            </div>

            {/* Avg Hold Time */}
            <div style={{
              padding: `${tokens.space.lg}px`,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: `${tokens.radius.lg}px`,
            }}>
              <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginBottom: `${tokens.space.xs}px`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Avg Hold Time
              </div>
              <div style={{ fontSize: `${tokens.type.sizes.xxl}px`, fontVariantNumeric: 'tabular-nums', color: colors.textPrimary, fontWeight: tokens.type.weights.semibold }}>
                {Math.round(kpis.avgHoldTime)}m
              </div>
            </div>

            {/* Avg Return */}
            <div style={{
              padding: `${tokens.space.lg}px`,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: `${tokens.radius.lg}px`,
            }}>
              <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginBottom: `${tokens.space.xs}px`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Avg Return
              </div>
              <div style={{ 
                fontSize: `${tokens.type.sizes.xxl}px`, 
                fontVariantNumeric: 'tabular-nums', 
                color: kpis.avgReturn >= 0 ? colors.semantic.profit : colors.semantic.risk,
                fontWeight: tokens.type.weights.semibold,
              }}>
                {formatPercent(kpis.avgReturn)}
              </div>
            </div>

            {/* Net P/L */}
            <div style={{
              padding: `${tokens.space.lg}px`,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: `${tokens.radius.lg}px`,
            }}>
              <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginBottom: `${tokens.space.xs}px`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Net P/L
              </div>
              <div style={{ 
                fontSize: `${tokens.type.sizes.xxl}px`, 
                fontVariantNumeric: 'tabular-nums', 
                color: kpis.totalPL >= 0 ? colors.semantic.profit : colors.semantic.risk,
                fontWeight: tokens.type.weights.semibold,
              }}>
                {formatCurrency(kpis.totalPL)}
              </div>
            </div>

            {/* Expectancy */}
            <div style={{
              padding: `${tokens.space.lg}px`,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: `${tokens.radius.lg}px`,
            }}>
              <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginBottom: `${tokens.space.xs}px`, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Expectancy
              </div>
              <div style={{ 
                fontSize: `${tokens.type.sizes.xxl}px`, 
                fontVariantNumeric: 'tabular-nums', 
                color: kpis.expectancy >= 1 ? colors.semantic.profit : colors.semantic.warning,
                fontWeight: tokens.type.weights.semibold,
              }}>
                {kpis.expectancy.toFixed(2)}R
              </div>
            </div>
          </div>
        </motion.div>

        {/* HISTORY TABLE */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          style={{
            marginBottom: `${tokens.space.xxl}px`,
          }}
        >
          <div style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: `${tokens.radius.lg}px`,
            overflow: 'hidden',
          }}>
            {/* Table Header */}
            {!isMobile && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '100px 80px 100px 200px 80px 80px 100px 100px 100px 80px 90px 50px 50px 1fr 40px',
                gap: `${tokens.space.md}px`,
                padding: `${tokens.space.md}px ${tokens.space.lg}px`,
                backgroundColor: colors.surface,
                borderBottom: `1px solid ${colors.border}`,
                fontSize: `${tokens.type.sizes.xs}px`,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                fontVariantNumeric: 'tabular-nums',
              }}>
                <div>Date</div>
                <div>Time</div>
                <div>Underlying</div>
                <div>Strategy</div>
                <div>Entry</div>
                <div>Exit</div>
                <div>P/L $</div>
                <div>P/L %</div>
                <div>Exit Reason</div>
                <div>Duration</div>
                <div>State</div>
                <div style={{ textAlign: 'center' }} title="Chase">🚀</div>
                <div style={{ textAlign: 'center' }} title="Brackets">🎯</div>
                <div>Notes</div>
                <div></div>
              </div>
            )}

            {/* Loading State */}
            {loading && filteredTrades.length === 0 ? (
              <div style={{
                padding: `${tokens.space.xl}px`,
                textAlign: 'center',
                color: colors.textSecondary,
              }}>
                Loading trades...
              </div>
            ) : error ? (
              <div style={{
                padding: `${tokens.space.xl}px`,
                textAlign: 'center',
                color: colors.semantic.risk,
              }}>
                Error loading trades: {error.message}
                <br />
                <button
                  onClick={() => refetch()}
                  style={{
                    marginTop: `${tokens.space.md}px`,
                    padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                    backgroundColor: colors.semantic.info,
                    color: 'white',
                    border: 'none',
                    borderRadius: `${tokens.radius.md}px`,
                    cursor: 'pointer',
                  }}
                >
                  Retry
                </button>
              </div>
            ) : filteredTrades.length === 0 ? (
              <div style={{
                padding: `${tokens.space.xl}px`,
                textAlign: 'center',
                color: colors.textSecondary,
              }}>
                No trades found
              </div>
            ) : (
              filteredTrades.map((trade, index) => (
                <div
                  key={trade.id}
                  style={{
                    display: isMobile ? 'block' : 'grid',
                    gridTemplateColumns: isMobile ? undefined : '100px 80px 100px 200px 80px 80px 100px 100px 100px 80px 90px 50px 50px 1fr 40px',
                    gap: `${tokens.space.md}px`,
                    padding: `${tokens.space.md}px ${tokens.space.lg}px`,
                    backgroundColor: 'transparent',
                    borderBottom: index < filteredTrades.length - 1 ? `1px solid ${colors.border}` : 'none',
                    fontSize: `${tokens.type.sizes.sm}px`,
                    fontVariantNumeric: 'tabular-nums',
                    transition: tokens.motion.base,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.surfaceAlt;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                  onClick={() => setSelectedTrade(trade)}
                >
                  {isMobile ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: `${tokens.space.sm}px` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.xs}px`, marginBottom: `${tokens.space.xs}px` }}>
                            <span style={{ color: colors.textPrimary, fontWeight: tokens.type.weights.medium }}>{trade.underlying} {trade.strategy}</span>
                            {trade.chaseInfo && <span title={`Chased: ${trade.chaseInfo.attempts} attempts`}>🚀</span>}
                            {trade.hasBrackets && <span title="Brackets attached">🎯</span>}
                          </div>
                          <div style={{ color: colors.textSecondary, fontSize: `${tokens.type.sizes.xs}px` }}>{trade.date} {trade.time}</div>
                        </div>
                        <div style={{ color: trade.plDollar >= 0 ? colors.semantic.profit : colors.semantic.risk, fontWeight: tokens.type.weights.medium }}>
                          {formatCurrency(trade.plDollar)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: `${tokens.space.xs}px`, flexWrap: 'wrap', alignItems: 'center' }}>
                        <div style={{
                          padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                          backgroundColor: getStateColor(trade.state) + '20',
                          border: `1px solid ${getStateColor(trade.state)}40`,
                          borderRadius: `${tokens.radius.sm}px`,
                          fontSize: `${tokens.type.sizes.xs}px`,
                          color: getStateColor(trade.state),
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}>
                          {getStateLabel(trade.state)}
                        </div>
                        <div style={{
                          display: 'inline-block',
                          padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                          backgroundColor: getExitReasonColor(trade.exitReason) + '20',
                          border: `1px solid ${getExitReasonColor(trade.exitReason)}40`,
                          borderRadius: `${tokens.radius.sm}px`,
                          fontSize: `${tokens.type.sizes.xs}px`,
                          color: getExitReasonColor(trade.exitReason),
                          textTransform: 'uppercase',
                          letterSpacing: '0.03em',
                        }}>
                          {getExitReasonLabel(trade.exitReason)}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: `${tokens.space.sm}px`, fontSize: `${tokens.type.sizes.xs}px` }}>
                        <div>
                          <span style={{ color: colors.textSecondary }}>Entry: </span>
                          <span style={{ color: colors.textPrimary }}>${trade.entry.toFixed(2)}</span>
                        </div>
                        <div>
                          <span style={{ color: colors.textSecondary }}>Exit: </span>
                          <span style={{ color: colors.textPrimary }}>${trade.exit.toFixed(2)}</span>
                        </div>
                        <div>
                          <span style={{ color: colors.textSecondary }}>P/L %: </span>
                          <span style={{ color: trade.plPercent >= 0 ? colors.semantic.profit : colors.semantic.risk }}>
                            {formatPercent(trade.plPercent)}
                          </span>
                        </div>
                        <div>
                          <span style={{ color: colors.textSecondary }}>Duration: </span>
                          <span style={{ color: colors.textPrimary }}>{trade.duration}m</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ color: colors.textSecondary }}>{trade.date}</div>
                      <div style={{ color: colors.textSecondary }}>{trade.time}</div>
                      <div style={{ color: colors.textPrimary }}>{trade.underlying}</div>
                      <div style={{ color: colors.textPrimary, fontSize: `${tokens.type.sizes.xs}px` }}>{trade.strategy}</div>
                      <div style={{ color: colors.textPrimary }}>${trade.entry.toFixed(2)}</div>
                      <div style={{ color: colors.textPrimary }}>${trade.exit.toFixed(2)}</div>
                      <div style={{ color: trade.plDollar >= 0 ? colors.semantic.profit : colors.semantic.risk }}>
                        {formatCurrency(trade.plDollar)}
                      </div>
                      <div style={{ color: trade.plPercent >= 0 ? colors.semantic.profit : colors.semantic.risk }}>
                        {formatPercent(trade.plPercent)}
                      </div>
                      <div style={{
                        display: 'inline-block',
                        padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                        backgroundColor: getExitReasonColor(trade.exitReason) + '20',
                        border: `1px solid ${getExitReasonColor(trade.exitReason)}40`,
                        borderRadius: `${tokens.radius.sm}px`,
                        fontSize: `${tokens.type.sizes.xs}px`,
                        color: getExitReasonColor(trade.exitReason),
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                      }}>
                        {getExitReasonLabel(trade.exitReason)}
                      </div>
                      <div style={{ color: colors.textSecondary }}>{trade.duration}m</div>
                      <div style={{
                        display: 'inline-block',
                        padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                        backgroundColor: getStateColor(trade.state) + '20',
                        border: `1px solid ${getStateColor(trade.state)}40`,
                        borderRadius: `${tokens.radius.sm}px`,
                        fontSize: `${tokens.type.sizes.xs}px`,
                        color: getStateColor(trade.state),
                        textTransform: 'uppercase',
                        letterSpacing: '0.03em',
                        whiteSpace: 'nowrap',
                      }}>
                        {getStateLabel(trade.state)}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: trade.chaseInfo ? colors.semantic.info : colors.textSecondary + '40',
                        opacity: trade.chaseInfo ? 1 : 0.3,
                      }} title={trade.chaseInfo ? `Chased: ${trade.chaseInfo.attempts} attempts` : 'No chase'}>
                        {trade.chaseInfo ? '🚀' : '—'}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: trade.hasBrackets ? colors.semantic.profit : colors.textSecondary + '40',
                        opacity: trade.hasBrackets ? 1 : 0.3,
                      }} title={trade.hasBrackets ? 'Brackets attached (TP/SL)' : 'No brackets'}>
                        {trade.hasBrackets ? '🎯' : '—'}
                      </div>
                      <div style={{ 
                        color: colors.textSecondary, 
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {trade.notes}
                      </div>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: colors.textSecondary,
                      }}>
                        <ChevronRight size={16} />
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </motion.div>

        {/* PERFORMANCE CHART */}
        {equityCurveData.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            style={{
              padding: `${tokens.space.xl}px`,
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: `${tokens.radius.lg}px`,
              marginBottom: `${tokens.space.xl}px`,
            }}
          >
            <h3 style={{ fontSize: `${tokens.type.sizes.lg}px`, marginBottom: `${tokens.space.lg}px`, color: colors.textPrimary, fontWeight: tokens.type.weights.medium }}>
              Performance Over Time
            </h3>
            <ResponsiveContainer width="100%" height={isMobile ? 200 : 300}>
              <LineChart data={equityCurveData}>
                <CartesianGrid strokeDasharray="3 3" stroke={colors.border} />
                <XAxis 
                  dataKey="name" 
                  stroke={colors.subtle}
                  tick={{ fill: colors.textSecondary, fontSize: tokens.type.sizes.xs }}
                />
                <YAxis 
                  yAxisId="left"
                  stroke={colors.subtle}
                  tick={{ fill: colors.textSecondary, fontSize: tokens.type.sizes.xs }}
                  tickFormatter={(val) => `$${val}`}
                />
                <YAxis 
                  yAxisId="right"
                  orientation="right"
                  stroke={colors.subtle}
                  tick={{ fill: colors.textSecondary, fontSize: tokens.type.sizes.xs }}
                  tickFormatter={(val) => `${val}%`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: tokens.radius.md,
                    fontSize: tokens.type.sizes.sm,
                  }}
                />
                <Legend />
                <Line 
                  yAxisId="left"
                  type="monotone" 
                  dataKey="equity" 
                  stroke={colors.semantic.profit} 
                  strokeWidth={2}
                  dot={false}
                  name="Equity ($)"
                />
                <Line 
                  yAxisId="right"
                  type="monotone" 
                  dataKey="winRate" 
                  stroke={colors.semantic.info} 
                  strokeWidth={2}
                  dot={false}
                  name="Win Rate (%) - Rolling 10"
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>
        )}

        {/* FOOTER */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: `${tokens.space.lg}px 0`,
          fontSize: `${tokens.type.sizes.xs}px`,
          color: colors.textSecondary,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? `${tokens.space.sm}px` : 0,
        }}>
          <div>
            {isPolling ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.xs}px` }}>
                <span style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: colors.semantic.profit,
                  animation: 'pulse 2s infinite',
                }} />
                Auto-refreshing every 10s
              </span>
            ) : (
              'Last synced: ' + new Date().toLocaleTimeString()
            )}
          </div>
          <div style={{ display: 'flex', gap: `${tokens.space.md}px`, alignItems: 'center' }}>
            <button
              style={{
                color: colors.semantic.info,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: `${tokens.type.sizes.xs}px`,
              }}
              onClick={() => refetch()}
            >
              Refresh
            </button>
            <button
              style={{
                color: colors.semantic.info,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                fontSize: `${tokens.type.sizes.xs}px`,
              }}
              onClick={() => setPolling(!isPolling)}
            >
              {isPolling ? 'Stop Auto-refresh' : 'Start Auto-refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* Trade Detail Modal */}
      {selectedTrade && (
        <TradeDetail
          trade={selectedTrade}
          isOpen={!!selectedTrade}
          onClose={() => setSelectedTrade(null)}
          colors={colors}
          tokens={tokens}
        />
      )}
    </div>
  );
}
