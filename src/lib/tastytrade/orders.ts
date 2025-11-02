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

    // Build dry run payload
    const payload: ComplexOrderPayload = {
      orderType,
      timeInForce: 'DAY',
      legs,
      quantity,
      price: limitPrice?.toFixed(2),
    };

    // Call SDK dry run endpoint
    // NOTE: Adjust this based on actual @tastytrade/api SDK API
    // Example pattern:
    // const response = await client.orders.dryRun(payload);
    // return {
    //   valid: response.valid,
    //   estimatedPrice: response.estimatedPrice ? parseFloat(response.estimatedPrice) : undefined,
    //   errors: response.errors,
    //   warnings: response.warnings,
    // };

    console.warn('Dry run not yet implemented. Would validate order:', payload);

    // Placeholder validation logic
    const estimatedPrice = limitPrice || 
      ((vertical.shortLeg.ask || 0) - (vertical.longLeg.bid || 0));

    return {
      valid: true,
      estimatedPrice,
      warnings: ['Dry run not fully implemented - using placeholder validation'],
    };
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

    // Build complex order payload
    const payload: ComplexOrderPayload = {
      orderType,
      timeInForce: 'DAY',
      legs,
      quantity,
      price: limitPrice?.toFixed(2),
    };

    // Submit order via SDK
    // NOTE: Adjust this based on actual @tastytrade/api SDK API
    // Example pattern:
    // const response = await client.orders.submitComplexOrder(accountId, payload);
    // return normalizeOrder(response.data);

    console.warn('Order submission not yet implemented. Would submit:', payload);

    // Placeholder: Normalize SDK response to AppOrder format
    // In actual implementation, this would:
    // - Call client.orders.submitComplexOrder(accountId, payload)
    // - Parse response and convert to AppOrder
    // - Handle errors appropriately

    const now = new Date().toISOString();
    const placeholderOrder: AppOrder = {
      id: `ORDER-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      accountId,
      legs,
      orderType,
      timeInForce: 'DAY',
      status: 'PENDING',
      quantity,
      netPrice: limitPrice,
      createdAt: now,
    };

    return placeholderOrder;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to submit order: ${errorMessage}`);
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
    // NOTE: Adjust this based on actual @tastytrade/api SDK API
    // Example:
    // await client.orders.cancel(accountId, orderId);

    console.warn(`Order cancellation not yet implemented. Would cancel: ${orderId}`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to cancel order: ${errorMessage}`);
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
    
    // Build replace payload
    const replacePayload: ReplaceOrderPayload = {
      ...updates,
      orderId,
    };

    // Replace order via SDK
    // NOTE: Adjust this based on actual @tastytrade/api SDK API
    // Example:
    // const response = await client.orders.replace(accountId, replacePayload);
    // return normalizeOrder(response.data);

    console.warn(`Order replacement not yet implemented. Would replace: ${orderId}`, updates);

    // Placeholder: Return updated order
    // In actual implementation, this would call the SDK and normalize the response
    throw new Error('Order replacement not yet implemented');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to replace order: ${errorMessage}`);
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

    // Try to use SDK's contingent order support (if available)
    // NOTE: Adjust this based on actual @tastytrade/api SDK API
    // Example pattern:
    // const tpOrder = await client.orders.submitComplexOrder(accountId, {
    //   orderType: 'LIMIT',
    //   timeInForce: 'GTC',
    //   legs: exitLegs,
    //   quantity,
    //   price: tp.toFixed(2),
    //   contingentOrders: [{ type: 'OTO', cancelOrderIds: [stopLossOrderId] }],
    // });
    // const slOrder = await client.orders.submitComplexOrder(accountId, {
    //   orderType: 'LIMIT',
    //   timeInForce: 'GTC',
    //   legs: stopLossLegs,
    //   quantity,
    //   price: sl.toFixed(2),
    //   contingentOrders: [{ type: 'OTO', cancelOrderIds: [tpOrderId] }],
    // });

    console.warn(
      'OCO bracket building not yet implemented. ' +
      'Would create OTO orders for parent:', parentOrderId
    );

    // Placeholder: App-side OCO emulation
    // In actual implementation, this would:
    // 1. Create both TP and SL orders
    // 2. If SDK supports contingent orders, use that
    // 3. Otherwise, track OCO relationships app-side and manage cancellation manually
    // 4. Return bracket with both order IDs

    // For now, creating placeholder order IDs
    const tpOrderId = `ORDER-TP-${Date.now()}`;
    const slOrderId = `ORDER-SL-${Date.now()}`;

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
 * @returns {AppOrder} Normalized order
 */
function normalizeOrder(rawOrder: any): AppOrder {
  // NOTE: Adjust this based on actual SDK response format
  return {
    id: rawOrder.id || rawOrder.orderId,
    accountId: rawOrder.accountNumber || rawOrder.accountId,
    legs: rawOrder.legs || [],
    orderType: rawOrder.orderType || 'LIMIT',
    timeInForce: rawOrder.timeInForce || 'DAY',
    status: mapOrderStatus(rawOrder.status || rawOrder.state),
    quantity: rawOrder.quantity || 0,
    netPrice: rawOrder.price ? parseFloat(rawOrder.price) : undefined,
    createdAt: rawOrder.createdAt || rawOrder.placedTime || new Date().toISOString(),
    updatedAt: rawOrder.updatedAt || rawOrder.updatedTime,
    error: rawOrder.error || rawOrder.rejectionReason,
  };
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

