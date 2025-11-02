/**
 * Tastytrade order status and cancellation endpoint.
 * 
 * GET /api/tastytrade/orders/[id] - Fetch order status
 * DELETE /api/tastytrade/orders/[id] - Cancel working order
 */

import { NextResponse } from 'next/server';
import { cancelOrder } from '@/lib/tastytrade/orders';
import { getClient } from '@/lib/tastytrade/client';

/**
 * GET handler for order status.
 * 
 * @param {Request} request - Next.js request object
 * @param {{ params: Promise<{ id: string }> }} context - Route context with dynamic params
 * @returns {Promise<NextResponse>} JSON response with order status
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Resolve params
    const { id } = await params;

    // Get account ID from query string (optional, may be required by SDK)
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: accountId' },
        { status: 400 }
      );
    }

    const client = await getClient();

    // Fetch order from SDK
    // SDK expects orderId as number
    const orderIdNum = parseInt(id, 10);
    if (isNaN(orderIdNum)) {
      return NextResponse.json(
        { error: 'Invalid order ID format' },
        { status: 400 }
      );
    }

    // Get order from SDK
    const order = await client.orderService.getOrder(accountId, orderIdNum);
    
    return NextResponse.json(order);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch order status',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE handler for order cancellation.
 * 
 * @param {Request} request - Next.js request object
 * @param {{ params: Promise<{ id: string }> }} context - Route context with dynamic params
 * @returns {Promise<NextResponse>} JSON response confirming cancellation
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Resolve params
    const { id } = await params;

    // Get account ID from query string (required for cancellation)
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('accountId');

    if (!accountId) {
      return NextResponse.json(
        { error: 'Missing required query parameter: accountId' },
        { status: 400 }
      );
    }

    // Cancel the order
    await cancelOrder(id, accountId);

    return NextResponse.json({
      orderId: id,
      status: 'CANCELLED',
      message: 'Order cancelled successfully',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to cancel order',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      },
      { status: 500 }
    );
  }
}

