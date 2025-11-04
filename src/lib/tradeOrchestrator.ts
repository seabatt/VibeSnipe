/**
 * Trade orchestrator.
 * 
 * Manages the full trade lifecycle by coordinating the state machine,
 * execution service, and chase engine. This is the "brain" that decides
 * when to call which execution methods based on state transitions.
 * 
 * Key principle: The orchestrator decides when to execute, the execution
 * service decides how to execute (calls broker APIs).
 * 
 * @module tradeOrchestrator
 */

import {
  createTrade,
  getTrade,
  transitionState,
  updateTradeMetadata,
  type Trade,
  TradeState,
} from './tradeStateMachine';

import {
  executeSubmitOrder,
  executeCancelOrder,
  executeReplaceOrder,
  executeAttachBrackets,
  executeClosePosition,
  type TradeExecutionIntent,
  type SubmitResult,
} from './tastytrade/executionService';

import {
  buildTradeIntent,
  validateTradeIntent,
  type TradeIntent,
} from './tradeIntent';

import { chaseOrder } from './tastytrade/chaseEngine';
import type { ChaseConfig } from './tastytrade/chaseEngine';
import type { VerticalLegs } from './tastytrade/types';
import { logger } from './logger';
import { canAddTrade } from './risk/portfolioTracker';
import { tradeHistoryService } from './tradeHistoryService';

/**
 * Orchestration configuration.
 */
export interface OrchestrationConfig {
  /** Whether to enable order chasing */
  enableChase: boolean;
  /** Chase configuration (if enabled) */
  chaseConfig?: ChaseConfig;
  /** Whether to attach brackets after fill */
  attachBrackets: boolean;
}

/**
 * Trade execution result.
 */
export interface TradeResult {
  /** Trade instance */
  trade: Trade;
  /** Success flag */
  success: boolean;
  /** Error message (if failed) */
  error?: string;
  /** Final order details */
  order?: any;
  /** Bracket details (if attached) */
  brackets?: any;
}

/**
 * Default orchestration configuration.
 */
const DEFAULT_CONFIG: OrchestrationConfig = {
  enableChase: true,
  attachBrackets: true,
  chaseConfig: {
    stepSize: 0.05,
    stepIntervalMs: 1000,
    maxSteps: 10,
    maxSlippage: 0.50,
    direction: 'up',
    initialPrice: 0,
  },
};

/**
 * Executes a full trade lifecycle.
 * 
 * This is the main orchestrator method that:
 * 1. Creates and validates the trade intent
 * 2. Creates a state machine instance
 * 3. Submits the order
 * 4. Optionally chases the order
 * 5. Attaches brackets after fill
 * 6. Returns the final result
 * 
 * @param intent - Trade intent to execute
 * @param verticalLegs - Pre-built vertical legs (required)
 * @param config - Orchestration configuration
 * @returns Trade result
 * @throws Error if orchestration fails
 * 
 * @example
 * ```ts
 * const intent = buildTradeIntent({
 *   legs: [...],
 *   quantity: 1,
 *   limitPrice: 2.50,
 *   orderType: 'LIMIT',
 *   ruleBundle: { takeProfitPct: 50, stopLossPct: 100 },
 *   accountId: 'account-123',
 *   source: 'manual',
 * });
 * 
 * const result = await executeTradeLifecycle(
 *   intent,
 *   verticalLegs,
 *   { enableChase: true, attachBrackets: true }
 * );
 * 
 * if (result.success) {
 *   console.log(`Trade complete: ${result.trade.id}`);
 * }
 * ```
 */
export async function executeTradeLifecycle(
  intent: TradeIntent,
  verticalLegs: VerticalLegs,
  config: Partial<OrchestrationConfig> = {}
): Promise<TradeResult> {
  // Merge config with defaults
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  // Validate intent
  if (!validateTradeIntent(intent)) {
    const error = 'Invalid trade intent';
    logger.error(error, { intent });
    throw new Error(error);
  }

  // Check portfolio limits before proceeding
  try {
    // Build a TradeSpec from the intent for portfolio checking
    const tradeSpec = {
      underlying: intent.legs[0]?.expiry.split('_')[0] || 'UNKNOWN', // Extract from expiry format
      strategy: 'vertical',
      direction: intent.legs[0]?.right === 'CALL' ? 'CALL' as const : 'PUT' as const,
      strikes: intent.legs.map(l => l.strike),
      target_delta: 0.50, // Default, would come from metadata
      quantity: intent.quantity,
      price: intent.limitPrice || 0,
      expiry: intent.legs[0]?.expiry || '',
      accountId: intent.accountId,
      ruleBundle: {
        takeProfitPct: intent.ruleBundle.takeProfitPct ?? 50, // Default to 50% if null
        stopLossPct: intent.ruleBundle.stopLossPct ?? 100, // Default to 100% if null
      },
      strategy_version: intent.strategyVersion,
    };

    const portfolioCheck = canAddTrade(tradeSpec);
    if (!portfolioCheck.can_add) {
      const error = `Portfolio limit check failed: ${portfolioCheck.reason}`;
      logger.warn(error, { 
        tradeId: intent.id, 
        current: portfolioCheck.current_exposure,
        projected: portfolioCheck.projected_exposure,
      });
      // Return error without creating trade in state machine
      return {
        trade: { id: intent.id, state: TradeState.REJECTED } as Trade,
        success: false,
        error,
      };
    }
  } catch (error) {
    logger.error('Failed to check portfolio limits', { tradeId: intent.id }, error as Error);
    // Continue anyway but log the error
  }

  // Create trade in state machine
  let trade: Trade;
  try {
    trade = createTrade(intent.id, {
      source: intent.source,
      verticalLegs,
    });
    logger.info('Trade created in state machine', { tradeId: trade.id });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to create trade';
    logger.error('Failed to create trade in state machine', undefined, error as Error);
    throw new Error(errorMsg);
  }

  // Transition to SUBMITTED
  try {
    trade = transitionState(trade.id, TradeState.SUBMITTED);
    logger.info('Trade transitioned to SUBMITTED', { tradeId: trade.id });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Invalid state transition';
    logger.error('Failed to transition to SUBMITTED', { tradeId: trade.id }, error as Error);
    trade = transitionState(trade.id, TradeState.ERROR, errorMsg);
    return {
      trade,
      success: false,
      error: errorMsg,
    };
  }

  // Build execution intent
  const executionIntent: TradeExecutionIntent = {
    tradeId: trade.id,
    legs: intent.legs,
    quantity: intent.quantity,
    limitPrice: intent.limitPrice,
    orderType: intent.orderType,
    ruleBundle: intent.ruleBundle,
    accountId: intent.accountId,
    verticalLegs,
    metadata: intent.metadata,
  };

  // Submit order
  let submitResult: SubmitResult;
  try {
    submitResult = await executeSubmitOrder(executionIntent);
    
    // Update trade with order ID
    trade = updateTradeMetadata(trade.id, {
      orderId: submitResult.order.id,
    });
    
    // Persist trade with order details
    await tradeHistoryService.saveTrade(trade, executionIntent, submitResult.order);
    
    logger.info('Order submitted successfully', {
      tradeId: trade.id,
      orderId: submitResult.order.id,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Failed to submit order';
    logger.error('Order submission failed', { tradeId: trade.id }, error as Error);
    trade = transitionState(trade.id, TradeState.REJECTED, errorMsg);
    
    // Persist failed trade
    await tradeHistoryService.saveTrade(trade, executionIntent);
    
    return {
      trade,
      success: false,
      error: errorMsg,
    };
  }

  // Transition to WORKING or FILLED based on order status
  if (submitResult.order.status === 'FILLED') {
    trade = transitionState(trade.id, TradeState.FILLED);
    // Persist updated trade state
    await tradeHistoryService.saveTrade(trade, executionIntent, submitResult.order);
    logger.info('Order filled immediately', { tradeId: trade.id });
  } else {
    trade = transitionState(trade.id, TradeState.WORKING);
    // Persist updated trade state
    await tradeHistoryService.saveTrade(trade, executionIntent, submitResult.order);
    logger.info('Order is working', { tradeId: trade.id });
  }

  // Optionally chase the order
  if (finalConfig.enableChase && submitResult.chaseable && trade.state === TradeState.WORKING) {
    try {
      // Prepare chase config
      const chaseConfig: ChaseConfig = {
        ...finalConfig.chaseConfig!,
        initialPrice: submitResult.order.netPrice || finalConfig.chaseConfig!.initialPrice,
      };

      // Chase the order
      const chaseResult = await chaseOrder(submitResult.order, {
        accountId: intent.accountId,
        chase: chaseConfig,
      });

      // Update trade with latest order status
      trade = updateTradeMetadata(trade.id, {
        orderId: chaseResult.orderId,
      });

      // Transition based on chase result
      if ('fillPrice' in chaseResult) {
        trade = transitionState(trade.id, TradeState.FILLED);
        
        // Update chase info in history
        if (submitResult.order.netPrice !== undefined) {
          await tradeHistoryService.updateChaseInfo(trade.id, {
            attempts: chaseResult.totalAttempts,
            initialPrice: submitResult.order.netPrice,
            finalPrice: chaseResult.fillPrice,
            totalTimeMs: chaseResult.totalAttempts * (finalConfig.chaseConfig?.stepIntervalMs || 1000),
            strategy: finalConfig.chaseConfig?.direction || 'up',
          });
        }
        
        // Persist updated trade state
        await tradeHistoryService.saveTrade(trade, executionIntent, submitResult.order);
        
        logger.info('Order filled after chase', {
          tradeId: trade.id,
          attempts: chaseResult.totalAttempts,
        });
      } else {
        // Chase aborted - transition to error state
        trade = transitionState(
          trade.id,
          TradeState.ERROR,
          chaseResult.error || chaseResult.reason
        );
        
        // Persist updated trade state
        await tradeHistoryService.saveTrade(trade, executionIntent, submitResult.order);
        
        logger.warn('Order chase aborted', {
          tradeId: trade.id,
          reason: chaseResult.reason,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Chase failed';
      logger.error('Chase failed', { tradeId: trade.id }, error as Error);
      trade = transitionState(trade.id, TradeState.ERROR, errorMsg);
    }
  }

  // If not filled, return current state
  if (trade.state !== TradeState.FILLED) {
    return {
      trade,
      success: trade.state === TradeState.WORKING,
      order: submitResult.order,
    };
  }

  // Attach brackets if enabled
  let brackets;
  if (finalConfig.attachBrackets) {
    try {
      // Check if rule bundle has TP/SL configured
      const takeProfitPct = intent.ruleBundle.takeProfitPct;
      const stopLossPct = intent.ruleBundle.stopLossPct;
      
      if (takeProfitPct === null || stopLossPct === null) {
        logger.warn('Brackets not attached - TP/SL not configured', {
          tradeId: trade.id,
          takeProfitPct,
          stopLossPct,
        });
      } else {
        // Calculate TP/SL prices from rule bundle
        // For credit spreads, TP is LOWER price (buy back cheaper), SL is HIGHER price (buy back more)
        const entryCredit = submitResult.order.netPrice || intent.limitPrice || 0;
        
        // TP: Buy back at (1 - takeProfitPct%) of credit = 0.50 * credit for 50% TP
        // SL: Buy back at (1 + stopLossPct%) of credit = 2.00 * credit for 100% SL
        const tpPrice = entryCredit * (1 - takeProfitPct / 100);
        const slPrice = entryCredit * (1 + stopLossPct / 100);
        
        // Ensure prices are positive and SL > TP
        const finalTpPrice = Math.max(0.05, tpPrice);
        const finalSlPrice = Math.max(finalTpPrice + 0.05, slPrice);

        const bracketResult = await executeAttachBrackets(
          submitResult.order.id,
          finalTpPrice,
          finalSlPrice,
          intent.accountId,
          verticalLegs,
          intent.quantity,
          trade.id
        );

        brackets = bracketResult.bracket;
        trade = transitionState(trade.id, TradeState.OCO_ATTACHED);
        
        // Persist bracket information to history
        await tradeHistoryService.updateBrackets(trade.id, {
          takeProfit: bracketResult.bracket.takeProfit ? {
            orderId: bracketResult.bracket.takeProfit.orderId,
            price: finalTpPrice,
          } : undefined,
          stopLoss: bracketResult.bracket.stopLoss ? {
            orderId: bracketResult.bracket.stopLoss.orderId,
            price: finalSlPrice,
          } : undefined,
        });
        
        // Persist updated trade state
        await tradeHistoryService.saveTrade(trade, executionIntent, submitResult.order);
        
        logger.info('Brackets attached', {
          tradeId: trade.id,
          tp: bracketResult.bracket.takeProfit?.orderId,
          sl: bracketResult.bracket.stopLoss?.orderId,
        });
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Failed to attach brackets';
      logger.error('Failed to attach brackets', { tradeId: trade.id }, error as Error);
      // Don't fail the trade if brackets fail - just log it
      trade = transitionState(trade.id, TradeState.ERROR, errorMsg);
    }
  }

  // Return success result
  return {
    trade,
    success: true,
    order: submitResult.order,
    brackets,
  };
}

/**
 * Cancels a trade's order.
 * 
 * @param tradeId - Trade ID
 * @param orderId - Order ID to cancel
 * @param accountId - Account ID
 * @returns Updated trade
 * @throws Error if cancellation fails
 */
export async function cancelTrade(
  tradeId: string,
  orderId: string,
  accountId: string
): Promise<Trade> {
  let trade = getTrade(tradeId);
  if (!trade) {
    throw new Error(`Trade ${tradeId} not found`);
  }

  // Execute cancellation
  const cancelResult = await executeCancelOrder(orderId, accountId, tradeId);

  if (cancelResult.success) {
    trade = transitionState(tradeId, TradeState.CANCELLED);
    logger.info('Trade cancelled', { tradeId, orderId });
  } else {
    const errorMsg = cancelResult.error || 'Failed to cancel order';
    trade = transitionState(tradeId, TradeState.ERROR, errorMsg);
    logger.error('Trade cancellation failed', { tradeId, orderId }, new Error(errorMsg));
  }

  return trade;
}

/**
 * Replaces a trade's order.
 * 
 * @param tradeId - Trade ID
 * @param orderId - Order ID to replace
 * @param accountId - Account ID
 * @param updates - Order updates
 * @returns Updated trade and order
 * @throws Error if replacement fails
 */
export async function replaceTradeOrder(
  tradeId: string,
  orderId: string,
  accountId: string,
  updates: { price?: string; quantity?: number }
): Promise<{ trade: Trade; order: any }> {
  let trade = getTrade(tradeId);
  if (!trade) {
    throw new Error(`Trade ${tradeId} not found`);
  }

  // Execute replacement
  const replaceResult = await executeReplaceOrder(orderId, accountId, updates, tradeId);

  logger.info('Trade order replaced', { tradeId, orderId });

  return {
    trade,
    order: replaceResult.order,
  };
}

/**
 * Closes a trade's position.
 * 
 * @param tradeId - Trade ID
 * @param positionId - Position ID
 * @param accountId - Account ID
 * @param exitParams - Exit parameters
 * @returns Updated trade
 * @throws Error if close fails
 */
export async function closeTrade(
  tradeId: string,
  positionId: string,
  accountId: string,
  exitParams: {
    orderType: 'LIMIT' | 'MARKET';
    limitPrice?: number;
    verticalLegs: VerticalLegs;
    quantity: number;
  }
): Promise<Trade> {
  let trade = getTrade(tradeId);
  if (!trade) {
    throw new Error(`Trade ${tradeId} not found`);
  }

  // Execute close
  await executeClosePosition(positionId, accountId, tradeId, exitParams);

  trade = transitionState(tradeId, TradeState.CLOSED);
  logger.info('Trade closed', { tradeId, positionId });

  return trade;
}
