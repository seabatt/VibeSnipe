/**
 * Tastytrade order submission endpoint.
 * 
 * POST /api/tastytrade/orders
 * 
 * Submits a vertical spread order based on kind, spec, and entry parameters.
 */

import { NextResponse } from 'next/server';
import { submitVertical, fetchAndBuildVertical } from '@/lib/tastytrade';
import type { VerticalLegs, EntryConfig, VerticalSpec } from '@/lib/tastytrade';

/**
 * Request body structure for order submission.
 */
interface OrderRequest {
  kind: string;
  spec: {
    underlying: string;
    expiration: string;
    targetDelta: number;
    right: 'CALL' | 'PUT';
    width: number;
    quantity: number;
  };
  entry: {
    maxPrice?: number;
    minPrice?: number;
    orderType?: 'LIMIT' | 'MARKET';
    limitPrice?: number;
    accountId: string;
  };
}

/**
 * POST handler for order submission.
 * 
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with order ID and status
 */
export async function POST(request: Request) {
  try {
    // Parse request body
    const body: OrderRequest = await request.json();

    // Validate required fields
    if (!body.spec) {
      return NextResponse.json(
        { error: 'Missing required field: spec' },
        { status: 400 }
      );
    }

    if (!body.entry) {
      return NextResponse.json(
        { error: 'Missing required field: entry' },
        { status: 400 }
      );
    }

    if (!body.entry.accountId) {
      return NextResponse.json(
        { error: 'Missing required field: entry.accountId' },
        { status: 400 }
      );
    }

    // Extract spec and entry parameters
    const { spec, entry } = body;

    // Build the vertical specification
    const verticalSpec: VerticalSpec = {
      underlying: spec.underlying,
      expiration: spec.expiration,
      targetDelta: spec.targetDelta,
      right: spec.right,
      width: spec.width,
      quantity: spec.quantity,
    };

    // Fetch option chain and build vertical from spec
    const vertical = await fetchAndBuildVertical(verticalSpec);

    if (!vertical) {
      return NextResponse.json(
        { error: 'Failed to build vertical spread from spec. Check that valid contracts exist for the given delta and width.' },
        { status: 400 }
      );
    }

    // Determine limit price
    const limitPrice = entry.limitPrice || entry.maxPrice;
    const orderType = entry.orderType || (limitPrice ? 'LIMIT' : 'MARKET');

    // Submit the order
    const order = await submitVertical(
      vertical,
      spec.quantity,
      limitPrice,
      orderType,
      entry.accountId
    );

    return NextResponse.json({
      orderId: order.id,
      status: order.status,
      accountId: order.accountId,
      quantity: order.quantity,
      netPrice: order.netPrice,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to submit order',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      },
      { status: 500 }
    );
  }
}

