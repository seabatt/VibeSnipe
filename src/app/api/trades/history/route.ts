/**
 * Trade history query endpoint.
 * 
 * GET /api/trades/history
 * 
 * Query trade history with optional filters:
 * - accountId: Filter by account
 * - state: Filter by trade state
 * - startDate: Start date (ISO string)
 * - endDate: End date (ISO string)
 * - underlying: Filter by underlying symbol
 * - limit: Limit number of results
 * - offset: Pagination offset
 */

import { NextResponse } from 'next/server';
import { tradeHistoryService, type TradeHistoryFilters } from '@/lib/tradeHistoryService';
import { TradeState } from '@/lib/tradeStateMachine';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Build filters from query parameters
    const filters: TradeHistoryFilters = {};
    
    if (searchParams.has('accountId')) {
      filters.accountId = searchParams.get('accountId') || undefined;
    }
    
    if (searchParams.has('state')) {
      const state = searchParams.get('state') as TradeState;
      if (Object.values(TradeState).includes(state)) {
        filters.state = state;
      }
    }
    
    if (searchParams.has('startDate')) {
      filters.startDate = searchParams.get('startDate') || undefined;
    }
    
    if (searchParams.has('endDate')) {
      filters.endDate = searchParams.get('endDate') || undefined;
    }
    
    if (searchParams.has('underlying')) {
      filters.underlying = searchParams.get('underlying') || undefined;
    }
    
    if (searchParams.has('limit')) {
      const limit = parseInt(searchParams.get('limit') || '0', 10);
      if (limit > 0) {
        filters.limit = limit;
      }
    }
    
    if (searchParams.has('offset')) {
      const offset = parseInt(searchParams.get('offset') || '0', 10);
      if (offset >= 0) {
        filters.offset = offset;
      }
    }
    
    // Query history
    const trades = await tradeHistoryService.queryHistory(filters);
    
    return NextResponse.json({
      trades,
      count: trades.length,
      filters,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to query trade history',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage }),
      },
      { status: 500 }
    );
  }
}
