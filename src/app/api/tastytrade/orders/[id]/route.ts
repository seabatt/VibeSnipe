/**
 * Tastytrade order status and cancellation endpoint.
 * 
 * GET /api/tastytrade/orders/[id] - Fetch order status
 * DELETE /api/tastytrade/orders/[id] - Cancel working order
 */

import { NextResponse } from 'next/server';
import { cancelOrder } from '@/lib/tastytrade';
import { getClient } from '@/lib/tastytrade';

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

    const client = await getClient();

    // Fetch order from SDK
    // NOTE: Adjust this based on actual @tastytrade/api SDK API
    // Example:
    // const order = await client.orders.get(accountId, id);
    // return NextResponse.json(order);

    console.warn('Order status fetching not yet implemented. Would fetch:', id);

    // Placeholder: Return mock order status
    // In actual implementation, this would call the SDK to get the order
    return NextResponse.json({
      id,
      status: 'WORKING',
      accountId: accountId || 'UNKNOWN',
      // Add other order fields from SDK response
    });
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

