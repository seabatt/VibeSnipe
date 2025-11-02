/**
 * Tastytrade DXLink WebSocket market data streaming.
 * 
 * This module provides real-time quote streaming via Tastytrade's DXLink WebSocket
 * using the SDK's quote streamer functionality.
 */

import { EventEmitter } from 'events';
import { getClient } from './client';
import type { GreekQuote } from './types';

/**
 * Event emitter for quote updates.
 * Emits 'quote' events with normalized GreekQuote data.
 */
export const quoteEmitter = new EventEmitter();

/**
 * Active WebSocket connection instance.
 * Managed internally by the SDK's quote streamer.
 */
let quoteStreamer: any = null;

/**
 * Currently subscribed symbols.
 */
let subscribedSymbols: Set<string> = new Set();

/**
 * Connection state.
 */
let isConnected = false;

/**
 * Connects to the Tastytrade DXLink WebSocket using the SDK's quote streamer.
 * 
 * This initializes the WebSocket connection and sets up event handlers
 * for quote updates. The SDK handles connection management and reconnection.
 * 
 * @returns {Promise<void>}
 * @throws {Error} If connection fails
 * 
 * @example
 * ```ts
 * await connect();
 * subscribeQuotes(['SPX', 'QQQ']);
 * ```
 */
export async function connect(): Promise<void> {
  if (isConnected && quoteStreamer) {
    return; // Already connected
  }

  try {
    const client = await getClient();
    
    // Initialize quote streamer from SDK
    // NOTE: Adjust this based on actual @tastytrade/api SDK quote streamer API
    // Example pattern (adjust to match actual SDK):
    // quoteStreamer = client.dxLink.createQuoteStreamer();
    // quoteStreamer.on('quote', handleQuoteUpdate);
    // quoteStreamer.on('error', handleError);
    // await quoteStreamer.connect();

    console.warn(
      'Quote streamer not yet implemented. Install @tastytrade/api and update with actual SDK quote streamer API.'
    );

    // Placeholder: In a real implementation, this would be:
    // - Initialize the SDK's quote streamer
    // - Set up event handlers for quote updates
    // - Handle connection lifecycle
    // - Manage reconnection logic

    isConnected = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to connect to quote streamer: ${errorMessage}`);
  }
}

/**
 * Handles incoming quote updates from the WebSocket stream.
 * 
 * Normalizes the SDK's quote format into our GreekQuote structure
 * and emits 'quote' events.
 * 
 * @param {any} rawQuote - Raw quote data from SDK
 */
function handleQuoteUpdate(rawQuote: any): void {
  try {
    // Normalize quote data from SDK format to GreekQuote
    // NOTE: Adjust mapping based on actual SDK quote structure
    const normalizedQuote: GreekQuote = {
      symbol: rawQuote.symbol || rawQuote.streamerSymbol || '',
      bid: parseFloat(rawQuote.bid || rawQuote.bidPrice || '0'),
      ask: parseFloat(rawQuote.ask || rawQuote.askPrice || '0'),
      mark: parseFloat(rawQuote.mark || rawQuote.midpoint || 
        ((parseFloat(rawQuote.bid || rawQuote.bidPrice || '0') + 
          parseFloat(rawQuote.ask || rawQuote.askPrice || '0')) / 2)),
      delta: rawQuote.delta !== undefined ? parseFloat(rawQuote.delta) : undefined,
      gamma: rawQuote.gamma !== undefined ? parseFloat(rawQuote.gamma) : undefined,
      theta: rawQuote.theta !== undefined ? parseFloat(rawQuote.theta) : undefined,
      vega: rawQuote.vega !== undefined ? parseFloat(rawQuote.vega) : undefined,
      timestamp: rawQuote.timestamp || rawQuote.quoteTime || new Date().toISOString(),
    };

    // Emit the normalized quote
    quoteEmitter.emit('quote', normalizedQuote);
  } catch (error) {
    console.error('Error normalizing quote update:', error);
    quoteEmitter.emit('error', error);
  }
}

/**
 * Handles streamer errors.
 * 
 * @param {Error} error - Error from the streamer
 */
function handleError(error: Error): void {
  console.error('Quote streamer error:', error);
  quoteEmitter.emit('error', error);
  
  // Attempt reconnection if connection was lost
  if (isConnected) {
    isConnected = false;
    setTimeout(() => {
      connect().catch(console.error);
    }, 5000);
  }
}

/**
 * Subscribes to real-time quotes for the given symbols.
 * 
 * Symbols can be underlying symbols (e.g., "SPX", "QQQ") or option streamer symbols.
 * The SDK handles subscription management and will send quote updates via WebSocket.
 * 
 * @param {string[]} symbols - Array of symbols to subscribe to
 * @returns {Promise<void>}
 * @throws {Error} If not connected or subscription fails
 * 
 * @example
 * ```ts
 * await subscribeQuotes(['SPX', 'QQQ']);
 * quoteEmitter.on('quote', (quote) => {
 *   console.log('Quote update:', quote);
 * });
 * ```
 */
export async function subscribeQuotes(symbols: string[]): Promise<void> {
  if (!isConnected || !quoteStreamer) {
    await connect();
  }

  // Filter out already subscribed symbols
  const newSymbols = symbols.filter(s => !subscribedSymbols.has(s));
  
  if (newSymbols.length === 0) {
    return; // All symbols already subscribed
  }

  try {
    // Subscribe via SDK quote streamer
    // NOTE: Adjust this based on actual SDK API
    // Example:
    // await quoteStreamer.subscribe(newSymbols);

    // Add to subscribed set
    newSymbols.forEach(symbol => subscribedSymbols.add(symbol));

    console.warn(
      `Quote subscription not yet implemented. Would subscribe to: ${newSymbols.join(', ')}`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to subscribe to quotes: ${errorMessage}`);
  }
}

/**
 * Unsubscribes from all quote streams.
 * 
 * Clears all subscriptions and closes the WebSocket connection.
 * 
 * @returns {Promise<void>}
 * 
 * @example
 * ```ts
 * await unsubscribeQuotes();
 * ```
 */
export async function unsubscribeQuotes(): Promise<void> {
  if (!quoteStreamer) {
    return; // Not connected
  }

  try {
    // Unsubscribe via SDK
    // NOTE: Adjust this based on actual SDK API
    // Example:
    // await quoteStreamer.unsubscribeAll();
    // await quoteStreamer.disconnect();

    subscribedSymbols.clear();
    isConnected = false;
    quoteStreamer = null;

    console.warn('Quote unsubscription not yet implemented.');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error unsubscribing from quotes: ${errorMessage}`);
  }
}

/**
 * Gets the list of currently subscribed symbols.
 * 
 * @returns {string[]} Array of subscribed symbols
 */
export function getSubscribedSymbols(): string[] {
  return Array.from(subscribedSymbols);
}

/**
 * Checks if currently connected to the quote streamer.
 * 
 * @returns {boolean} True if connected
 */
export function isQuoteStreamConnected(): boolean {
  return isConnected;
}

