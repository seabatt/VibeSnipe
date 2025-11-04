/**
 * Get specific trade endpoint.
 * 
 * GET /api/trades/[id]
 * 
 * Retrieves a single trade by its ID.
 */

import { NextResponse } from 'next/server';
import { tradeHistoryService } from '@/lib/tradeHistoryService';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const tradeId = params.id;
    
    if (!tradeId) {
      return NextResponse.json(
        { error: 'Trade ID is required' },
        { status: 400 }
      );
    }
    
    const trade = await tradeHistoryService.getTrade(tradeId);
    
    if (!trade) {
      return NextResponse.json(
        { error: 'Trade not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({ trade });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      {
        error: 'Failed to get trade',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage }),
      },
      { status: 500 }
    );
  }
}
