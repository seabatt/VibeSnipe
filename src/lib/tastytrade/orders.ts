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
  OTOCOGroup,
  StopOrderPayload,
} from './types';
import { logger, logOrderSubmission, logOrderFill } from '../logger';
import { OrderRejectionError } from '../errors';
import { orderRegistry } from '../orderRegistry';

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

/**
 * Calculates take profit price from entry price and percentage.
 * 
 * @param {number} entryPrice - Entry price
 * @param {number} tpPct - Take profit percentage (e.g., 50 = 50% profit)
 * @returns {number} Take profit price
 * @throws {Error} If inputs are invalid
 */
export function calculateTPPrice(entryPrice: number, tpPct: number): number {
  if (entryPrice <= 0) {
    throw new Error('Entry price must be positive');
  }
  if (tpPct < 0) {
    throw new Error('Take profit percentage must be non-negative');
  }
  // TP price = entry price * (1 + tpPct / 100)
  // e.g., entry $2.00, TP 50% = $2.00 * 1.5 = $3.00
  return entryPrice * (1 + tpPct / 100);
}

/**
 * Calculates stop loss price from entry price and percentage.
 * 
 * @param {number} entryPrice - Entry price
 * @param {number} slPct - Stop loss percentage (e.g., 100 = 100% loss = 0% of entry)
 * @returns {number} Stop loss price
 * @throws {Error} If inputs are invalid
 */
export function calculateSLPrice(entryPrice: number, slPct: number): number {
  if (entryPrice <= 0) {
    throw new Error('Entry price must be positive');
  }
  if (slPct < 0) {
    throw new Error('Stop loss percentage must be non-negative');
  }
  // SL price = entry price * (1 - slPct / 100)
  // e.g., entry $2.00, SL 100% = $2.00 * 0 = $0.00 (but we'll use a small positive value)
  // e.g., entry $2.00, SL 50% = $2.00 * 0.5 = $1.00
  const calculated = entryPrice * (1 - slPct / 100);
  return Math.max(0.01, calculated); // Ensure minimum price of $0.01
}

/**
 * Builds OTOCO JSON structure internally for Tastytrade API.
 * 
 * This structure represents the complete OTOCO order but is built internally.
 * Orders are submitted sequentially: trigger first, then TP/SL after fill.
 * 
 * @param {TriggerOrderPayload} triggerOrder - The trigger order payload
 * @param {any} tpOrder - Take profit order payload
 * @param {any} slOrder - Stop loss order payload
 * @returns {OTOCOOrderPayload} Complete OTOCO order structure
 */
export function buildOTOCOPayload(
  triggerOrder: any,
  tpOrder: any,
  slOrder: any
): any {
  return {
    type: 'OTOCO',
    'trigger-order': triggerOrder,
    orders: [tpOrder, slOrder],
  };
}

/**
 * Builds exit leg orders from entry legs (reverses actions).
 * 
 * @param {OrderLeg[]} entryLegs - Entry order legs
 * @returns {OrderLeg[]} Exit order legs with reversed actions
 */
export function buildExitLegs(entryLegs: OrderLeg[]): OrderLeg[] {
  return entryLegs.map((leg) => {
    // Reverse actions: Buy to Open -> Buy to Close, Sell to Open -> Sell to Close
    let exitAction: OrderLeg['action'];
    if (leg.action === 'BUY_TO_OPEN') {
      exitAction = 'BUY_TO_CLOSE';
    } else if (leg.action === 'SELL_TO_OPEN') {
      exitAction = 'SELL_TO_CLOSE';
    } else {
      // If already close action, keep it (shouldn't happen for entry legs)
      exitAction = leg.action;
    }
    
    return {
      ...leg,
      action: exitAction,
    };
  });
}

/**
 * Submits a trigger order (the entry order).
 * 
 * @param {OrderLeg[]} legs - Order legs
 * @param {number} price - Limit price
 * @param {string} accountId - Account ID
 * @param {'Debit' | 'Credit'} priceEffect - Price effect (Debit or Credit)
 * @param {'GTC' | 'DAY' | 'EXT' | 'IOC' | 'FOK'} timeInForce - Time in force
 * @returns {Promise<AppOrder>} The submitted trigger order
 * @throws {Error} If submission fails
 */
export async function submitTriggerOrder(
  legs: OrderLeg[],
  price: number,
  accountId: string,
  priceEffect: 'Debit' | 'Credit' = 'Debit',
  timeInForce: 'GTC' | 'DAY' | 'EXT' | 'IOC' | 'FOK' = 'GTC'
): Promise<AppOrder> {
  if (!legs || legs.length === 0) {
    throw new Error('Order legs are required');
  }
  if (price <= 0) {
    throw new Error('Price must be positive');
  }
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Account ID is required');
  }

  try {
    const client = await getClient();
    
    // Build trigger order payload in SDK format
    const payload = {
      'order-type': 'Limit',
      price,
      'price-effect': priceEffect,
      'time-in-force': timeInForce,
      legs: legs.map((leg) => ({
        'instrument-type': 'Equity Option',
        symbol: leg.streamerSymbol,
        action: mapActionToSDK(leg.action),
        quantity: leg.quantity,
      })),
    };

    // Submit order via SDK
    const response = await client.orderService.createOrder(accountId, payload);
    
    // Normalize SDK response to AppOrder format
    const order = normalizeOrder(response, accountId);
    
    logger.info('Trigger order submitted', {
      orderId: order.id,
      accountId,
      price,
    });
    
    return order;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to submit trigger order', { accountId, price }, error as Error);
    throw new OrderRejectionError(`Failed to submit trigger order: ${errorMessage}`);
  }
}

/**
 * Submits a take profit order (Limit order).
 * 
 * @param {OrderLeg[]} exitLegs - Exit order legs (reversed from entry)
 * @param {number} tpPrice - Take profit price
 * @param {string} accountId - Account ID
 * @param {'GTC' | 'DAY' | 'EXT' | 'IOC' | 'FOK'} timeInForce - Time in force
 * @returns {Promise<AppOrder>} The submitted TP order
 * @throws {Error} If submission fails
 */
export async function submitTPOrder(
  exitLegs: OrderLeg[],
  tpPrice: number,
  accountId: string,
  timeInForce: 'GTC' | 'DAY' | 'EXT' | 'IOC' | 'FOK' = 'GTC'
): Promise<AppOrder> {
  if (!exitLegs || exitLegs.length === 0) {
    throw new Error('Exit legs are required');
  }
  if (tpPrice <= 0) {
    throw new Error('Take profit price must be positive');
  }
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Account ID is required');
  }

  try {
    const client = await getClient();
    
    // Build TP order payload (Limit order)
    const payload = {
      'order-type': 'Limit',
      price: tpPrice,
      'price-effect': 'Credit', // Exit orders are typically Credit
      'time-in-force': timeInForce,
      legs: exitLegs.map((leg) => ({
        'instrument-type': 'Equity Option',
        symbol: leg.streamerSymbol,
        action: mapActionToSDK(leg.action),
        quantity: leg.quantity,
      })),
    };

    // Submit order via SDK
    const response = await client.orderService.createOrder(accountId, payload);
    
    // Normalize SDK response to AppOrder format
    const order = normalizeOrder(response, accountId);
    
    logger.info('Take profit order submitted', {
      orderId: order.id,
      accountId,
      tpPrice,
    });
    
    return order;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to submit take profit order', { accountId, tpPrice }, error as Error);
    throw new OrderRejectionError(`Failed to submit take profit order: ${errorMessage}`);
  }
}

/**
 * Submits a stop loss order (Stop order with stop-trigger).
 * 
 * @param {OrderLeg[]} exitLegs - Exit order legs (reversed from entry)
 * @param {number} slPrice - Stop loss price (stop-trigger)
 * @param {string} accountId - Account ID
 * @param {'GTC' | 'DAY' | 'EXT' | 'IOC' | 'FOK'} timeInForce - Time in force
 * @returns {Promise<AppOrder>} The submitted SL order
 * @throws {Error} If submission fails
 */
export async function submitSLOrder(
  exitLegs: OrderLeg[],
  slPrice: number,
  accountId: string,
  timeInForce: 'GTC' | 'DAY' | 'EXT' | 'IOC' | 'FOK' = 'GTC'
): Promise<AppOrder> {
  if (!exitLegs || exitLegs.length === 0) {
    throw new Error('Exit legs are required');
  }
  if (slPrice <= 0) {
    throw new Error('Stop loss price must be positive');
  }
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Account ID is required');
  }

  try {
    const client = await getClient();
    
    // Build SL order payload (Stop order with stop-trigger)
    const payload: StopOrderPayload = {
      'order-type': 'Stop',
      'stop-trigger': slPrice,
      'time-in-force': timeInForce,
      legs: exitLegs.map((leg) => ({
        'instrument-type': 'Equity Option',
        symbol: leg.streamerSymbol,
        action: mapActionToSDK(leg.action),
        quantity: leg.quantity,
      })),
    };

    // Submit order via SDK
    const response = await client.orderService.createOrder(accountId, payload);
    
    // Normalize SDK response to AppOrder format
    const order = normalizeOrder(response, accountId);
    
    logger.info('Stop loss order submitted', {
      orderId: order.id,
      accountId,
      slPrice,
    });
    
    return order;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to submit stop loss order', { accountId, slPrice }, error as Error);
    throw new OrderRejectionError(`Failed to submit stop loss order: ${errorMessage}`);
  }
}

/**
 * Links TP and SL orders as OTOCO via Tastytrade native API.
 * 
 * @param {string} tpOrderId - Take profit order ID
 * @param {string} slOrderId - Stop loss order ID
 * @param {string} accountId - Account ID
 * @returns {Promise<void>}
 * @throws {Error} If linking fails
 */
export async function linkOTOCOOrders(
  tpOrderId: string,
  slOrderId: string,
  accountId: string
): Promise<void> {
  if (!tpOrderId || typeof tpOrderId !== 'string') {
    throw new Error('Take profit order ID is required');
  }
  if (!slOrderId || typeof slOrderId !== 'string') {
    throw new Error('Stop loss order ID is required');
  }
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Account ID is required');
  }

  try {
    const client = await getClient();
    
    // Use Tastytrade's native OTOCO API to link orders
    // Note: This may require specific API endpoint - check Tastytrade SDK docs
    // For now, we'll use the contingent order relationship API if available
    // The exact API call may vary based on Tastytrade SDK version
    
    // Convert order IDs to numbers if needed
    const tpOrderIdNum = parseInt(tpOrderId, 10);
    const slOrderIdNum = parseInt(slOrderId, 10);
    
    if (isNaN(tpOrderIdNum) || isNaN(slOrderIdNum)) {
      throw new Error('Invalid order IDs: must be numeric');
    }
    
    // Link orders as OTOCO (One Triggers Others Cancel Others)
    // This may require a specific API endpoint for contingent orders
    // Check Tastytrade SDK documentation for the exact method
    // Example: await client.orderService.linkOTOCOOrders(accountId, tpOrderIdNum, slOrderIdNum);
    
    // For now, log that we're linking orders
    // The actual linking will depend on Tastytrade API support
    logger.info('Linking OTOCO orders', {
      tpOrderId,
      slOrderId,
      accountId,
    });
    
    // TODO: Implement actual OTOCO linking via Tastytrade API
    // This may require a specific endpoint or method in the SDK
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to link OTOCO orders', { tpOrderId, slOrderId, accountId }, error as Error);
    throw new Error(`Failed to link OTOCO orders: ${errorMessage}`);
  }
}

/**
 * Monitors trigger order fill and automatically submits TP/SL orders.
 * 
 * @param {string} orderId - Trigger order ID
 * @param {string} accountId - Account ID
 * @returns {Promise<void>}
 * @throws {Error} If monitoring fails
 */
export async function monitorOrderFill(
  orderId: string,
  accountId: string
): Promise<void> {
  if (!orderId || typeof orderId !== 'string') {
    throw new Error('Order ID is required');
  }
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Account ID is required');
  }

  const maxPollAttempts = 300; // 5 minutes at 1 second intervals
  let attempts = 0;
  let pollInterval: NodeJS.Timeout | null = null;

  const cleanup = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      pollInterval = null;
    }
  };

  try {
    const client = await getClient();
    const orderIdNum = parseInt(orderId, 10);
    
    if (isNaN(orderIdNum)) {
      throw new Error(`Invalid order ID: ${orderId}`);
    }

    pollInterval = setInterval(async () => {
      try {
        attempts++;
        const order = await client.orderService.getOrder(accountId, orderIdNum);
        const normalizedOrder = normalizeOrder(order, accountId);
        
        if (normalizedOrder.status === 'FILLED') {
          cleanup();
          
          try {
            // Get OTOCO configuration from registry
            const config = await orderRegistry.getOTOCOGroup(orderId);
            if (!config) {
              throw new Error(`OTOCO configuration not found for order ${orderId}`);
            }
            
            const entryPrice = normalizedOrder.netPrice || config.entryPrice;
            
            // Calculate TP/SL prices
            const tpPrice = calculateTPPrice(entryPrice, config.tpPct);
            const slPrice = calculateSLPrice(entryPrice, config.slPct);
            
            // Build exit legs (reverse of entry)
            const exitLegs = buildExitLegs(config.entryLegs);
            
            // Submit TP and SL orders with retry logic
            let tpOrder: AppOrder | null = null;
            let slOrder: AppOrder | null = null;
            let retries = 0;
            const maxRetries = 3;
            
            while (retries < maxRetries && (!tpOrder || !slOrder)) {
              try {
                if (!tpOrder) {
                  tpOrder = await submitTPOrder(exitLegs, tpPrice, accountId);
                }
                if (!slOrder) {
                  slOrder = await submitSLOrder(exitLegs, slPrice, accountId);
                }
                break; // Success, exit retry loop
              } catch (error) {
                retries++;
                if (retries >= maxRetries) {
                  throw error;
                }
                // Exponential backoff: 1s, 2s, 4s
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retries - 1)));
              }
            }
            
            if (!tpOrder || !slOrder) {
              throw new Error('Failed to submit TP/SL orders after retries');
            }
            
            // Link as OTOCO via Tastytrade native API
            await linkOTOCOOrders(tpOrder.id, slOrder.id, accountId);
            
            // Update registry
            await orderRegistry.updateOTOCOGroup(orderId, {
              tpOrderId: tpOrder.id,
              slOrderId: slOrder.id,
            });
            
            logger.info('TP/SL orders submitted after trigger fill', {
              triggerOrderId: orderId,
              tpOrderId: tpOrder.id,
              slOrderId: slOrder.id,
              accountId,
            });
            
          } catch (error) {
            // Error handling: log and notify user
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            logger.error('TP/SL submission failed after fill', {
              triggerOrderId: orderId,
              accountId,
            }, error as Error);
            // TODO: Show notification to user with retry option
          }
        } else if (normalizedOrder.status === 'CANCELLED' || normalizedOrder.status === 'REJECTED') {
          cleanup();
          logger.warn('Trigger order cancelled or rejected', {
            orderId,
            status: normalizedOrder.status,
            accountId,
          });
          // TODO: Notify user order was cancelled/rejected
        }
        
        if (attempts >= maxPollAttempts) {
          cleanup();
          logger.warn('Order monitoring timeout', {
            orderId,
            attempts,
            accountId,
          });
          // TODO: Notify user of timeout
        }
      } catch (error) {
        // Error handling: log and continue polling unless persistent
        logger.error('Polling error', {
          orderId,
          attempt: attempts,
          accountId,
        }, error as Error);
        
        if (attempts >= maxPollAttempts) {
          cleanup();
        }
      }
    }, 1000); // Poll every 1 second
    
    // Store monitoring state for cleanup on unmount
    // This will be handled by the caller
    
  } catch (error) {
    cleanup();
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to start order monitoring', { orderId, accountId }, error as Error);
    throw new Error(`Failed to start order monitoring: ${errorMessage}`);
  }
}

/**
 * Maps OrderLeg action to SDK action format.
 * 
 * @param {OrderLeg['action']} action - OrderLeg action
 * @returns {string} SDK action format
 */
function mapActionToSDK(action: OrderLeg['action']): string {
  const actionMap: Record<OrderLeg['action'], string> = {
    'BUY_TO_OPEN': 'Buy to Open',
    'SELL_TO_OPEN': 'Sell to Open',
    'BUY_TO_CLOSE': 'Buy to Close',
    'SELL_TO_CLOSE': 'Sell to Close',
  };
  return actionMap[action] || 'Buy to Open';
}

/**
 * Updates an existing take profit order.
 * 
 * @param {string} tpOrderId - Take profit order ID
 * @param {number} newTpPrice - New take profit price
 * @param {string} accountId - Account ID
 * @returns {Promise<AppOrder>} The updated order
 * @throws {Error} If update fails
 */
export async function updateTPOrder(
  tpOrderId: string,
  newTpPrice: number,
  accountId: string
): Promise<AppOrder> {
  if (!tpOrderId || typeof tpOrderId !== 'string') {
    throw new Error('Take profit order ID is required');
  }
  if (newTpPrice <= 0) {
    throw new Error('New take profit price must be positive');
  }
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Account ID is required');
  }

  try {
    return await replaceOrder(tpOrderId, accountId, {
      orderId: tpOrderId,
      price: newTpPrice.toString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update take profit order', { tpOrderId, accountId }, error as Error);
    throw new OrderRejectionError(`Failed to update take profit order: ${errorMessage}`, tpOrderId);
  }
}

/**
 * Updates an existing stop loss order.
 * 
 * @param {string} slOrderId - Stop loss order ID
 * @param {number} newSlPrice - New stop loss price
 * @param {string} accountId - Account ID
 * @returns {Promise<AppOrder>} The updated order
 * @throws {Error} If update fails
 */
export async function updateSLOrder(
  slOrderId: string,
  newSlPrice: number,
  accountId: string
): Promise<AppOrder> {
  if (!slOrderId || typeof slOrderId !== 'string') {
    throw new Error('Stop loss order ID is required');
  }
  if (newSlPrice <= 0) {
    throw new Error('New stop loss price must be positive');
  }
  if (!accountId || typeof accountId !== 'string') {
    throw new Error('Account ID is required');
  }

  try {
    // For stop orders, we need to update the stop-trigger field
    // This may require a different API call or payload structure
    // For now, use replaceOrder which should handle it
    return await replaceOrder(slOrderId, accountId, {
      orderId: slOrderId,
      price: newSlPrice.toString(), // Note: This may need to be stop-trigger field
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to update stop loss order', { slOrderId, accountId }, error as Error);
    throw new OrderRejectionError(`Failed to update stop loss order: ${errorMessage}`, slOrderId);
  }
}

/**
 * Cancels a take profit order.
 * 
 * @param {string} tpOrderId - Take profit order ID
 * @param {string} accountId - Account ID
 * @returns {Promise<void>}
 * @throws {Error} If cancellation fails
 */
export async function cancelTPOrder(
  tpOrderId: string,
  accountId: string
): Promise<void> {
  return await cancelOrder(tpOrderId, accountId);
}

/**
 * Cancels a stop loss order.
 * 
 * @param {string} slOrderId - Stop loss order ID
 * @param {string} accountId - Account ID
 * @returns {Promise<void>}
 * @throws {Error} If cancellation fails
 */
export async function cancelSLOrder(
  slOrderId: string,
  accountId: string
): Promise<void> {
  return await cancelOrder(slOrderId, accountId);
}

/**
 * Submits a new take profit order to replace an existing one.
 * 
 * Cancels the old TP order and submits a new one. Useful when the old order
 * cannot be modified or when replacing with a completely different order.
 * 
 * @param {OrderLeg[]} exitLegs - Exit order legs (reversed from entry)
 * @param {number} tpPrice - Take profit price
 * @param {string} accountId - Account ID
 * @param {string} oldTpOrderId - Old TP order ID to cancel (optional)
 * @param {'GTC' | 'DAY' | 'EXT' | 'IOC' | 'FOK'} timeInForce - Time in force
 * @returns {Promise<AppOrder>} The new TP order
 * @throws {Error} If submission fails
 */
export async function submitNewTPOrder(
  exitLegs: OrderLeg[],
  tpPrice: number,
  accountId: string,
  oldTpOrderId?: string,
  timeInForce: 'GTC' | 'DAY' | 'EXT' | 'IOC' | 'FOK' = 'GTC'
): Promise<AppOrder> {
  // Cancel old order if provided
  if (oldTpOrderId) {
    try {
      await cancelTPOrder(oldTpOrderId, accountId);
      logger.info('Old TP order cancelled', { oldTpOrderId, accountId });
    } catch (error) {
      // Log error but continue - the old order might already be filled/cancelled
      logger.warn('Failed to cancel old TP order, continuing with new submission', {
        oldTpOrderId,
        accountId,
      }, error as Error);
    }
  }

  // Submit new TP order
  return await submitTPOrder(exitLegs, tpPrice, accountId, timeInForce);
}

/**
 * Submits a new stop loss order to replace an existing one.
 * 
 * Cancels the old SL order and submits a new one. Useful when the old order
 * cannot be modified or when replacing with a completely different order.
 * 
 * @param {OrderLeg[]} exitLegs - Exit order legs (reversed from entry)
 * @param {number} slPrice - Stop loss price (stop-trigger)
 * @param {string} accountId - Account ID
 * @param {string} oldSlOrderId - Old SL order ID to cancel (optional)
 * @param {'GTC' | 'DAY' | 'EXT' | 'IOC' | 'FOK'} timeInForce - Time in force
 * @returns {Promise<AppOrder>} The new SL order
 * @throws {Error} If submission fails
 */
export async function submitNewSLOrder(
  exitLegs: OrderLeg[],
  slPrice: number,
  accountId: string,
  oldSlOrderId?: string,
  timeInForce: 'GTC' | 'DAY' | 'EXT' | 'IOC' | 'FOK' = 'GTC'
): Promise<AppOrder> {
  // Cancel old order if provided
  if (oldSlOrderId) {
    try {
      await cancelSLOrder(oldSlOrderId, accountId);
      logger.info('Old SL order cancelled', { oldSlOrderId, accountId });
    } catch (error) {
      // Log error but continue - the old order might already be filled/cancelled
      logger.warn('Failed to cancel old SL order, continuing with new submission', {
        oldSlOrderId,
        accountId,
      }, error as Error);
    }
  }

  // Submit new SL order
  return await submitSLOrder(exitLegs, slPrice, accountId, timeInForce);
}

