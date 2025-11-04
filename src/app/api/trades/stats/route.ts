/**
 * Trade statistics endpoint.
 * 
 * GET /api/trades/stats
 * 
 * Get trade statistics with optional filters:
 * - accountId: Filter by account
 * - startDate: Start date (ISO string)
 * - endDate: End date (ISO string)
 */

import { NextResponse } from 'next/server';
import { tradeHistoryService } from '@/lib/tradeHistoryService';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Build filters from query parameters
    const filters: {
      accountId?: string;
      startDate?: string;
      endDate?: string;
    } = {};
    
    if (searchParams.has('accountId')) {
      filters.accountId = searchParams.get('accountId') || undefined;
    }
    
    if (searchParams.has('startDate')) {
      filters.startDate = searchParams.get('startDate') || undefined;
    }
    
    if (searchParams.has('endDate')) {
      filters.endDate = searchParams.get('endDate') || undefined;
    }
    
    // Get statistics
    const stats = await tradeHistoryService.getStats(filters);
    
    return NextResponse.json({ stats });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to get trade statistics',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage }),
      },
      { status: 500 }
    );
  }
}
