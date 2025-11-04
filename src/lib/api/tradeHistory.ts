/**
 * Trade history API client.
 * 
 * Client-side utilities for fetching trade history data from the backend.
 */

import type { TradeHistoryRecord, TradeHistoryFilters, TradeHistoryStats } from '@/lib/tradeHistoryService';
import { TradeState } from '@/lib/tradeStateMachine';

/**
 * Fetch trade history with optional filters.
 */
export async function fetchTradeHistory(filters: TradeHistoryFilters = {}): Promise<TradeHistoryRecord[]> {
  const params = new URLSearchParams();
  
  if (filters.accountId) {
    params.append('accountId', filters.accountId);
  }
  
  if (filters.state) {
    params.append('state', filters.state);
  }
  
  if (filters.startDate) {
    params.append('startDate', filters.startDate);
  }
  
  if (filters.endDate) {
    params.append('endDate', filters.endDate);
  }
  
  if (filters.underlying) {
    params.append('underlying', filters.underlying);
  }
  
  if (filters.limit) {
    params.append('limit', filters.limit.toString());
  }
  
  if (filters.offset) {
    params.append('offset', filters.offset.toString());
  }
  
  const response = await fetch(`/api/trades/history?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch trade history: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.trades || [];
}

/**
 * Fetch a specific trade by ID.
 */
export async function fetchTradeById(tradeId: string): Promise<TradeHistoryRecord | null> {
  const response = await fetch(`/api/trades/${tradeId}`);
  
  if (response.status === 404) {
    return null;
  }
  
  if (!response.ok) {
    throw new Error(`Failed to fetch trade: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.trade || null;
}

/**
 * Fetch trade statistics with optional filters.
 */
export async function fetchTradeStats(filters: {
  accountId?: string;
  startDate?: string;
  endDate?: string;
} = {}): Promise<TradeHistoryStats> {
  const params = new URLSearchParams();
  
  if (filters.accountId) {
    params.append('accountId', filters.accountId);
  }
  
  if (filters.startDate) {
    params.append('startDate', filters.startDate);
  }
  
  if (filters.endDate) {
    params.append('endDate', filters.endDate);
  }
  
  const response = await fetch(`/api/trades/stats?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch trade stats: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.stats || {
    totalTrades: 0,
    byState: {} as Record<TradeState, number>,
    tradesToday: 0,
    winningTrades: 0,
    losingTrades: 0,
  };
}

/**
 * Fetch all trades from today.
 */
export async function fetchTradesToday(accountId?: string): Promise<TradeHistoryRecord[]> {
  const params = new URLSearchParams();
  
  if (accountId) {
    params.append('accountId', accountId);
  }
  
  const response = await fetch(`/api/trades/today?${params.toString()}`);
  
  if (!response.ok) {
    throw new Error(`Failed to fetch today's trades: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.trades || [];
}

/**
 * Helper function to calculate date range filters.
 */
export function getDateRangeFilter(range: 'today' | 'week' | '2weeks' | 'month' | '3months' | 'all'): {
  startDate?: string;
  endDate?: string;
} {
  const now = new Date();
  const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  
  switch (range) {
    case 'today':
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return {
        startDate: todayStart.toISOString(),
        endDate: endDate.toISOString(),
      };
    
    case 'week':
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - 7);
      weekStart.setHours(0, 0, 0, 0);
      return {
        startDate: weekStart.toISOString(),
        endDate: endDate.toISOString(),
      };
    
    case '2weeks':
      const twoWeeksStart = new Date(now);
      twoWeeksStart.setDate(now.getDate() - 14);
      twoWeeksStart.setHours(0, 0, 0, 0);
      return {
        startDate: twoWeeksStart.toISOString(),
        endDate: endDate.toISOString(),
      };
    
    case 'month':
      const monthStart = new Date(now);
      monthStart.setDate(now.getDate() - 30);
      monthStart.setHours(0, 0, 0, 0);
      return {
        startDate: monthStart.toISOString(),
        endDate: endDate.toISOString(),
      };
    
    case '3months':
      const threeMonthsStart = new Date(now);
      threeMonthsStart.setDate(now.getDate() - 90);
      threeMonthsStart.setHours(0, 0, 0, 0);
      return {
        startDate: threeMonthsStart.toISOString(),
        endDate: endDate.toISOString(),
      };
    
    case 'all':
    default:
      return {};
  }
}
