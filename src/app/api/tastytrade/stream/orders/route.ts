/**
 * Tastytrade order/account updates streaming endpoint (Server-Sent Events).
 * 
 * GET /api/tastytrade/stream/orders?accountId=account-123
 * 
 * Implements SSE that relays order and account updates from the SDK's account streamer.
 */

import { NextResponse } from 'next/server';
import { getClient } from '@/lib/tastytrade/client';
import { EventEmitter } from 'events';

/**
 * Event emitter for order/account updates.
 * This will be connected to the SDK's account streamer once implemented.
 */
const orderUpdateEmitter = new EventEmitter();

/**
 * Active account streamer instance.
 * Managed internally by the SDK.
 */
let accountStreamer: any = null;
let isAccountStreamConnected = false;

/**
 * Connects to the SDK's account streamer and sets up event handlers.
 * 
 * @param {string} accountId - Account ID to stream updates for
 */
async function connectAccountStream(accountId: string): Promise<void> {
  if (isAccountStreamConnected && accountStreamer) {
    return; // Already connected
  }

  try {
    const client = await getClient();
    
    // Initialize account streamer from SDK
    // SDK's accountStreamer is available on the client
    accountStreamer = client.accountStreamer;
    
    // Start the account streamer connection
    // SDK account streamer needs to be started before subscribing
    await accountStreamer.start();
    
    // Subscribe to account updates
    // SDK account streamer uses addMessageObserver to listen for updates
    accountStreamer.addMessageObserver((message: any) => {
      // Handle different message types from account streamer
      // Message structure may vary - normalize to our event format
      if (message.type === 'order' || message['order-update'] || message.status === 'order') {
        orderUpdateEmitter.emit('order', message.data || message);
      }
      if (message.type === 'position' || message['position-update'] || message.status === 'position') {
        orderUpdateEmitter.emit('position', message.data || message);
      }
      if (message.type === 'account' || message['account-update'] || message.status === 'account') {
        orderUpdateEmitter.emit('account', message.data || message);
      }
    });
    
    // Subscribe to specific account
    // SDK requires explicit subscription to accounts after starting
    await accountStreamer.subscribeToAccounts([accountId]);

    isAccountStreamConnected = true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to connect to account streamer: ${errorMessage}`);
  }
}

/**
 * GET handler for order/account updates streaming via SSE.
 * 
 * @param {Request} request - Next.js request object
 * @returns {Promise<Response>} Streaming response with SSE format
 */
export async function GET(request: Request) {
  try {
    // Get account ID from query string
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: accountId' },
        { status: 400 }
      );
    }

    // Connect to account streamer
    await connectAccountStream(accountId);

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
          message: 'Order/account stream connected',
          accountId,
          timestamp: new Date().toISOString(),
        });

        // Handler for order updates
        const onOrderUpdate = (update: any) => {
          try {
            sendEvent('order', update);
          } catch (error) {
            console.error('Error sending order update event:', error);
          }
        };

        // Handler for position updates
        const onPositionUpdate = (update: any) => {
          try {
            sendEvent('position', update);
          } catch (error) {
            console.error('Error sending position update event:', error);
          }
        };

        // Handler for account updates
        const onAccountUpdate = (update: any) => {
          try {
            sendEvent('account', update);
          } catch (error) {
            console.error('Error sending account update event:', error);
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

        // Subscribe to update events
        orderUpdateEmitter.on('order', onOrderUpdate);
        orderUpdateEmitter.on('position', onPositionUpdate);
        orderUpdateEmitter.on('account', onAccountUpdate);
        orderUpdateEmitter.on('error', onError);

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          // Clean up event listeners
          orderUpdateEmitter.removeListener('order', onOrderUpdate);
          orderUpdateEmitter.removeListener('position', onPositionUpdate);
          orderUpdateEmitter.removeListener('account', onAccountUpdate);
          orderUpdateEmitter.removeListener('error', onError);
          
          // Optionally disconnect account streamer when no clients
          // (may want to keep it connected for other clients)
          
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
        error: 'Failed to establish order/account stream',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      },
      { status: 500 }
    );
  }
}

