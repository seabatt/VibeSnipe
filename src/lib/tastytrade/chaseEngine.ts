/**
 * Tastytrade order chase engine.
 * 
 * This module provides a reusable async function for chasing orders by
 * incrementally adjusting limit prices to improve fill probability.
 * Supports adaptive, delta-aware entries with configurable chase parameters.
 */

import { EventEmitter } from 'events';
import { replaceOrder } from './orders';
import type { AppOrder } from './types';

/**
 * Chase configuration for order chasing behavior.
 */
export interface ChaseConfig {
  /** Step size for price adjustments (in dollars, e.g., 0.05 for 5 cents) */
  stepSize: number;
  /** Interval between chase attempts in milliseconds */
  stepIntervalMs: number;
  /** Maximum number of chase attempts */
  maxSteps: number;
  /** Maximum slippage allowed (in dollars from initial price) */
  maxSlippage: number;
  /** Direction to chase: 'up' to increase limit, 'down' to decrease limit */
  direction: 'up' | 'down';
  /** Initial limit price */
  initialPrice: number;
}

/**
 * Extended entry configuration with chase settings.
 */
export interface EntryConfigWithChase {
  /** Chase configuration */
  chase: ChaseConfig;
  /** Account ID for order operations */
  accountId: string;
}

/**
 * Chase attempt data.
 */
export interface ChaseAttempt {
  /** Attempt number (1-indexed) */
  attemptNumber: number;
  /** Current limit price */
  currentPrice: number;
  /** Elapsed time since chase started (in milliseconds) */
  elapsedMs: number;
  /** Order ID being chased */
  orderId: string;
  /** Price adjustment made in this attempt */
  priceAdjustment: number;
}

/**
 * Chase result when order is filled.
 */
export interface ChaseFillResult {
  /** Order ID that was filled */
  orderId: string;
  /** Fill price */
  fillPrice: number;
  /** Total number of attempts */
  totalAttempts: number;
  /** Total elapsed time in milliseconds */
  totalElapsedMs: number;
  /** Final limit price */
  finalPrice: number;
  /** Order details */
  order: AppOrder;
}

/**
 * Chase result when chase is aborted.
 */
export interface ChaseAbortResult {
  /** Order ID that was aborted */
  orderId: string;
  /** Reason for abort */
  reason: 'max_steps' | 'max_slippage' | 'rejected' | 'cancelled';
  /** Total number of attempts */
  totalAttempts: number;
  /** Total elapsed time in milliseconds */
  totalElapsedMs: number;
  /** Final limit price */
  finalPrice: number;
  /** Current order status */
  orderStatus: AppOrder['status'];
  /** Optional error message */
  error?: string;
}

/**
 * Chase engine event emitter.
 */
class ChaseEngineEmitter extends EventEmitter {
  /**
   * Subscribe to chase engine events.
   * 
   * @param {string} event - Event name: 'attempt', 'fill', 'abort'
   * @param {Function} callback - Callback function
   * @returns {this} For method chaining
   * 
   * @example
   * ```ts
   * chaseEngine.on('attempt', (attempt: ChaseAttempt) => {
   *   console.log(`Attempt ${attempt.attemptNumber} at price ${attempt.currentPrice}`);
   * });
   * 
   * chaseEngine.on('fill', (result: ChaseFillResult) => {
   *   console.log(`Order filled at ${result.fillPrice}`);
   * });
   * 
   * chaseEngine.on('abort', (result: ChaseAbortResult) => {
   *   console.log(`Chase aborted: ${result.reason}`);
   * });
   * ```
   */
  on(event: 'attempt', callback: (attempt: ChaseAttempt) => void): this;
  on(event: 'fill', callback: (result: ChaseFillResult) => void): this;
  on(event: 'abort', callback: (result: ChaseAbortResult) => void): this;
  on(event: string, callback: (...args: any[]) => void): this {
    return super.on(event, callback);
  }

  /**
   * Remove event listener.
   * 
   * @param {string} event - Event name
   * @param {Function} callback - Callback function
   * @returns {this} For method chaining
   */
  off(event: string, callback: (...args: any[]) => void): this {
    return super.off(event, callback);
  }
}

/**
 * Global chase engine event emitter instance.
 */
const chaseEngine = new ChaseEngineEmitter();

/**
 * Chases an order by incrementally adjusting the limit price.
 * 
 * This function tracks limit price, attempt count, and elapsed time.
 * Every `entryConfig.chase.stepIntervalMs`, it increases or decreases
 * the limit by `entryConfig.chase.stepSize` and issues a cancel-replace
 * via `replaceOrder()`. The chase stops on fill, reject, or when reaching
 * maxSteps or maxSlippage.
 * 
 * Events emitted:
 * - `'attempt'`: Fired before each chase attempt with ChaseAttempt data
 * - `'fill'`: Fired when order is filled with ChaseFillResult data
 * - `'abort'`: Fired when chase is aborted with ChaseAbortResult data
 * 
 * @param {AppOrder} order - The order to chase
 * @param {EntryConfigWithChase} entryConfig - Entry configuration with chase settings
 * @returns {Promise<ChaseFillResult | ChaseAbortResult>} Result of the chase
 * @throws {Error} If chase fails due to API errors
 * 
 * @example
 * ```ts
 * const order = await submitVertical(vertical, 1, 2.50, 'LIMIT', 'account-123');
 * 
 * const entryConfig: EntryConfigWithChase = {
 *   accountId: 'account-123',
 *   chase: {
 *     stepSize: 0.05,
 *     stepIntervalMs: 1000,
 *     maxSteps: 10,
 *     maxSlippage: 0.50,
 *     direction: 'up',
 *     initialPrice: 2.50,
 *   },
 * };
 * 
 * // Subscribe to events
 * chaseEngine.on('attempt', (attempt) => {
 *   console.log(`Chase attempt ${attempt.attemptNumber} at $${attempt.currentPrice}`);
 * });
 * 
 * chaseEngine.on('fill', (result) => {
 *   console.log(`Order filled at $${result.fillPrice} after ${result.totalAttempts} attempts`);
 * });
 * 
 * // Start chasing
 * const result = await chaseOrder(order, entryConfig);
 * 
 * if ('fillPrice' in result) {
 *   console.log('Order filled successfully!');
 * } else {
 *   console.log(`Chase aborted: ${result.reason}`);
 * }
 * ```
 */
export async function chaseOrder(
  order: AppOrder,
  entryConfig: EntryConfigWithChase
): Promise<ChaseFillResult | ChaseAbortResult> {
  const { chase, accountId } = entryConfig;
  const { stepSize, stepIntervalMs, maxSteps, maxSlippage, direction, initialPrice } = chase;

  // Validate order
  if (order.status !== 'WORKING' && order.status !== 'PENDING') {
    const abortResult: ChaseAbortResult = {
      orderId: order.id,
      reason: order.status === 'REJECTED' ? 'rejected' : 'cancelled',
      totalAttempts: 0,
      totalElapsedMs: 0,
      finalPrice: order.netPrice || 0,
      orderStatus: order.status,
      error: `Order is not in a chaseable state: ${order.status}`,
    };
    chaseEngine.emit('abort', abortResult);
    return abortResult;
  }

  // Validate order type
  if (order.orderType !== 'LIMIT') {
    throw new Error('Chase engine only supports LIMIT orders');
  }

  // Validate initial price
  if (!order.netPrice || order.netPrice <= 0) {
    throw new Error('Order must have a valid netPrice to chase');
  }

  // Initialize tracking variables
  let currentPrice = order.netPrice;
  let attemptNumber = 0;
  const startTime = Date.now();

  // Helper function to sleep for step interval
  const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

  // Helper function to check order status (would need to fetch from API)
  // For now, we'll check status after each replace attempt
  let lastOrderStatus: AppOrder['status'] = order.status;

  // Main chase loop
  while (attemptNumber < maxSteps) {
    // Calculate elapsed time
    const elapsedMs = Date.now() - startTime;

    // Calculate next price adjustment
    const priceAdjustment = direction === 'up' ? stepSize : -stepSize;
    const nextPrice = currentPrice + priceAdjustment;

    // Check slippage limit
    const slippage = Math.abs(nextPrice - initialPrice);
    if (slippage > maxSlippage) {
      const abortResult: ChaseAbortResult = {
        orderId: order.id,
        reason: 'max_slippage',
        totalAttempts: attemptNumber,
        totalElapsedMs: elapsedMs,
        finalPrice: currentPrice,
        orderStatus: lastOrderStatus,
        error: `Max slippage ${maxSlippage} exceeded. Current slippage: ${slippage.toFixed(2)}`,
      };
      chaseEngine.emit('abort', abortResult);
      return abortResult;
    }

    // Wait for step interval (except on first attempt)
    // Sleep before making the attempt, not after
    if (attemptNumber > 0) {
      await sleep(stepIntervalMs);
    }

    // Increment attempt number
    attemptNumber++;
    
    // Update elapsed time
    const updatedElapsedMs = Date.now() - startTime;

    // Update current price
    currentPrice = nextPrice;

    // Emit attempt event
    const attempt: ChaseAttempt = {
      attemptNumber,
      currentPrice,
      elapsedMs: updatedElapsedMs,
      orderId: order.id,
      priceAdjustment,
    };
    chaseEngine.emit('attempt', attempt);

    try {
      // Issue cancel-replace via replaceOrder
      const updatedOrder = await replaceOrder(
        order.id,
        accountId,
        {
          orderId: order.id,
          price: currentPrice.toFixed(2),
        }
      );

      // Update last known status
      lastOrderStatus = updatedOrder.status;

      // Check if order was filled
      if (updatedOrder.status === 'FILLED') {
        const fillResult: ChaseFillResult = {
          orderId: order.id,
          fillPrice: currentPrice,
          totalAttempts: attemptNumber,
          totalElapsedMs: updatedElapsedMs,
          finalPrice: currentPrice,
          order: updatedOrder,
        };
        chaseEngine.emit('fill', fillResult);
        return fillResult;
      }

      // Check if order was rejected
      if (updatedOrder.status === 'REJECTED') {
        const abortResult: ChaseAbortResult = {
          orderId: order.id,
          reason: 'rejected',
          totalAttempts: attemptNumber,
          totalElapsedMs: updatedElapsedMs,
          finalPrice: currentPrice,
          orderStatus: updatedOrder.status,
          error: updatedOrder.error || 'Order was rejected',
        };
        chaseEngine.emit('abort', abortResult);
        return abortResult;
      }

      // Check if order was cancelled
      if (updatedOrder.status === 'CANCELLED') {
        const abortResult: ChaseAbortResult = {
          orderId: order.id,
          reason: 'cancelled',
          totalAttempts: attemptNumber,
          totalElapsedMs: updatedElapsedMs,
          finalPrice: currentPrice,
          orderStatus: updatedOrder.status,
        };
        chaseEngine.emit('abort', abortResult);
        return abortResult;
      }

      // Continue chasing if order is still WORKING or PENDING
      // (Note: In a real implementation, you might want to fetch fresh order status
      //  from the API rather than relying on the replaceOrder response)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // If replace fails, abort the chase
      const abortResult: ChaseAbortResult = {
        orderId: order.id,
        reason: 'rejected',
        totalAttempts: attemptNumber,
        totalElapsedMs: Date.now() - startTime,
        finalPrice: currentPrice,
        orderStatus: lastOrderStatus,
        error: `Replace order failed: ${errorMessage}`,
      };
      chaseEngine.emit('abort', abortResult);
      return abortResult;
    }
  }

  // Max steps reached
  const abortResult: ChaseAbortResult = {
    orderId: order.id,
    reason: 'max_steps',
    totalAttempts: attemptNumber,
    totalElapsedMs: Date.now() - startTime,
    finalPrice: currentPrice,
    orderStatus: lastOrderStatus,
    error: `Max chase steps (${maxSteps}) reached`,
  };
  chaseEngine.emit('abort', abortResult);
  return abortResult;
}

/**
 * Subscribe to chase engine events.
 * 
 * This is a convenience function that wraps the chaseEngine.on() method.
 * 
 * @param {string} event - Event name: 'attempt', 'fill', 'abort'
 * @param {Function} callback - Callback function
 * 
 * @example
 * ```ts
 * on('attempt', (attempt: ChaseAttempt) => {
 *   console.log(`Chase attempt ${attempt.attemptNumber}`);
 * });
 * ```
 */
export function on(
  event: 'attempt',
  callback: (attempt: ChaseAttempt) => void
): void;
export function on(
  event: 'fill',
  callback: (result: ChaseFillResult) => void
): void;
export function on(
  event: 'abort',
  callback: (result: ChaseAbortResult) => void
): void;
export function on(event: 'attempt' | 'fill' | 'abort', callback: (...args: any[]) => void): void {
  (chaseEngine as EventEmitter).on(event, callback);
}

/**
 * Remove event listener.
 * 
 * @param {string} event - Event name
 * @param {Function} callback - Callback function
 * 
 * @example
 * ```ts
 * off('attempt', callback);
 * ```
 */
export function off(
  event: 'attempt',
  callback: (attempt: ChaseAttempt) => void
): void;
export function off(
  event: 'fill',
  callback: (result: ChaseFillResult) => void
): void;
export function off(
  event: 'abort',
  callback: (result: ChaseAbortResult) => void
): void;
export function off(event: 'attempt' | 'fill' | 'abort', callback: (...args: any[]) => void): void {
  (chaseEngine as EventEmitter).off(event, callback);
}

