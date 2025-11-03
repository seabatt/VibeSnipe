/**
 * Tastytrade quote streaming endpoint (Server-Sent Events).
 * 
 * GET /api/tastytrade/stream/quotes?symbols=SPX,QQQ
 * 
 * Implements SSE that relays quote events from marketData.ts quoteEmitter.
 */

import { NextResponse } from 'next/server';
import { quoteEmitter, subscribeQuotes, unsubscribeQuotes } from '@/lib/tastytrade/marketData';
import type { GreekQuote } from '@/lib/tastytrade/types';
import { logger } from '@/lib/logger';

/**
 * GET handler for quote streaming via SSE.
 * 
 * @param {Request} request - Next.js request object
 * @returns {Promise<Response>} Streaming response with SSE format
 */
export async function GET(request: Request) {
  try {
    // Validate credentials before attempting to subscribe
    try {
      const { getTastytradeConfig } = await import('@/lib/env');
      getTastytradeConfig();
    } catch (configError) {
      const configErrorMessage = configError instanceof Error ? configError.message : 'Unknown error';
      
      logger.error('Failed to load Tastytrade configuration for quote stream', { 
        error: configErrorMessage 
      });
      
      return NextResponse.json(
        { 
          error: 'Tastytrade credentials not configured',
          message: 'Missing or invalid Tastytrade credentials',
          details: configErrorMessage,
          troubleshooting: [
            'Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
            'Verify the following variables are set:',
            '  - TASTYTRADE_ENV (must be "sandbox" or "prod")',
            '  - TASTYTRADE_CLIENT_SECRET (required)',
            '  - TASTYTRADE_REFRESH_TOKEN (required)',
            '  - TASTYTRADE_CLIENT_ID (optional but recommended)',
            'Ensure values are not empty or whitespace-only',
            'Verify credentials match your Tastytrade OAuth application'
          ]
        },
        { status: 500 }
      );
    }

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
            logger.error('Error sending quote event', { symbol: quote.symbol }, error as Error);
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
            logger.error('Error sending error event', undefined, err as Error);
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
          unsubscribeQuotes().catch(err => logger.error('Unsubscribe error', undefined, err));
          
          logger.info('Quote stream client disconnected');
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
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to establish quote stream', { 
      error: errorMessage,
      stack: errorStack
    }, error as Error);
    
    // Check if it's an authentication error
    const isOAuth2Error = errorMessage.includes('OAuth2') || errorMessage.includes('token exchange');
    const isCredentialError = errorMessage.includes('missing') || errorMessage.includes('empty') || errorMessage.includes('invalid');
    const isAuthError = errorMessage.includes('401') || errorMessage.includes('Unauthorized') || isOAuth2Error || isCredentialError;
    
    // Provide more actionable error messages
    let errorResponse: any = {
      error: 'Failed to establish quote stream',
    };
    
    if (isAuthError) {
      errorResponse = {
        ...errorResponse,
        message: 'Authentication failed while establishing quote stream',
        troubleshooting: [
          'Verify TASTYTRADE_CLIENT_SECRET and TASTYTRADE_REFRESH_TOKEN are set in Vercel',
          'Ensure credentials match your Tastytrade OAuth application',
          'Check that TASTYTRADE_ENV is set correctly (sandbox or prod)',
          'Regenerate refresh token if it expired: https://tastytrade.com/api/settings',
          'Review Tastytrade OAuth application settings: https://tastytrade.com/api/settings'
        ]
      };
      
      // Include detailed error in development
      if (process.env.NODE_ENV === 'development') {
        errorResponse.details = errorMessage;
        if (errorStack) {
          errorResponse.stack = errorStack;
        }
      }
    } else if (process.env.NODE_ENV === 'development') {
      // Include error details in development for other errors
      errorResponse.details = errorMessage;
      if (errorStack) {
        errorResponse.stack = errorStack;
      }
    }
    
    // Return appropriate status code based on error type
    const statusCode = isAuthError ? 401 : 500;
    
    return NextResponse.json(
      errorResponse,
      { status: statusCode }
    );
  }
}

