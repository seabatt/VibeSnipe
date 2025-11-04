/**
 * Today's trades endpoint.
 * 
 * GET /api/trades/today
 * 
 * Get all trades created today.
 * Optional query param: accountId - Filter by account
 */

import { NextResponse } from 'next/server';
import { tradeHistoryService } from '@/lib/tradeHistoryService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    const accountId = searchParams.get('accountId') || undefined;
    
    // Get today's trades
    const trades = await tradeHistoryService.getTradesToday(accountId);
    
    return NextResponse.json({
      trades,
      count: trades.length,
      date: new Date().toISOString().split('T')[0],
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to get today\'s trades',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage }),
      },
      { status: 500 }
    );
  }
}
