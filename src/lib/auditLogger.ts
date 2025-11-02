/**
 * Audit trail logging for trade lifecycle.
 * 
 * Provides structured, audit-grade logging for regulatory compliance
 * and automated journaling. All logs are JSON-formatted and include
 * complete trade context.
 */

import { logger } from './logger';
import type { TradeState } from './tradeStateMachine';

/**
 * Trade lifecycle log entry.
 */
export interface TradeLogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Trade ID */
  trade_id: string;
  /** Current state */
  state: TradeState;
  /** Action taken */
  action: string;
  /** Reason for action */
  reason: string;
  /** Price (if applicable) */
  price?: number;
  /** Delta (if applicable) */
  delta?: number;
  /** Greeks data (if applicable) */
  greeks?: {
    delta?: number;
    gamma?: number;
    theta?: number;
    vega?: number;
  };
  /** Order ID (if applicable) */
  order_id?: string;
  /** Client order ID */
  client_order_id?: string;
  /** Strategy version */
  strategy_version?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Risk check log entry.
 */
export interface RiskCheckLogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Trade ID */
  trade_id: string;
  /** Rules evaluated */
  rules: Array<{
    name: string;
    passed: boolean;
    reason?: string;
  }>;
  /** Overall result */
  result: 'passed' | 'failed' | 'warned';
  /** Action taken */
  action: string;
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Chase decision log entry.
 */
export interface ChaseDecisionLogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Trade ID */
  trade_id: string;
  /** Order ID */
  order_id: string;
  /** Attempt number */
  attempt: number;
  /** Elapsed time in ms */
  elapsed_ms: number;
  /** Chase parameters */
  params: {
    mid: number;
    bid: number;
    ask: number;
    initial_price: number;
    underlying: string;
  };
  /** Computed chase price */
  computed_price: number;
  /** Strategy used */
  strategy: string;
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Fill confirmation log entry.
 */
export interface FillConfirmationLogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Trade ID */
  trade_id: string;
  /** Client order ID */
  client_order_id: string;
  /** Broker order ID */
  broker_order_id: string;
  /** Fill price */
  fill_price: number;
  /** Retry count */
  retry_count: number;
  /** Slippage */
  slippage: number;
  /** Time to fill in ms */
  time_to_fill_ms: number;
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Portfolio exposure log entry.
 */
export interface PortfolioExposureLogEntry {
  /** ISO timestamp */
  timestamp: string;
  /** Portfolio snapshot */
  exposure: {
    total_short_delta: number;
    total_net_credit: number;
    margin_usage: number;
    by_underlying: Array<{
      underlying: string;
      short_delta: number;
      net_credit: number;
      position_count: number;
    }>;
  };
  /** Limits checked */
  limits: {
    max_short_delta?: number;
    max_net_credit?: number;
    max_margin_usage?: number;
  };
  /** Check result */
  result: 'within_limits' | 'warning' | 'rejected';
  /** Action taken */
  action: string;
}

/**
 * Audit logger for structured trade logging.
 */
class AuditLogger {
  /**
   * Log trade state transition.
   */
  logTradeTransition(entry: TradeLogEntry): void {
    logger.info('Trade transition', entry as any);
  }

  /**
   * Log order submission.
   */
  logOrderSubmission(entry: TradeLogEntry): void {
    logger.info('Order submitted', entry as any);
  }

  /**
   * Log order fill.
   */
  logOrderFill(entry: FillConfirmationLogEntry): void {
    logger.info('Order filled', entry as any);
  }

  /**
   * Log order cancellation.
   */
  logOrderCancellation(entry: TradeLogEntry): void {
    logger.info('Order cancelled', entry as any);
  }

  /**
   * Log risk check result.
   */
  logRiskCheck(entry: RiskCheckLogEntry): void {
    const level = entry.result === 'failed' ? 'warn' : 'info';
    logger[level]('Risk check', entry as any);
  }

  /**
   * Log chase attempt.
   */
  logChaseAttempt(entry: ChaseDecisionLogEntry): void {
    logger.info('Chase attempt', entry as any);
  }

  /**
   * Log chase completion.
   */
  logChaseComplete(entry: {
    trade_id: string;
    order_id: string;
    total_attempts: number;
    final_price: number;
    success: boolean;
    reason?: string;
  }): void {
    const level = entry.success ? 'info' : 'warn';
    logger[level]('Chase complete', entry as any);
  }

  /**
   * Log bracket attachment.
   */
  logBracketAttached(entry: {
    trade_id: string;
    parent_order_id: string;
    take_profit_order_id: string;
    stop_loss_order_id: string;
    take_profit_price: number;
    stop_loss_price: number;
  }): void {
    logger.info('Brackets attached', entry as any);
  }

  /**
   * Log portfolio exposure check.
   */
  logPortfolioExposure(entry: PortfolioExposureLogEntry): void {
    const level = entry.result === 'rejected' ? 'warn' : 'info';
    logger[level]('Portfolio exposure check', entry as any);
  }

  /**
   * Log strategy version used.
   */
  logStrategyVersion(entry: {
    trade_id: string;
    strategy_version: string;
    chase_strategy: string;
    risk_rule_set: string;
    config_snapshot: Record<string, any>;
  }): void {
    logger.info('Strategy version', entry as any);
  }

  /**
   * Log error with full trade context.
   */
  logTradeError(entry: {
    trade_id: string;
    error: string;
    error_type: string;
    stack?: string;
    context?: Record<string, any>;
  }): void {
    logger.error('Trade error', entry as any);
  }

  /**
   * Log manual user action.
   */
  logUserAction(entry: {
    trade_id: string;
    action: string;
    user?: string;
    reason?: string;
    metadata?: Record<string, any>;
  }): void {
    logger.info('User action', entry as any);
  }

  /**
   * Log configuration change.
   */
  logConfigChange(entry: {
    config_type: 'chase_strategy' | 'risk_rule' | 'delta_config' | 'portfolio_limit';
    old_value: any;
    new_value: any;
    changed_by?: string;
  }): void {
    logger.info('Configuration change', entry as any);
  }
}

/**
 * Singleton instance of audit logger.
 */
export const auditLogger = new AuditLogger();

/**
 * Convenience function to log trade state transition.
 */
export function logTradeTransition(
  tradeId: string,
  fromState: TradeState,
  toState: TradeState,
  reason: string,
  metadata?: Record<string, any>
): void {
  auditLogger.logTradeTransition({
    timestamp: new Date().toISOString(),
    trade_id: tradeId,
    state: toState,
    action: `transition_${fromState}_to_${toState}`,
    reason,
    metadata,
  });
}

/**
 * Convenience function to log chase attempt.
 */
export function logChaseAttempt(
  tradeId: string,
  orderId: string,
  attempt: number,
  elapsedMs: number,
  strategy: string,
  params: ChaseDecisionLogEntry['params'],
  computedPrice: number
): void {
  auditLogger.logChaseAttempt({
    timestamp: new Date().toISOString(),
    trade_id: tradeId,
    order_id: orderId,
    attempt,
    elapsed_ms: elapsedMs,
    params,
    computed_price: computedPrice,
    strategy,
  });
}

