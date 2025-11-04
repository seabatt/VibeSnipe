/**
 * Trade history service.
 * 
 * Persists all trade lifecycle data for historical tracking and analysis.
 * Currently uses file-based JSON storage, but can be easily swapped for a database.
 * 
 * Key principle: Capture ALL trade events and state transitions throughout the day.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { TradeState, type Trade, type StateTransitionEvent } from './tradeStateMachine';
import { logger } from './logger';
import type { TradeExecutionIntent } from './tastytrade/executionService';
import type { AppOrder } from './tastytrade/types';

/**
 * Complete trade history record.
 * Contains all information needed to reconstruct a trade's full lifecycle.
 */
export interface TradeHistoryRecord {
  /** Unique trade ID */
  tradeId: string;
  /** Trade state history */
  stateHistory: StateTransitionEvent[];
  /** Current state */
  currentState: TradeState;
  /** Trade creation timestamp */
  createdAt: string;
  /** Last update timestamp */
  updatedAt: string;
  /** Associated order IDs */
  orderIds: string[];
  /** Entry order details */
  entryOrder?: {
    orderId: string;
    clientOrderId: string;
    status: string;
    quantity: number;
    limitPrice?: number;
    fillPrice?: number;
    filledAt?: string;
    netPrice?: number;
  };
  /** Position ID (once filled) */
  positionId?: string;
  /** Bracket orders (TP/SL) */
  brackets?: {
    takeProfit?: {
      orderId: string;
      price: number;
      status: string;
      filledAt?: string;
      fillPrice?: number;
    };
    stopLoss?: {
      orderId: string;
      price: number;
      status: string;
      filledAt?: string;
      fillPrice?: number;
    };
  };
  /** Exit order details */
  exitOrder?: {
    orderId: string;
    status: string;
    fillPrice?: number;
    filledAt?: string;
    exitType: 'take_profit' | 'stop_loss' | 'manual';
  };
  /** Trade legs */
  legs: Array<{
    symbol: string;
    instrumentType: string;
    quantity: number;
    action: string;
    price?: number;
  }>;
  /** Quantity */
  quantity: number;
  /** Entry credit/debit */
  entryCredit?: number;
  /** Exit credit/debit */
  exitCredit?: number;
  /** Profit/Loss */
  profitLoss?: number;
  /** Account ID */
  accountId: string;
  /** Strategy information */
  strategy?: {
    version?: string;
    name?: string;
    source?: string;
  };
  /** Risk rule bundle */
  ruleBundle?: {
    takeProfitPct: number;
    stopLossPct: number;
  };
  /** Chase information */
  chaseInfo?: {
    attempts: number;
    initialPrice: number;
    finalPrice?: number;
    totalTimeMs: number;
    strategy: string;
  };
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Trade history query filters.
 */
export interface TradeHistoryFilters {
  /** Filter by account ID */
  accountId?: string;
  /** Filter by state */
  state?: TradeState;
  /** Filter by date range (start) */
  startDate?: string;
  /** Filter by date range (end) */
  endDate?: string;
  /** Filter by underlying symbol */
  underlying?: string;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Trade history statistics.
 */
export interface TradeHistoryStats {
  /** Total number of trades */
  totalTrades: number;
  /** Trades by state */
  byState: Record<TradeState, number>;
  /** Trades today */
  tradesToday: number;
  /** Total P/L */
  totalProfitLoss?: number;
  /** Winning trades count */
  winningTrades: number;
  /** Losing trades count */
  losingTrades: number;
}

/**
 * Path to the trade history storage file.
 * In production, replace this with database operations.
 */
const HISTORY_FILE_PATH = path.join(process.cwd(), '.data', 'trade-history.json');

/**
 * Ensure the data directory exists.
 */
async function ensureDataDirectory(): Promise<void> {
  const dataDir = path.dirname(HISTORY_FILE_PATH);
  try {
    await fs.mkdir(dataDir, { recursive: true });
  } catch (error) {
    logger.error('Failed to create data directory', { path: dataDir }, error as Error);
    throw error;
  }
}

/**
 * Load all trade history records from storage.
 */
async function loadHistory(): Promise<TradeHistoryRecord[]> {
  try {
    await ensureDataDirectory();
    const data = await fs.readFile(HISTORY_FILE_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist yet - return empty array
      return [];
    }
    logger.error('Failed to load trade history', {}, error);
    throw error;
  }
}

/**
 * Save all trade history records to storage.
 */
async function saveHistory(records: TradeHistoryRecord[]): Promise<void> {
  try {
    await ensureDataDirectory();
    await fs.writeFile(HISTORY_FILE_PATH, JSON.stringify(records, null, 2), 'utf-8');
  } catch (error) {
    logger.error('Failed to save trade history', {}, error as Error);
    throw error;
  }
}

/**
 * Trade history service.
 */
class TradeHistoryService {
  /**
   * Creates or updates a trade history record.
   * Should be called whenever a trade is created or updated.
   */
  async saveTrade(trade: Trade, intent?: TradeExecutionIntent, order?: AppOrder): Promise<void> {
    try {
      const records = await loadHistory();
      
      // Find existing record or create new one
      let recordIndex = records.findIndex(r => r.tradeId === trade.id);
      let record: TradeHistoryRecord;
      
      if (recordIndex >= 0) {
        record = records[recordIndex];
      } else {
        // Create new record
        record = {
          tradeId: trade.id,
          stateHistory: trade.stateHistory,
          currentState: trade.state,
          createdAt: trade.createdAt,
          updatedAt: trade.updatedAt,
          orderIds: [],
          legs: intent?.legs?.map(leg => ({
            symbol: leg.symbol || '',
            instrumentType: leg.instrumentType || 'option',
            quantity: leg.quantity || 0,
            action: leg.action || 'BUY_TO_OPEN',
            price: leg.price,
          })) || [],
          quantity: intent?.quantity || 0,
          accountId: intent?.accountId || '',
          strategy: {
            version: intent?.metadata?.strategyVersion,
            name: intent?.metadata?.strategyName,
            source: intent?.metadata?.source,
          },
          ruleBundle: intent?.ruleBundle,
          metadata: { ...trade.metadata, ...intent?.metadata },
        };
      }
      
      // Update existing record
      record.stateHistory = trade.stateHistory;
      record.currentState = trade.state;
      record.updatedAt = trade.updatedAt;
      
      if (trade.orderId && !record.orderIds.includes(trade.orderId)) {
        record.orderIds.push(trade.orderId);
      }
      
      if (trade.positionId) {
        record.positionId = trade.positionId;
      }
      
      // Update order information
      if (order) {
        if (!record.entryOrder || record.entryOrder.orderId !== order.id) {
          record.entryOrder = {
            orderId: order.id,
            clientOrderId: order.clientOrderId || '',
            status: order.status || 'UNKNOWN',
            quantity: order.quantity || 0,
            limitPrice: order.limitPrice,
            fillPrice: order.fillPrice,
            filledAt: order.filledAt,
            netPrice: order.netPrice,
          };
          
          if (order.netPrice) {
            record.entryCredit = order.netPrice;
          }
        }
      }
      
      // Update metadata
      if (trade.metadata) {
        record.metadata = { ...record.metadata, ...trade.metadata };
      }
      
      // Save updated records
      if (recordIndex >= 0) {
        records[recordIndex] = record;
      } else {
        records.push(record);
      }
      
      await saveHistory(records);
      
      logger.debug('Trade history saved', { tradeId: trade.id, state: trade.state });
    } catch (error) {
      logger.error('Failed to save trade to history', { tradeId: trade.id }, error as Error);
      // Don't throw - history saving shouldn't break the trade flow
    }
  }
  
  /**
   * Updates bracket information for a trade.
   */
  async updateBrackets(
    tradeId: string,
    brackets: {
      takeProfit?: { orderId: string; price: number };
      stopLoss?: { orderId: string; price: number };
    }
  ): Promise<void> {
    try {
      const records = await loadHistory();
      const recordIndex = records.findIndex(r => r.tradeId === tradeId);
      
      if (recordIndex >= 0) {
        records[recordIndex].brackets = {
          takeProfit: brackets.takeProfit ? {
            orderId: brackets.takeProfit.orderId,
            price: brackets.takeProfit.price,
            status: 'WORKING',
          } : records[recordIndex].brackets?.takeProfit,
          stopLoss: brackets.stopLoss ? {
            orderId: brackets.stopLoss.orderId,
            price: brackets.stopLoss.price,
            status: 'WORKING',
          } : records[recordIndex].brackets?.stopLoss,
        };
        records[recordIndex].updatedAt = new Date().toISOString();
        await saveHistory(records);
      }
    } catch (error) {
      logger.error('Failed to update brackets in history', { tradeId }, error as Error);
    }
  }
  
  /**
   * Updates exit order information.
   */
  async updateExitOrder(
    tradeId: string,
    exitOrder: {
      orderId: string;
      status: string;
      fillPrice?: number;
      filledAt?: string;
      exitType: 'take_profit' | 'stop_loss' | 'manual';
    }
  ): Promise<void> {
    try {
      const records = await loadHistory();
      const recordIndex = records.findIndex(r => r.tradeId === tradeId);
      
      if (recordIndex >= 0) {
        const record = records[recordIndex];
        record.exitOrder = exitOrder;
        
        // Calculate P/L if we have entry and exit prices
        if (exitOrder.fillPrice && record.entryCredit !== undefined) {
          record.exitCredit = exitOrder.fillPrice;
          // For credit spreads: P/L = entry credit - exit debit
          // If exitCredit is positive, we paid to close (debit), so P/L = entry - exit
          record.profitLoss = record.entryCredit - exitOrder.fillPrice;
        }
        
        record.updatedAt = new Date().toISOString();
        await saveHistory(records);
      }
    } catch (error) {
      logger.error('Failed to update exit order in history', { tradeId }, error as Error);
    }
  }
  
  /**
   * Updates chase information.
   */
  async updateChaseInfo(
    tradeId: string,
    chaseInfo: {
      attempts: number;
      initialPrice: number;
      finalPrice?: number;
      totalTimeMs: number;
      strategy: string;
    }
  ): Promise<void> {
    try {
      const records = await loadHistory();
      const recordIndex = records.findIndex(r => r.tradeId === tradeId);
      
      if (recordIndex >= 0) {
        records[recordIndex].chaseInfo = chaseInfo;
        records[recordIndex].updatedAt = new Date().toISOString();
        await saveHistory(records);
      }
    } catch (error) {
      logger.error('Failed to update chase info in history', { tradeId }, error as Error);
    }
  }
  
  /**
   * Retrieves a trade history record by ID.
   */
  async getTrade(tradeId: string): Promise<TradeHistoryRecord | null> {
    try {
      const records = await loadHistory();
      return records.find(r => r.tradeId === tradeId) || null;
    } catch (error) {
      logger.error('Failed to get trade from history', { tradeId }, error as Error);
      return null;
    }
  }
  
  /**
   * Queries trade history with filters.
   */
  async queryHistory(filters: TradeHistoryFilters = {}): Promise<TradeHistoryRecord[]> {
    try {
      let records = await loadHistory();
      
      // Apply filters
      if (filters.accountId) {
        records = records.filter(r => r.accountId === filters.accountId);
      }
      
      if (filters.state) {
        records = records.filter(r => r.currentState === filters.state);
      }
      
      if (filters.startDate) {
        records = records.filter(r => r.createdAt >= filters.startDate!);
      }
      
      if (filters.endDate) {
        records = records.filter(r => r.createdAt <= filters.endDate!);
      }
      
      if (filters.underlying) {
        records = records.filter(r => 
          r.legs.some(leg => leg.symbol.includes(filters.underlying!))
        );
      }
      
      // Sort by createdAt descending (newest first)
      records.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      
      // Apply pagination
      const offset = filters.offset || 0;
      const limit = filters.limit;
      
      if (limit) {
        return records.slice(offset, offset + limit);
      }
      
      return records.slice(offset);
    } catch (error) {
      logger.error('Failed to query trade history', { filters }, error as Error);
      return [];
    }
  }
  
  /**
   * Gets trade history statistics.
   */
  async getStats(filters: { accountId?: string; startDate?: string; endDate?: string } = {}): Promise<TradeHistoryStats> {
    try {
      const records = await this.queryHistory(filters);
      
      const today = new Date().toISOString().split('T')[0];
      const tradesToday = records.filter(r => r.createdAt.startsWith(today)).length;
      
      const byState: Record<TradeState, number> = {} as Record<TradeState, number>;
      for (const state of Object.values(TradeState)) {
        byState[state] = records.filter(r => r.currentState === state).length;
      }
      
      const completedTrades = records.filter(r => 
        r.currentState === TradeState.CLOSED && r.profitLoss !== undefined
      );
      
      const totalProfitLoss = completedTrades.reduce((sum, r) => 
        sum + (r.profitLoss || 0), 0
      );
      
      const winningTrades = completedTrades.filter(r => (r.profitLoss || 0) > 0).length;
      const losingTrades = completedTrades.filter(r => (r.profitLoss || 0) < 0).length;
      
      return {
        totalTrades: records.length,
        byState,
        tradesToday,
        totalProfitLoss,
        winningTrades,
        losingTrades,
      };
    } catch (error) {
      logger.error('Failed to get trade history stats', { filters }, error as Error);
      return {
        totalTrades: 0,
        byState: {} as Record<TradeState, number>,
        tradesToday: 0,
        winningTrades: 0,
        losingTrades: 0,
      };
    }
  }
  
  /**
   * Gets all trades for today.
   */
  async getTradesToday(accountId?: string): Promise<TradeHistoryRecord[]> {
    const today = new Date().toISOString().split('T')[0];
    return this.queryHistory({
      startDate: `${today}T00:00:00.000Z`,
      endDate: `${today}T23:59:59.999Z`,
      accountId,
    });
  }
}

/**
 * Singleton instance of trade history service.
 */
export const tradeHistoryService = new TradeHistoryService();
