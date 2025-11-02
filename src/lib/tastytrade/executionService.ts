/**
 * Trade execution service.
 * 
 * Centralizes all broker API interactions and provides a normalized interface
 * for executing trades. This service handles retry logic, error handling,
 * and wraps the raw Tastytrade API calls.
 * 
 * Key principle: This service ONLY executes orders - it does NOT decide when to trade.
 * The orchestrator layer decides when to call these methods based on state machine transitions.
 * 
 * @module executionService
 */

import { getClient } from './client';
import { submitVertical, cancelOrder, replaceOrder, buildOTOCOBrackets } from './orders';
import type { AppOrder, VerticalLegs, OCOBracket } from './types';
import type { TradeLeg, RuleBundle } from '@/types';
import { logger } from '../logger';
import { OrderRejectionError } from '../errors';
import { orderRegistry } from '../orderRegistry';
import { auditLogger } from '../auditLogger';

/**
 * Trade execution intent.
 * Normalized representation of a trade to execute.
 */
export interface TradeExecutionIntent {
  /** Unique trade ID */
  tradeId: string;
  /** Trade legs */
  legs: TradeLeg[];
  /** Quantity */
  quantity: number;
  /** Limit price (required for LIMIT orders) */
  limitPrice?: number;
  /** Order type */
  orderType: 'LIMIT' | 'MARKET';
  /** Rule bundle for TP/SL */
  ruleBundle: RuleBundle;
  /** Account ID */
  accountId: string;
  /** Vertical legs (if available from chain building) */
  verticalLegs?: VerticalLegs;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Order submission result.
 */
export interface SubmitResult {
  /** The submitted order */
  order: AppOrder;
  /** Whether the order is chaseable */
  chaseable: boolean;
  /** Client order ID for idempotency */
  clientOrderId: string;
}

/**
 * Order cancellation result.
 */
export interface CancelResult {
  /** Whether cancellation was successful */
  success: boolean;
  /** Optional error message */
  error?: string;
}

/**
 * Order replacement result.
 */
export interface ReplaceResult {
  /** The updated order */
  order: AppOrder;
}

/**
 * Bracket attachment result.
 */
export interface AttachBracketsResult {
  /** OCO bracket configuration */
  bracket: OCOBracket;
}

/**
 * Position close result.
 */
export interface ClosePositionResult {
  /** The exit order */
  order: AppOrder;
}

/**
 * Executes a trade order submission.
 * 
 * This method handles the submission of vertical spread orders to Tastytrade.
 * It validates the intent, builds the vertical from legs if needed, and submits.
 * 
 * @param intent - Trade execution intent
 * @returns The submitted order and whether it's chaseable
 * @throws {OrderRejectionError} If submission fails
 * 
 * @example
 * ```ts
 * const intent: TradeExecutionIntent = {
 *   tradeId: 'trade-123',
 *   legs: [...],
 *   quantity: 1,
 *   limitPrice: 2.50,
 *   orderType: 'LIMIT',
 *   ruleBundle: { takeProfitPct: 50, stopLossPct: 100 },
 *   accountId: 'account-123',
 * };
 * 
 * const result = await executeSubmitOrder(intent);
 * console.log(`Order submitted: ${result.order.id}`);
 * ```
 */
export async function executeSubmitOrder(
  intent: TradeExecutionIntent
): Promise<SubmitResult> {
  const { tradeId, legs, quantity, limitPrice, orderType, accountId, verticalLegs } = intent;

  // Generate or retrieve client order ID for idempotency
  let clientOrderId: string;
  const existingRecord = intent.metadata?.clientOrderId;
  
  if (existingRecord && orderRegistry.isSubmitted(existingRecord)) {
    // Order already submitted - return existing result
    const record = orderRegistry.getOrder(existingRecord);
    if (record?.brokerOrderId) {
      // Fetch order status if broker order ID exists
      try {
        const order = await executeGetOrderStatus(record.brokerOrderId, accountId);
        return {
          order,
          chaseable: orderType === 'LIMIT' && 
                   (order.status === 'WORKING' || order.status === 'PENDING'),
          clientOrderId: existingRecord,
        };
      } catch {
        // If fetch fails, proceed with new submission
        clientOrderId = existingRecord;
        orderRegistry.incrementRetry(clientOrderId);
      }
    } else {
      clientOrderId = existingRecord;
      orderRegistry.incrementRetry(clientOrderId);
    }
  } else {
    // Generate new client order ID
    clientOrderId = existingRecord || orderRegistry.generateClientOrderId();
  }

  try {
    // Validate legs
    if (!legs || legs.length === 0) {
      throw new Error('Trade legs are required');
    }

    // Validate quantity
    if (!quantity || quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    // Validate limit price for LIMIT orders
    if (orderType === 'LIMIT' && (!limitPrice || limitPrice <= 0)) {
      throw new Error('Limit price is required for LIMIT orders');
    }

    // If we have vertical legs already built, use them
    // Otherwise, we'll need to build them from legs (simplified for now)
    let vertical: VerticalLegs;
    
    if (verticalLegs) {
      vertical = verticalLegs;
    } else {
      // This is a simplified version - in production, you'd want proper leg building
      // For now, we'll throw an error if verticalLegs is not provided
      throw new Error('VerticalLegs must be provided - use chains module to build from spec');
    }

    // Record submission attempt
    orderRegistry.recordSubmission({
      clientOrderId,
      tradeId,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      retryCount: existingRecord ? (orderRegistry.getOrder(existingRecord)?.retryCount || 0) + 1 : 0,
      metadata: intent.metadata,
    });

    // Submit the order
    const order = await submitVertical(
      vertical,
      quantity,
      limitPrice,
      orderType,
      accountId
    );

    // Confirm submission with broker order ID
    orderRegistry.confirmSubmission(clientOrderId, order.id);

    // Log order submission with audit trail
    auditLogger.logOrderSubmission({
      timestamp: new Date().toISOString(),
      trade_id: tradeId,
      state: order.status as any,
      action: 'order_submitted',
      reason: 'order_execution',
      price: limitPrice,
      order_id: order.id,
      client_order_id: clientOrderId,
      strategy_version: intent.metadata?.strategyVersion,
      metadata: {
        accountId,
        quantity,
        orderType,
      },
    });

    logger.info('Order submitted successfully', {
      tradeId,
      orderId: order.id,
      clientOrderId,
      accountId,
      quantity,
      limitPrice,
    });

    // Orders are chaseable if they're LIMIT orders in WORKING/PENDING state
    const chaseable = orderType === 'LIMIT' && 
                     (order.status === 'WORKING' || order.status === 'PENDING');

    return {
      order,
      chaseable,
      clientOrderId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Mark order as failed in registry
    orderRegistry.markFailed(clientOrderId, errorMessage);
    
    logger.error('Failed to execute submit order', { tradeId, clientOrderId, accountId }, error as Error);
    throw new OrderRejectionError(`Failed to submit order: ${errorMessage}`, intent.tradeId);
  }
}

/**
 * Executes an order cancellation.
 * 
 * @param orderId - Order ID to cancel
 * @param accountId - Account ID
 * @param tradeId - Associated trade ID (for logging)
 * @returns Cancellation result
 * @throws {OrderRejectionError} If cancellation fails
 * 
 * @example
 * ```ts
 * const result = await executeCancelOrder('order-123', 'account-123', 'trade-456');
 * console.log(`Cancelled: ${result.success}`);
 * ```
 */
export async function executeCancelOrder(
  orderId: string,
  accountId: string,
  tradeId: string
): Promise<CancelResult> {
  try {
    await cancelOrder(orderId, accountId);
    
    logger.info('Order cancelled successfully', { tradeId, orderId, accountId });
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to execute cancel order', { tradeId, orderId }, error as Error);
    
    // Don't throw - return failure result
    return {
      success: false,
      error: errorMessage,
    };
  }
}

/**
 * Executes an order replacement.
 * 
 * @param orderId - Order ID to replace
 * @param accountId - Account ID
 * @param updates - Updated order parameters
 * @param tradeId - Associated trade ID (for logging)
 * @returns The updated order
 * @throws {OrderRejectionError} If replacement fails
 * 
 * @example
 * ```ts
 * const result = await executeReplaceOrder(
 *   'order-123',
 *   'account-123',
 *   { price: '2.75', quantity: 2 },
 *   'trade-456'
 * );
 * console.log(`Order updated: ${result.order.id}`);
 * ```
 */
export async function executeReplaceOrder(
  orderId: string,
  accountId: string,
  updates: { price?: string; quantity?: number },
  tradeId: string
): Promise<ReplaceResult> {
  try {
    const order = await replaceOrder(orderId, accountId, {
      orderId,
      price: updates.price,
      quantity: updates.quantity,
    });

    logger.info('Order replaced successfully', {
      tradeId,
      orderId,
      accountId,
      newPrice: updates.price,
      newQuantity: updates.quantity,
    });

    return { order };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to execute replace order', { tradeId, orderId }, error as Error);
    throw new OrderRejectionError(`Failed to replace order: ${errorMessage}`, tradeId);
  }
}

/**
 * Attaches OCO brackets (take profit and stop loss) to a filled order.
 * 
 * @param parentOrderId - The filled order ID
 * @param tp - Take profit price (positive)
 * @param sl - Stop loss price (positive)
 * @param accountId - Account ID
 * @param verticalLegs - Vertical legs for building exit orders
 * @param quantity - Quantity to exit
 * @param tradeId - Associated trade ID (for logging)
 * @returns The OCO bracket configuration
 * @throws {OrderRejectionError} If bracket attachment fails
 * 
 * @example
 * ```ts
 * const result = await executeAttachBrackets(
 *   'order-123',
 *   5.00,  // Take profit at $5.00
 *   2.50,  // Stop loss at $2.50
 *   'account-123',
 *   verticalLegs,
 *   1,
 *   'trade-456'
 * );
 * console.log(`TP order: ${result.bracket.takeProfit?.orderId}`);
 * console.log(`SL order: ${result.bracket.stopLoss?.orderId}`);
 * ```
 */
export async function executeAttachBrackets(
  parentOrderId: string,
  tp: number,
  sl: number,
  accountId: string,
  verticalLegs: VerticalLegs,
  quantity: number,
  tradeId: string
): Promise<AttachBracketsResult> {
  try {
    // Validate inputs
    if (!parentOrderId || typeof parentOrderId !== 'string') {
      throw new Error('Parent order ID is required');
    }

    if (typeof tp !== 'number' || tp <= 0) {
      throw new Error('Take profit price must be positive');
    }

    if (typeof sl !== 'number' || sl <= 0) {
      throw new Error('Stop loss price must be positive');
    }

    if (!verticalLegs || !verticalLegs.shortLeg || !verticalLegs.longLeg) {
      throw new Error('Valid vertical legs are required');
    }

    if (!quantity || quantity <= 0) {
      throw new Error('Quantity must be positive');
    }

    // Build OCO brackets
    const bracket = await buildOTOCOBrackets(
      parentOrderId,
      tp,
      sl,
      accountId,
      verticalLegs,
      quantity
    );

    logger.info('Brackets attached successfully', {
      tradeId,
      parentOrderId,
      takeProfit: bracket.takeProfit?.orderId,
      stopLoss: bracket.stopLoss?.orderId,
    });

    return { bracket };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to execute attach brackets', { tradeId, parentOrderId }, error as Error);
    throw new OrderRejectionError(`Failed to attach brackets: ${errorMessage}`, tradeId);
  }
}

/**
 * Closes a position.
 * 
 * Note: This is a placeholder - actual implementation depends on
 * how you want to exit positions (market order, limit, etc.).
 * 
 * @param positionId - Position ID to close
 * @param accountId - Account ID
 * @param tradeId - Associated trade ID (for logging)
 * @param exitParams - Exit parameters
 * @returns The exit order
 * @throws {OrderRejectionError} If close fails
 * 
 * @example
 * ```ts
 * const result = await executeClosePosition(
 *   'position-123',
 *   'account-123',
 *   'trade-456',
 *   { orderType: 'LIMIT', limitPrice: 5.00, verticalLegs }
 * );
 * console.log(`Exit order: ${result.order.id}`);
 * ```
 */
export async function executeClosePosition(
  positionId: string,
  accountId: string,
  tradeId: string,
  exitParams: {
    orderType: 'LIMIT' | 'MARKET';
    limitPrice?: number;
    verticalLegs: VerticalLegs;
    quantity: number;
  }
): Promise<ClosePositionResult> {
  try {
    // For closing positions, we need to reverse the legs
    // Build exit legs (reverse of entry: buy to close short, sell to close long)
    const { verticalLegs, orderType, limitPrice, quantity } = exitParams;

    // This is simplified - in production, you'd need to fetch position details
    // and build proper exit legs
    const order = await submitVertical(
      verticalLegs,
      quantity,
      limitPrice,
      orderType,
      accountId
    );

    logger.info('Position closed successfully', {
      tradeId,
      positionId,
      exitOrderId: order.id,
    });

    return { order };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to execute close position', { tradeId, positionId }, error as Error);
    throw new OrderRejectionError(`Failed to close position: ${errorMessage}`, tradeId);
  }
}

/**
 * Fetches the current status of an order.
 * 
 * @param orderId - Order ID
 * @param accountId - Account ID
 * @returns The current order state
 * @throws {OrderRejectionError} If fetch fails
 */
export async function executeGetOrderStatus(
  orderId: string,
  accountId: string
): Promise<AppOrder> {
  try {
    const client = await getClient();
    
    // SDK expects numeric order ID
    const orderIdNum = parseInt(orderId, 10);
    if (isNaN(orderIdNum)) {
      throw new Error(`Invalid order ID: ${orderId}`);
    }

    // Fetch order from SDK
    const response = await client.orderService.getOrder(accountId, orderIdNum);
    
    // Normalize response
    // Note: You'll need to import or implement normalizeOrder from orders.ts
    // For now, this is a placeholder
    const order: AppOrder = {
      id: response.id?.toString() || orderId,
      accountId,
      legs: [], // Would need to map from response
      orderType: 'LIMIT',
      status: 'WORKING',
      quantity: 0,
      createdAt: new Date().toISOString(),
    };

    return order;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch order status', { orderId }, error as Error);
    throw new OrderRejectionError(`Failed to fetch order status: ${errorMessage}`);
  }
}
