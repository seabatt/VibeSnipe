/**
 * Tastytrade order submission endpoint.
 * 
 * POST /api/tastytrade/orders
 * 
 * Submits a vertical spread order based on kind, spec, and entry parameters.
 * Now uses the orchestrator for full trade lifecycle management.
 */

import { NextResponse } from 'next/server';
import { executeTradeLifecycle } from '@/lib/tradeOrchestrator';
import { buildTradeIntent, verticalLegsToTradeLegs } from '@/lib/tradeIntent';
import { fetchAndBuildVertical } from '@/lib/tastytrade/chains';
import type { VerticalSpec } from '@/lib/tastytrade/types';
import { isTastytradeConfigured } from '@/lib/env';

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
    // Check credentials configured
    if (!isTastytradeConfigured()) {
      return NextResponse.json(
        { error: 'TastyTrade not configured. Set TASTYTRADE_USERNAME and TASTYTRADE_PASSWORD in .env.local' },
        { status: 503 }
      );
    }
    
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

    // Convert vertical legs to trade legs format
    const legs = verticalLegsToTradeLegs(vertical, spec.quantity);

    // Build trade intent from request
    const intent = buildTradeIntent({
      legs,
      quantity: spec.quantity,
      limitPrice,
      orderType,
      ruleBundle: {
        takeProfitPct: 50, // Default values
        stopLossPct: 100,
      },
      accountId: entry.accountId,
      source: 'manual',
    });

    // Execute trade lifecycle via orchestrator
    const result = await executeTradeLifecycle(
      intent,
      vertical,
      {
        enableChase: true,
        attachBrackets: true,
      }
    );

    // Return result based on state machine outcome
    if (result.success) {
    return NextResponse.json({
        tradeId: result.trade.id,
        orderId: result.order?.id,
        status: result.trade.state,
        accountId: entry.accountId,
        quantity: spec.quantity,
        netPrice: result.order?.netPrice,
        brackets: result.brackets,
    });
    } else {
      return NextResponse.json(
        {
          tradeId: result.trade.id,
          status: result.trade.state,
          error: result.error,
        },
        { status: 500 }
      );
    }
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

