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
let quoteStreamer: any = null; // Type: QuoteStreamer from @tastytrade/api

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
    
    // Import QuoteStreamer from SDK
    // The QuoteStreamer is a separate export from the SDK
    const { QuoteStreamer } = await import('@tastytrade/api');
    
    // QuoteStreamer requires a quote token and URL
    // Get quote token from SDK's accountsAndCustomersService
    const tokenResponse = await client.accountsAndCustomersService.getQuoteStreamerTokens();
    
    // Extract quote token from response
    // Response format may vary - handle different structures
    const quoteToken = tokenResponse?.data?.token || 
                       tokenResponse?.token || 
                       tokenResponse?.quoteToken ||
                       (Array.isArray(tokenResponse) && tokenResponse.length > 0 
                         ? tokenResponse[0].token || tokenResponse[0]
                         : '');
    
    if (!quoteToken) {
      throw new Error('Quote token not available - authentication required');
    }
    
    // Determine quote streamer URL based on environment
    const quoteUrl = client.baseUrl.includes('cert') 
      ? 'wss://dxlink.cert.tastytrade.com'
      : 'wss://dxlink.tastytrade.com';
    
    // Initialize quote streamer with token and URL
    quoteStreamer = new QuoteStreamer(quoteToken, quoteUrl);
    
    // Connect to the quote streamer
    quoteStreamer.connect();
    
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
    // Normalize quote data from SDK/DXLink format to GreekQuote
    // DXLink events can have various structures - handle common patterns
    const symbol = rawQuote.eventSymbol || 
                   rawQuote.symbol || 
                   rawQuote.streamerSymbol || 
                   rawQuote.sym || 
                   '';
    
    // Extract bid/ask from various possible field names
    const bid = rawQuote.bid !== undefined ? parseFloat(rawQuote.bid) :
                rawQuote.bidPrice !== undefined ? parseFloat(rawQuote.bidPrice) :
                rawQuote.bid_price !== undefined ? parseFloat(rawQuote.bid_price) : 0;
    
    const ask = rawQuote.ask !== undefined ? parseFloat(rawQuote.ask) :
                rawQuote.askPrice !== undefined ? parseFloat(rawQuote.askPrice) :
                rawQuote.ask_price !== undefined ? parseFloat(rawQuote.ask_price) : 0;
    
    // Calculate mark from bid/ask if not provided
    const mark = rawQuote.mark !== undefined ? parseFloat(rawQuote.mark) :
                 rawQuote.midpoint !== undefined ? parseFloat(rawQuote.midpoint) :
                 rawQuote.mid !== undefined ? parseFloat(rawQuote.mid) :
                 (bid > 0 && ask > 0 ? (bid + ask) / 2 : 0);
    
    // Extract Greeks from various possible field names
    const delta = rawQuote.delta !== undefined ? parseFloat(rawQuote.delta) :
                  rawQuote.Delta !== undefined ? parseFloat(rawQuote.Delta) : undefined;
    
    const gamma = rawQuote.gamma !== undefined ? parseFloat(rawQuote.gamma) :
                  rawQuote.Gamma !== undefined ? parseFloat(rawQuote.Gamma) : undefined;
    
    const theta = rawQuote.theta !== undefined ? parseFloat(rawQuote.theta) :
                  rawQuote.Theta !== undefined ? parseFloat(rawQuote.Theta) : undefined;
    
    const vega = rawQuote.vega !== undefined ? parseFloat(rawQuote.vega) :
                 rawQuote.Vega !== undefined ? parseFloat(rawQuote.Vega) : undefined;
    
    // Extract timestamp
    const timestamp = rawQuote.time !== undefined ? new Date(rawQuote.time).toISOString() :
                     rawQuote.timestamp !== undefined ? new Date(rawQuote.timestamp).toISOString() :
                     rawQuote.eventTime !== undefined ? new Date(rawQuote.eventTime).toISOString() :
                     new Date().toISOString();
    
    const normalizedQuote: GreekQuote = {
      symbol,
      bid,
      ask,
      mark,
      delta,
      gamma,
      theta,
      vega,
      timestamp,
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
    // QuoteStreamer.subscribe() takes (dxfeedSymbol, eventHandler) for each symbol
    newSymbols.forEach(symbol => {
      // Subscribe each symbol with event handler
      quoteStreamer.subscribe(symbol, (event: any) => {
        handleQuoteUpdate(event);
      });
      
      // Add to subscribed set
      subscribedSymbols.add(symbol);
    });
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
    // Unsubscribe and disconnect via SDK
    // Note: SDK may have unsubscribe method or we may need to track subscriptions manually
    // For now, disconnect and clear subscriptions
    if (quoteStreamer && typeof quoteStreamer.disconnect === 'function') {
      await quoteStreamer.disconnect();
    }

    subscribedSymbols.clear();
    isConnected = false;
    quoteStreamer = null;
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

