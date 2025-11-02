/**
 * Tastytrade order replacement endpoint.
 * 
 * POST /api/tastytrade/orders/[id]/replace
 * 
 * Cancels and replaces a working order with a new limit price.
 */

import { NextResponse } from 'next/server';
import { cancelOrder, replaceOrder } from '@/lib/tastytrade/orders';

/**
 * Request body structure for order replacement.
 */
interface ReplaceOrderRequest {
  accountId: string;
  price?: string;
  quantity?: number;
  timeInForce?: 'DAY' | 'GTC' | 'EXT' | 'IOC' | 'FOK';
}

/**
 * POST handler for order replacement.
 * 
 * @param {Request} request - Next.js request object
 * @param {{ params: Promise<{ id: string }> }} context - Route context with dynamic params
 * @returns {Promise<NextResponse>} JSON response with updated order status
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Resolve params
    const { id } = await params;

    // Parse request body
    const body: ReplaceOrderRequest = await request.json();

    if (!body.accountId) {
      return NextResponse.json(
        { error: 'Missing required field: accountId' },
        { status: 400 }
      );
    }

    // Validate price if provided
    if (body.price !== undefined) {
      const priceNum = parseFloat(body.price);
      if (isNaN(priceNum) || priceNum <= 0) {
        return NextResponse.json(
          { error: 'Invalid price. Must be a positive number' },
          { status: 400 }
        );
      }
    }

    // Replace the order
    const updatedOrder = await replaceOrder(id, body.accountId, {
      orderId: id,
      price: body.price,
      quantity: body.quantity,
      timeInForce: body.timeInForce,
    });

    return NextResponse.json({
      orderId: updatedOrder.id,
      status: updatedOrder.status,
      price: updatedOrder.netPrice,
      quantity: updatedOrder.quantity,
      updatedAt: updatedOrder.updatedAt,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to replace order',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      },
      { status: 500 }
    );
  }
}

