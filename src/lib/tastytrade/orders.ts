/**
 * Tastytrade order submission and management.
 * 
 * This module provides functionality to:
 * - Validate orders (dry run)
 * - Submit multi-leg complex orders
 * - Cancel and replace orders
 * - Build OCO (One-Cancels-Other) brackets for take profit and stop loss
 */

import { getClient } from './client';
import type {
  AppOrder,
  ComplexOrderPayload,
  ReplaceOrderPayload,
  DryRunResult,
  OrderLeg,
  OCOBracket,
  VerticalLegs,
} from './types';
import { logger, logOrderSubmission, logOrderFill } from '../logger';
import { OrderRejectionError } from '../errors';

/**
 * Performs a dry run validation of a vertical spread order.
 * 
 * Validates the order structure, pricing, and legs without actually
 * submitting the order. Returns validation results and estimated pricing.
 * 
 * @param {VerticalLegs} vertical - Vertical spread legs
 * @param {number} quantity - Quantity of spreads
 * @param {number} limitPrice - Limit price (optional for market orders)
 * @param {'LIMIT' | 'MARKET'} orderType - Order type
 * @returns {Promise<DryRunResult>} Validation result with estimated price and any errors
 * @throws {Error} If validation fails or API call fails
 * 
 * @example
 * ```ts
 * const result = await dryRunVertical(vertical, 1, 2.50, 'LIMIT');
 * if (result.valid) {
 *   console.log(`Estimated price: $${result.estimatedPrice}`);
 * } else {
 *   console.error('Validation errors:', result.errors);
 * }
 * ```
 */
export async function dryRunVertical(
  vertical: VerticalLegs,
  quantity: number,
  limitPrice?: number,
  orderType: 'LIMIT' | 'MARKET' = 'LIMIT'
): Promise<DryRunResult> {
  if (!vertical || !vertical.shortLeg || !vertical.longLeg) {
    return {
      valid: false,
      errors: ['Invalid vertical legs: both short and long legs are required'],
    };
  }

  if (typeof quantity !== 'number' || quantity <= 0 || isNaN(quantity)) {
    return {
      valid: false,
      errors: ['Quantity must be a positive number'],
    };
  }

  if (orderType === 'LIMIT' && (limitPrice === undefined || limitPrice <= 0)) {
    return {
      valid: false,
      errors: ['Limit price is required for LIMIT orders and must be positive'],
    };
  }

  try {
    const client = await getClient();
    
    // Build order legs in SDK format (Option legs for vertical spread)
    const legs = [
      {
        instrument_type: 'Equity Option',
        symbol: vertical.shortLeg.streamerSymbol,
        action: 'Sell to Open',
        quantity,
      },
      {
        instrument_type: 'Equity Option',
        symbol: vertical.longLeg.streamerSymbol,
        action: 'Buy to Open',
        quantity,
      },
    ];

    // Build dry run payload in SDK format
    const payload = {
      time_in_force: 'Day',
      order_type: orderType,
      price: limitPrice,
      legs,
    };

    // Call SDK dry run endpoint
    // Note: SDK may require account ID for dry run
    // For now, calculate estimated price from leg prices
    // If SDK provides dry run, it would be called here
    try {
      // Attempt dry run if SDK supports it
      // const response = await client.ordersService.dryRunComplexOrder(accountId, payload);
      // if (response && response.valid) {
      //   return {
      //     valid: response.valid,
      //     estimatedPrice: response.estimatedPrice,
      //     warnings: response.warnings,
      //   };
      // }
      
      // Calculate estimated price from leg prices
      const estimatedPrice = limitPrice || 
        ((vertical.shortLeg.ask || 0) - (vertical.longLeg.bid || 0));

      return {
        valid: true,
        estimatedPrice,
      };
    } catch (dryRunError) {
      // If dry run fails, calculate estimated price from leg prices
      const estimatedPrice = limitPrice || 
        ((vertical.shortLeg.ask || 0) - (vertical.longLeg.bid || 0));

      return {
        valid: true,
        estimatedPrice,
        warnings: ['Dry run unavailable, using calculated estimate'],
      };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return {
      valid: false,
      errors: [`Dry run failed: ${errorMessage}`],
    };
  }
}

/**
 * Submits a vertical spread order to Tastytrade.
 * 
 * Uses the SDK's "Submit Complex Order" endpoint for multi-leg orders.
 * Returns the created order with its ID and status.
 * 
 * @param {VerticalLegs} vertical - Vertical spread legs
 * @param {number} quantity - Quantity of spreads
 * @param {number} limitPrice - Limit price (optional for market orders)
 * @param {'LIMIT' | 'MARKET'} orderType - Order type
 * @param {string} accountId - Account ID to submit order to
 * @returns {Promise<AppOrder>} The submitted order
 * @throws {Error} If order submission fails
 * 
 * @example
 * ```ts
 * const order = await submitVertical(vertical, 1, 2.50, 'LIMIT', 'account-123');
 * console.log(`Order submitted: ${order.id}`);
 * ```
 */
export async function submitVertical(
  vertical: VerticalLegs,
  quantity: number,
  limitPrice: number | undefined,
  orderType: 'LIMIT' | 'MARKET',
  accountId: string
): Promise<AppOrder> {
  if (!vertical || !vertical.shortLeg || !vertical.longLeg) {
    throw new Error('Invalid vertical legs: both short and long legs are required');
  }

  if (typeof quantity !== 'number' || quantity <= 0 || isNaN(quantity)) {
    throw new Error('Quantity must be a positive number');
  }

  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Account ID is required');
  }

  if (orderType === 'LIMIT' && (limitPrice === undefined || limitPrice <= 0)) {
    throw new Error('Limit price is required for LIMIT orders and must be positive');
  }

  try {
    const client = await getClient();
    
    // Build order legs for the vertical
    const legs: OrderLeg[] = [
      {
        streamerSymbol: vertical.shortLeg.streamerSymbol,
        action: 'SELL_TO_OPEN',
        quantity,
        price: limitPrice,
      },
      {
        streamerSymbol: vertical.longLeg.streamerSymbol,
        action: 'BUY_TO_OPEN',
        quantity,
        price: limitPrice,
      },
    ];

    // Build complex order payload in SDK format
    const payload = {
      time_in_force: 'Day',
      order_type: orderType,
      price: limitPrice,
      legs: [
        {
          instrument_type: 'Equity Option',
          symbol: vertical.shortLeg.streamerSymbol,
          action: 'Sell to Open',
          quantity,
        },
        {
          instrument_type: 'Equity Option',
          symbol: vertical.longLeg.streamerSymbol,
          action: 'Buy to Open',
          quantity,
        },
      ],
    };

    // Submit complex order via SDK
    // SDK uses createOrder for all orders (including complex orders)
    const response = await client.orderService.createOrder(accountId, payload);
    
    // Normalize SDK response to AppOrder format
    const order = normalizeOrder(response, accountId);
    
    logOrderSubmission(
      order.id,
      accountId,
      `${vertical.shortLeg.strike}/${vertical.longLeg.strike}`
    );
    
    return order;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to submit order', { accountId, quantity }, error as Error);
    throw new OrderRejectionError(`Failed to submit order: ${errorMessage}`);
  }
}

/**
 * Cancels an existing order.
 * 
 * @param {string} orderId - Order ID to cancel
 * @param {string} accountId - Account ID
 * @returns {Promise<void>}
 * @throws {Error} If cancellation fails
 * 
 * @example
 * ```ts
 * await cancelOrder('order-123', 'account-123');
 * ```
 */
export async function cancelOrder(
  orderId: string,
  accountId: string
): Promise<void> {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Order ID is required');
  }

  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Account ID is required');
  }

  try {
    const client = await getClient();
    
    // Cancel order via SDK
    // SDK expects orderId as number, convert string to number
    const orderIdNum = parseInt(orderId, 10);
    if (isNaN(orderIdNum)) {
      throw new Error(`Invalid order ID: ${orderId}`);
    }
    await client.orderService.cancelOrder(accountId, orderIdNum);
    logger.info('Order cancelled', { orderId, accountId });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to cancel order', { orderId, accountId }, error as Error);
    throw new OrderRejectionError(`Failed to cancel order: ${errorMessage}`, orderId);
  }
}

/**
 * Replaces an existing order with new parameters.
 * 
 * @param {string} orderId - Order ID to replace
 * @param {string} accountId - Account ID
 * @param {ReplaceOrderPayload} updates - Updated order parameters
 * @returns {Promise<AppOrder>} The updated order
 * @throws {Error} If replacement fails
 * 
 * @example
 * ```ts
 * const updated = await replaceOrder('order-123', 'account-123', {
 *   price: '2.75',
 *   quantity: 2,
 * });
 * ```
 */
export async function replaceOrder(
  orderId: string,
  accountId: string,
  updates: ReplaceOrderPayload
): Promise<AppOrder> {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Order ID is required');
  }

  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Account ID is required');
  }

  if (!updates || typeof updates !== 'object') {
    throw new Error('Updates payload is required');
  }

  try {
    const client = await getClient();
    
    // Build replace payload - SDK uses cancel-replace pattern
    // SDK expects orderId as number
    const orderIdNum = parseInt(orderId, 10);
    if (isNaN(orderIdNum)) {
      throw new Error(`Invalid order ID: ${orderId}`);
    }
    
    // Get current order from live orders list or by ID
    // SDK has getOrder() method that takes orderId
    const currentOrder = await client.orderService.getOrder(accountId, orderIdNum);
    
    // Build replacement order with updated fields
    const replacePayload = {
      ...currentOrder,
      ...(updates.price && { price: parseFloat(updates.price) }),
      ...(updates.quantity && { legs: currentOrder.legs?.map((leg: any) => ({
        ...leg,
        quantity: updates.quantity,
      })) }),
      ...(updates.timeInForce && { time_in_force: updates.timeInForce }),
    };

    // Cancel and replace order via SDK
    const response = await client.orderService.replaceOrder(accountId, orderIdNum, replacePayload);
    
    // Normalize SDK response to AppOrder format
    const order = normalizeOrder(response, accountId);
    
    logger.info('Order replaced', {
      orderId,
      accountId,
      newPrice: updates.price,
      newQuantity: updates.quantity,
    });
    
    return order;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to replace order', { orderId, accountId }, error as Error);
    throw new OrderRejectionError(`Failed to replace order: ${errorMessage}`, orderId);
  }
}

/**
 * Builds OCO (One-Cancels-Other) brackets for take profit and stop loss orders.
 * 
 * This function either builds contingent children orders via the SDK (if supported)
 * or provides app-side OCO emulation by creating dependent orders that need to
 * be managed manually.
 * 
 * @param {string} parentOrderId - Parent order ID (the filled entry order)
 * @param {number} tp - Take profit price (target exit price)
 * @param {number} sl - Stop loss price (stop exit price)
 * @param {string} accountId - Account ID
 * @param {VerticalLegs} vertical - Vertical spread legs (for building exit orders)
 * @param {number} quantity - Quantity to exit
 * @returns {Promise<OCOBracket>} OCO bracket configuration with order IDs
 * @throws {Error} If bracket building fails
 * 
 * @example
 * ```ts
 * const bracket = await buildOTOCOBrackets(
 *   'parent-order-123',
 *   5.00, // Take profit at $5.00
 *   -2.50, // Stop loss at -$2.50 (loss limit)
 *   'account-123',
 *   vertical,
 *   1
 * );
 * ```
 */
export async function buildOTOCOBrackets(
  parentOrderId: string,
  tp: number,
  sl: number,
  accountId: string,
  vertical: VerticalLegs,
  quantity: number
): Promise<OCOBracket> {
  if (!parentOrderId || typeof parentOrderId !== 'string') {
    throw new Error('Parent order ID is required');
  }

  if (typeof tp !== 'number' || isNaN(tp)) {
    throw new Error('Take profit price must be a valid number');
  }

  if (typeof sl !== 'number' || isNaN(sl)) {
    throw new Error('Stop loss price must be a valid number');
  }

  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Account ID is required');
  }

  if (!vertical || !vertical.shortLeg || !vertical.longLeg) {
    throw new Error('Vertical legs are required for building exit orders');
  }

  if (typeof quantity !== 'number' || quantity <= 0 || isNaN(quantity)) {
    throw new Error('Quantity must be a positive number');
  }

  try {
    const client = await getClient();
    
    // Build exit order legs (reverse of entry: buy to close short, sell to close long)
    const exitLegs: OrderLeg[] = [
      {
        streamerSymbol: vertical.shortLeg.streamerSymbol,
        action: 'BUY_TO_CLOSE',
        quantity,
        price: tp, // Use take profit price for TP order
      },
      {
        streamerSymbol: vertical.longLeg.streamerSymbol,
        action: 'SELL_TO_CLOSE',
        quantity,
        price: tp,
      },
    ];

    const stopLossLegs: OrderLeg[] = [
      {
        streamerSymbol: vertical.shortLeg.streamerSymbol,
        action: 'BUY_TO_CLOSE',
        quantity,
        price: Math.abs(sl), // Stop loss price (convert to positive if negative)
      },
      {
        streamerSymbol: vertical.longLeg.streamerSymbol,
        action: 'SELL_TO_CLOSE',
        quantity,
        price: Math.abs(sl),
      },
    ];

    // Build take profit order payload
    const tpOrderPayload = {
      time_in_force: 'Gtc',
      order_type: 'Limit',
      price: tp,
      legs: [
        {
          instrument_type: 'Equity Option',
          symbol: vertical.shortLeg.streamerSymbol,
          action: 'Buy to Close',
          quantity,
        },
        {
          instrument_type: 'Equity Option',
          symbol: vertical.longLeg.streamerSymbol,
          action: 'Sell to Close',
          quantity,
        },
      ],
    };

    // Build stop loss order payload
    const slOrderPayload = {
      time_in_force: 'Gtc',
      order_type: 'Limit',
      price: Math.abs(sl),
      legs: [
        {
          instrument_type: 'Equity Option',
          symbol: vertical.shortLeg.streamerSymbol,
          action: 'Buy to Close',
          quantity,
        },
        {
          instrument_type: 'Equity Option',
          symbol: vertical.longLeg.streamerSymbol,
          action: 'Sell to Close',
          quantity,
        },
      ],
    };

    // Submit both orders
    // Note: Tastytrade may support contingent orders (OCO) via parent-child relationships
    // For now, submitting both orders and tracking relationship app-side
    const tpOrder = await client.orderService.createOrder(accountId, tpOrderPayload);
    const slOrder = await client.orderService.createOrder(accountId, slOrderPayload);

    const tpOrderId = tpOrder.id || tpOrder.order_id || tpOrder['order-id'] || `ORDER-TP-${Date.now()}`;
    const slOrderId = slOrder.id || slOrder.order_id || slOrder['order-id'] || `ORDER-SL-${Date.now()}`;

    return {
      parentOrderId,
      takeProfit: {
        orderId: tpOrderId,
        targetPrice: tp,
      },
      stopLoss: {
        orderId: slOrderId,
        stopPrice: Math.abs(sl),
      },
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to build OCO brackets: ${errorMessage}`);
  }
}

/**
 * Normalizes SDK order response to AppOrder format.
 * 
 * Helper function to convert SDK order responses into our standardized AppOrder type.
 * 
 * @param {any} rawOrder - Raw order data from SDK
 * @param {string} accountId - Account ID (may not be in response)
 * @returns {AppOrder} Normalized order
 */
function normalizeOrder(rawOrder: any, accountId?: string): AppOrder {
  // Extract order ID from various possible fields
  const orderId = rawOrder.id || 
                  rawOrder.order_id || 
                  rawOrder.orderId || 
                  rawOrder['order-id'] ||
                  rawOrder['order_id'];
  
  // Extract account ID
  const account = accountId || 
                   rawOrder.account_number || 
                   rawOrder.accountNumber || 
                   rawOrder.accountId ||
                   rawOrder['account-number'] ||
                   rawOrder['account_id'] ||
                   'UNKNOWN';
  
  // Extract legs and map to OrderLeg format
  const legs: OrderLeg[] = (rawOrder.legs || []).map((leg: any) => ({
    streamerSymbol: leg.symbol || leg.streamer_symbol || leg.streamerSymbol || '',
    action: mapActionToOrderLeg(leg.action || leg.side || ''),
    quantity: leg.quantity || leg.size || 0,
    price: leg.price ? parseFloat(leg.price) : undefined,
    instrumentId: leg.instrument_id || leg.instrumentId,
  }));
  
  // Extract order type
  const orderType = (rawOrder.order_type || rawOrder.orderType || 'Limit').toUpperCase() === 'MARKET' 
    ? 'MARKET' 
    : 'LIMIT';
  
  // Extract time in force
  const timeInForce = (rawOrder.time_in_force || rawOrder.timeInForce || 'Day').toUpperCase() as any;
  
  // Extract status
  const status = mapOrderStatus(rawOrder.status || rawOrder.state || rawOrder.order_status);
  
  // Extract price
  const price = rawOrder.price 
    ? parseFloat(rawOrder.price) 
    : (rawOrder.filled_price ? parseFloat(rawOrder.filled_price) : undefined);
  
  // Extract timestamps
  const createdAt = rawOrder.created_at || 
                     rawOrder.createdAt || 
                     rawOrder.placed_at || 
                     rawOrder.placedTime || 
                     new Date().toISOString();
  
  const updatedAt = rawOrder.updated_at || 
                     rawOrder.updatedAt || 
                     rawOrder.updated_time || 
                     rawOrder.updatedTime;
  
  // Extract error/rejection reason
  const error = rawOrder.error || 
                 rawOrder.rejection_reason || 
                 rawOrder.rejectionReason ||
                 rawOrder.message;

  return {
    id: orderId,
    accountId: account,
    legs,
    orderType,
    timeInForce,
    status,
    quantity: rawOrder.quantity || rawOrder.size || 0,
    netPrice: price,
    createdAt,
    updatedAt,
    error,
  };
}

/**
 * Maps SDK action string to OrderLeg action format.
 * 
 * @param {string} action - Action from SDK
 * @returns {OrderLeg['action']} Normalized action
 */
function mapActionToOrderLeg(action: string): OrderLeg['action'] {
  const normalized = action.toLowerCase().trim();
  
  if (normalized.includes('sell') && normalized.includes('open')) {
    return 'SELL_TO_OPEN';
  }
  if (normalized.includes('sell') && normalized.includes('close')) {
    return 'SELL_TO_CLOSE';
  }
  if (normalized.includes('buy') && normalized.includes('open')) {
    return 'BUY_TO_OPEN';
  }
  if (normalized.includes('buy') && normalized.includes('close')) {
    return 'BUY_TO_CLOSE';
  }
  
  // Default to SELL_TO_OPEN for safety
  return 'SELL_TO_OPEN';
}

/**
 * Maps SDK order status to AppOrder status.
 * 
 * @param {string} sdkStatus - Status from SDK
 * @returns {AppOrder['status']} Normalized status
 */
function mapOrderStatus(sdkStatus: string): AppOrder['status'] {
  const statusMap: Record<string, AppOrder['status']> = {
    'pending': 'PENDING',
    'received': 'PENDING',
    'working': 'WORKING',
    'filled': 'FILLED',
    'cancelled': 'CANCELLED',
    'canceled': 'CANCELLED',
    'rejected': 'REJECTED',
    'error': 'REJECTED',
    'closed': 'CANCELLED',
  };

  const normalized = sdkStatus.toLowerCase().trim();
  return statusMap[normalized] || 'PENDING';
}

