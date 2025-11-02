/**
 * State monitoring service.
 * 
 * Monitors trade state machine transitions and logs all state changes
 * with timestamps for latency tracking and audit trails. Provides
 * real-time metrics for dashboard consumption.
 * 
 * @module monitor/stateMonitor
 */

import { db } from '../db/client';
import { createTrade, updateTrade } from '../db/services/tradeService';
import { auditLogger } from '../auditLogger';
import { onTransition, TradeState, type Trade, type StateTransitionEvent } from '../tradeStateMachine';
import { logger } from '../logger';

/**
 * Metrics tracked by the monitor.
 */
export interface StateMetrics {
  trades_active: number;
  trades_filled: number;
  trades_closed: number;
  trades_rejected: number;
  avg_latency_ms: number;
  avg_slippage: number;
}

/**
 * State monitoring service.
 */
class StateMonitor {
  private initializationPromise: Promise<void>;

  constructor() {
    this.initializationPromise = this.initialize();
  }

  /**
   * Initialize monitoring.
   */
  private async initialize(): Promise<void> {
    // Wait for database to be ready
    await this.waitForDatabase();

    // Subscribe to state machine transitions
    onTransition((event: StateTransitionEvent) => {
      this.handleStateTransition(event);
    });

    logger.info('State monitor initialized');
  }

  /**
   * Wait for database to be ready.
   */
  private async waitForDatabase(): Promise<void> {
    // Poll until database is ready (simple implementation)
    let attempts = 0;
    while (attempts < 10) {
      try {
        // Try a simple operation
        db.getAllTrades();
        return;
      } catch {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
      }
    }
  }

  /**
   * Handle state machine transition.
   */
  private handleStateTransition(event: StateTransitionEvent): void {
    try {
      // Log transition to audit logger
      auditLogger.logTradeTransition({
        timestamp: event.timestamp,
        trade_id: event.tradeId,
        state: event.toState,
        action: 'state_transition',
        reason: `Transition: ${event.fromState} → ${event.toState}`,
        metadata: event.metadata,
      });

      // Update trade record in database
      const existingTrade = db.getTrade(event.tradeId);
      if (existingTrade) {
        updateTrade(event.tradeId, { current_state: event.toState });
      } else {
        // Create new trade record if it doesn't exist (if intent_id is available)
        if (event.metadata?.intent_id) {
          createTrade({
            intent_id: event.metadata.intent_id,
            current_state: event.toState,
            metadata: event.metadata,
          });
        }
      }

      logger.info('State transition monitored', {
        trade_id: event.tradeId,
        from: event.fromState,
        to: event.toState,
      });
    } catch (error) {
      logger.error('Failed to monitor state transition', undefined, error as Error);
    }
  }

  /**
   * Get current metrics.
   */
  async getMetrics(): Promise<StateMetrics> {
    await this.initializationPromise;

    const allTrades = db.getAllTrades();

    const metrics: StateMetrics = {
      trades_active: allTrades.filter(t => 
        ['PENDING', 'SUBMITTED', 'WORKING', 'FILLED', 'OCO_ATTACHED'].includes(t.current_state)
      ).length,
      trades_filled: allTrades.filter(t => t.current_state === 'FILLED').length,
      trades_closed: allTrades.filter(t => t.current_state === 'CLOSED').length,
      trades_rejected: allTrades.filter(t => ['REJECTED', 'CANCELLED'].includes(t.current_state)).length,
      avg_latency_ms: 0, // TODO: Compute from fills
      avg_slippage: 0, // TODO: Compute from fills
    };

    return metrics;
  }

  /**
   * Track fill event.
   */
  async trackFill(tradeId: string, orderId: string, fillPrice: number, latencyMs: number): Promise<void> {
    await this.initializationPromise;

    const fillId = `fill-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Note: We need to implement createFill in fillService
    // For now, log to audit logger
    auditLogger.logFill({
      timestamp: new Date().toISOString(),
      trade_id: tradeId,
      state: TradeState.FILLED,
      action: 'fill_confirmed',
      reason: 'Order filled',
      price: fillPrice,
      order_id: orderId,
      metadata: {
        latency_ms: latencyMs,
      },
    });

    logger.info('Fill tracked', {
      trade_id: tradeId,
      order_id: orderId,
      fill_price: fillPrice,
      latency_ms: latencyMs,
    });
  }
}

/**
 * Singleton state monitor instance.
 */
export const stateMonitor = new StateMonitor();

