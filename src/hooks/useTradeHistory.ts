/**
 * Trade history hook.
 * 
 * React hook for fetching and managing trade history data with filters,
 * real-time updates, and state management.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchTradeHistory, fetchTradeStats, fetchTradesToday, getDateRangeFilter } from '@/lib/api/tradeHistory';
import type { TradeHistoryRecord, TradeHistoryFilters, TradeHistoryStats } from '@/lib/tradeHistoryService';

export interface UseTradeHistoryOptions {
  /** Date range preset */
  dateRange?: 'today' | 'week' | '2weeks' | 'month' | '3months' | 'all';
  /** Account ID filter */
  accountId?: string;
  /** Trade state filter */
  state?: string;
  /** Underlying symbol filter */
  underlying?: string;
  /** Enable real-time polling */
  enablePolling?: boolean;
  /** Polling interval in milliseconds (default: 10000 = 10 seconds) */
  pollingInterval?: number;
  /** Limit number of results */
  limit?: number;
  /** Initial auto-fetch on mount */
  autoFetch?: boolean;
}

export interface UseTradeHistoryReturn {
  /** Array of trade history records */
  trades: TradeHistoryRecord[];
  /** Trade statistics */
  stats: TradeHistoryStats | null;
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Refresh trades */
  refetch: () => Promise<void>;
  /** Update filters */
  setFilters: (filters: Partial<TradeHistoryFilters>) => void;
  /** Current filters */
  filters: TradeHistoryFilters;
  /** Is polling active */
  isPolling: boolean;
  /** Start/stop polling */
  setPolling: (enabled: boolean) => void;
}

/**
 * Custom hook for managing trade history.
 */
export function useTradeHistory(options: UseTradeHistoryOptions = {}): UseTradeHistoryReturn {
  const {
    dateRange = '2weeks',
    accountId,
    state,
    underlying,
    enablePolling = false,
    pollingInterval = 10000,
    limit,
    autoFetch = true,
  } = options;

  const [trades, setTrades] = useState<TradeHistoryRecord[]>([]);
  const [stats, setStats] = useState<TradeHistoryStats | null>(null);
  const [loading, setLoading] = useState<boolean>(autoFetch);
  const [error, setError] = useState<Error | null>(null);
  const [isPolling, setIsPolling] = useState<boolean>(enablePolling);
  const [filters, setFiltersState] = useState<TradeHistoryFilters>(() => {
    const dateFilter = getDateRangeFilter(dateRange);
    return {
      ...dateFilter,
      accountId,
      state: state as any,
      underlying,
      limit,
    };
  });

  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef<boolean>(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  /**
   * Fetch trades with current filters.
   */
  const fetchTrades = useCallback(async () => {
    try {
      setError(null);
      const fetchedTrades = await fetchTradeHistory(filters);
      
      if (mountedRef.current) {
        setTrades(fetchedTrades);
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to fetch trades');
      if (mountedRef.current) {
        setError(error);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [filters]);

  /**
   * Fetch statistics with current filters.
   */
  const fetchStats = useCallback(async () => {
    try {
      const fetchedStats = await fetchTradeStats({
        accountId: filters.accountId,
        startDate: filters.startDate,
        endDate: filters.endDate,
      });
      
      if (mountedRef.current) {
        setStats(fetchedStats);
      }
    } catch (err) {
      // Don't set error for stats failures - it's non-critical
      console.error('Failed to fetch trade stats:', err);
    }
  }, [filters.accountId, filters.startDate, filters.endDate]);

  /**
   * Poll for today's trades and merge with existing trades.
   */
  const pollTodayTrades = useCallback(async () => {
    try {
      const todayTrades = await fetchTradesToday(filters.accountId);
      
      if (mountedRef.current) {
        // Merge today's trades with existing trades
        // Remove duplicates and keep the most recent version
        const tradeMap = new Map<string, TradeHistoryRecord>();
        
        // Add existing trades (except today's)
        const today = new Date().toISOString().split('T')[0];
        trades.forEach(trade => {
          const tradeDate = trade.createdAt.split('T')[0];
          if (tradeDate !== today) {
            tradeMap.set(trade.tradeId, trade);
          }
        });
        
        // Add/update today's trades
        todayTrades.forEach(trade => {
          tradeMap.set(trade.tradeId, trade);
        });
        
        // Convert back to array and sort by creation date (newest first)
        const mergedTrades = Array.from(tradeMap.values()).sort((a, b) => {
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
        
        setTrades(mergedTrades);
      }
    } catch (err) {
      console.error('Failed to poll today\'s trades:', err);
      // Don't set error for polling failures
    }
  }, [filters.accountId, trades]);

  /**
   * Initial fetch on mount.
   */
  useEffect(() => {
    if (autoFetch) {
      fetchTrades();
      fetchStats();
    }
  }, [autoFetch]); // Only run once on mount if autoFetch is true

  /**
   * Refetch when filters change.
   */
  useEffect(() => {
    if (autoFetch || trades.length > 0) {
      setLoading(true);
      fetchTrades();
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]); // Re-fetch when filters change (fetchTrades/fetchStats depend on filters so we omit them)

  /**
   * Set up polling interval.
   */
  useEffect(() => {
    if (isPolling) {
      // Clear existing interval
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
      
      // Poll immediately
      pollTodayTrades();
      
      // Set up interval
      pollingRef.current = setInterval(() => {
        pollTodayTrades();
        fetchStats(); // Also refresh stats
      }, pollingInterval);
      
      return () => {
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      };
    } else {
      // Clear interval if polling is disabled
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [isPolling, pollingInterval, pollTodayTrades, fetchStats]);

  /**
   * Update filters.
   */
  const updateFilters = useCallback((newFilters: Partial<TradeHistoryFilters>) => {
    setFiltersState(prev => ({ ...prev, ...newFilters }));
  }, []);

  /**
   * Manually refetch trades.
   */
  const refetch = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTrades(), fetchStats()]);
  }, [fetchTrades, fetchStats]);

  /**
   * Toggle polling.
   */
  const setPolling = useCallback((enabled: boolean) => {
    setIsPolling(enabled);
  }, []);

  return {
    trades,
    stats,
    loading,
    error,
    refetch,
    setFilters: updateFilters,
    filters,
    isPolling,
    setPolling,
  };
}
