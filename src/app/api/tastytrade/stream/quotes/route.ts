/**
 * Tastytrade quote streaming endpoint (Server-Sent Events).
 * 
 * GET /api/tastytrade/stream/quotes?symbols=SPX,QQQ
 * 
 * Implements SSE that relays quote events from marketData.ts quoteEmitter.
 */

import { NextResponse } from 'next/server';
import { quoteEmitter, subscribeQuotes, unsubscribeQuotes } from '@/lib/tastytrade';
import type { GreekQuote } from '@/lib/tastytrade';

/**
 * GET handler for quote streaming via SSE.
 * 
 * @param {Request} request - Next.js request object
 * @returns {Promise<Response>} Streaming response with SSE format
 */
export async function GET(request: Request) {
  try {
    // Get symbols from query string
    const { searchParams } = new URL(request.url);
    const symbolsParam = searchParams.get('symbols');

    if (!symbolsParam) {
      return NextResponse.json(
        { error: 'Missing required query parameter: symbols (comma-separated)' },
        { status: 400 }
      );
    }

    // Parse symbols
    const symbols = symbolsParam
      .split(',')
      .map(s => s.trim().toUpperCase())
      .filter(s => s.length > 0);

    if (symbols.length === 0) {
      return NextResponse.json(
        { error: 'No valid symbols provided' },
        { status: 400 }
      );
    }

    // Subscribe to quotes
    await subscribeQuotes(symbols);

    // Create a readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        // Send initial connection message
        const sendEvent = (event: string, data: any) => {
          const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(encoder.encode(message));
        };

        sendEvent('connected', { 
          message: 'Quote stream connected',
          symbols,
          timestamp: new Date().toISOString(),
        });

        // Handler for quote events
        const onQuote = (quote: GreekQuote) => {
          try {
            sendEvent('quote', quote);
          } catch (error) {
            console.error('Error sending quote event:', error);
          }
        };

        // Handler for errors
        const onError = (error: Error) => {
          try {
            sendEvent('error', {
              message: error.message,
              timestamp: new Date().toISOString(),
            });
          } catch (err) {
            console.error('Error sending error event:', err);
          }
        };

        // Subscribe to quote events
        quoteEmitter.on('quote', onQuote);
        quoteEmitter.on('error', onError);

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          // Clean up event listeners
          quoteEmitter.removeListener('quote', onQuote);
          quoteEmitter.removeListener('error', onError);
          
          // Unsubscribe from quotes (optional - may want to keep subscriptions active)
          unsubscribeQuotes().catch(console.error);
          
          controller.close();
        });
      },
    });

    // Return streaming response with SSE headers
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // Disable buffering for nginx
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to establish quote stream',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      },
      { status: 500 }
    );
  }
}

