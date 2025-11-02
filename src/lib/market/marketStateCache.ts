/**
 * Market state cache for maintaining rolling quote + Greeks data.
 * 
 * Subscribes to Tastytrade DXLink WebSocket and caches the latest market state
 * for all active symbols. Provides staleness tracking and warnings.
 * 
 * @module market/marketStateCache
 */

import { EventEmitter } from 'events';
import { quoteEmitter, subscribeQuotes, getSubscribedSymbols } from '../tastytrade/marketData';
import type { GreekQuote } from '../tastytrade/types';
import { logger } from '../logger';

/**
 * Cached market state for a symbol.
 */
export interface MarketState {
  symbol: string;
  quote: GreekQuote;
  staleness_ms: number;
  last_update: string;
}

/**
 * Cache of market states by symbol.
 */
class MarketStateCache {
  private cache: Map<string, MarketState>;
  private emitter: EventEmitter;
  private stalenessWarningThreshold: number;
  private stalenessWarnings: Set<string>;

  constructor() {
    this.cache = new Map();
    this.emitter = new EventEmitter();
    this.stalenessWarningThreshold = 2000; // 2 seconds
    this.stalenessWarnings = new Set();
    
    this.setupQuoteListener();
    this.startStalenessMonitoring();
  }

  /**
   * Setup listener for quote updates from DXLink.
   */
  private setupQuoteListener(): void {
    quoteEmitter.on('quote', (quote: GreekQuote) => {
      this.updateMarketState(quote);
    });

    quoteEmitter.on('error', (error: Error) => {
      logger.error('Quote stream error in market cache', undefined, error);
      this.emitter.emit('error', error);
    });
  }

  /**
   * Update market state cache from a quote.
   */
  private updateMarketState(quote: GreekQuote): void {
    const now = Date.now();
    const lastUpdate = new Date().toISOString();
    
    const state: MarketState = {
      symbol: quote.symbol,
      quote,
      staleness_ms: 0,
      last_update: lastUpdate,
    };

    this.cache.set(quote.symbol, state);

    // Clear staleness warning if data is fresh
    if (this.stalenessWarnings.has(quote.symbol)) {
      this.stalenessWarnings.delete(quote.symbol);
      logger.info('Market data freshness restored', { symbol: quote.symbol });
    }

    this.emitter.emit('update', state);
  }

  /**
   * Start monitoring for stale data.
   */
  private startStalenessMonitoring(): void {
    setInterval(() => {
      const now = Date.now();
      
      this.cache.forEach((state, symbol) => {
        const lastUpdateTime = new Date(state.last_update).getTime();
        const staleness = now - lastUpdateTime;
        
        // Update staleness in cache
        state.staleness_ms = staleness;

        // Emit warning if threshold exceeded
        if (
          staleness > this.stalenessWarningThreshold &&
          !this.stalenessWarnings.has(symbol)
        ) {
          this.stalenessWarnings.add(symbol);
          logger.warn('Market data staleness warning', {
            symbol,
            staleness_ms: staleness,
          });
          this.emitter.emit('staleness', { symbol, staleness_ms: staleness });
        }
      });
    }, 1000); // Check every second
  }

  /**
   * Get market state for a symbol.
   */
  getMarketState(symbol: string): MarketState | undefined {
    return this.cache.get(symbol);
  }

  /**
   * Get market state for multiple symbols.
   */
  getMarketStates(symbols: string[]): Map<string, MarketState> {
    const states = new Map<string, MarketState>();
    symbols.forEach(symbol => {
      const state = this.cache.get(symbol);
      if (state) {
        states.set(symbol, state);
      }
    });
    return states;
  }

  /**
   * Subscribe to market data for symbols.
   */
  async subscribe(symbols: string[]): Promise<void> {
    const currentSubscriptions = getSubscribedSymbols();
    const newSymbols = symbols.filter(s => !currentSubscriptions.includes(s));

    if (newSymbols.length > 0) {
      try {
        await subscribeQuotes(newSymbols);
        logger.info('Subscribed to market data', { symbols: newSymbols });
      } catch (error) {
        logger.error('Failed to subscribe to market data', undefined, error as Error);
        throw error;
      }
    }
  }

  /**
   * Check if data is fresh (within tolerance).
   */
  isFresh(symbol: string, maxStalenessMs: number = 500): boolean {
    const state = this.cache.get(symbol);
    if (!state) {
      return false;
    }
    return state.staleness_ms <= maxStalenessMs;
  }

  /**
   * Get all cached symbols.
   */
  getCachedSymbols(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Subscribe to events.
   */
  on(event: 'update' | 'staleness' | 'error', callback: (...args: any[]) => void): void {
    this.emitter.on(event, callback);
  }

  /**
   * Unsubscribe from events.
   */
  off(event: 'update' | 'staleness' | 'error', callback: (...args: any[]) => void): void {
    this.emitter.off(event, callback);
  }
}

/**
 * Singleton market state cache instance.
 */
export const marketStateCache = new MarketStateCache();

