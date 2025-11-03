/**
 * Tastytrade positions endpoint.
 * 
 * GET /api/tastytrade/positions
 * 
 * Fetches live positions for the authenticated account.
 */

import { NextResponse } from 'next/server';
import { getClient, getAccount } from '@/lib/tastytrade/client';
import { logger } from '@/lib/logger';

/**
 * GET handler for fetching positions.
 * 
 * @returns {Promise<NextResponse>} JSON response with positions array
 */
export async function GET() {
  try {
    // Get account information
    const account = await getAccount();
    const accountNumber = account.accountNumber;

    if (!accountNumber) {
      return NextResponse.json(
        { error: 'Account number not found' },
        { status: 400 }
      );
    }

    // Get authenticated client
    const client = await getClient();

    // Fetch live positions for the account
    // Use balancesAndPositionsService.getPositionsList() - this is the correct SDK method
    const balancesAndPositionsService = client.balancesAndPositionsService;
    
    logger.info('Fetching positions', { accountNumber });
    
    let response: any;
    let positions: any[] = [];
    
    try {
      // Use the correct SDK method: getPositionsList
      response = await balancesAndPositionsService.getPositionsList(accountNumber);
      
      // Extract positions from response
      // Response structure: { data: { items: [...] } } or { data: [...] }
      positions = response?.data?.items || response?.data || response?.items || [];
      
      logger.info('Positions fetched successfully', { 
        accountNumber, 
        count: positions.length,
        responseStructure: response ? Object.keys(response) : [],
        samplePosition: positions.length > 0 ? Object.keys(positions[0]) : []
      });
    } catch (apiError) {
      logger.error('Error fetching positions from API', { 
        accountNumber,
        error: apiError instanceof Error ? apiError.message : 'Unknown error',
        stack: apiError instanceof Error ? apiError.stack : undefined
      });
      throw apiError;
    }

    // Transform Tasty Trade positions to our Position format
    const transformedPositions = positions.map((pos: any) => {
      // Extract instrument details
      const instrument = pos.instrument || {};
      const symbol = instrument.symbol || '';
      const optionType = instrument.optionType || '';
      const strikePrice = instrument.strikePrice || 0;
      const expirationDate = instrument.expirationDate || '';
      
      // Calculate P/L
      const averageOpenPrice = pos.averageOpenPrice || 0;
      const currentMark = pos.mark || 0;
      const quantity = pos.quantity || 0;
      
      // P/L calculation depends on whether it's a long or short position
      // For simplicity, we'll use mark price vs average open price
      const pnl = quantity > 0 
        ? (currentMark - averageOpenPrice) * quantity * 100
        : (averageOpenPrice - currentMark) * Math.abs(quantity) * 100;

      return {
        id: pos['instrument-id'] || pos.instrumentId || `${symbol}-${expirationDate}-${strikePrice}`,
        underlying: symbol.split(' ')[0] as any, // Extract underlying from symbol
        strategy: optionType ? 'Vertical' : 'SPOT', // Simplified - could be more sophisticated
        legs: [{
          action: quantity > 0 ? 'BUY' : 'SELL',
          right: optionType === 'C' ? 'CALL' : 'PUT',
          strike: strikePrice,
          expiry: expirationDate.split('T')[0], // Format to YYYY-MM-DD
          quantity: Math.abs(quantity),
          price: currentMark,
        }],
        qty: Math.abs(quantity),
        avgPrice: averageOpenPrice,
        pnl: pnl,
        ruleBundle: {
          takeProfitPct: 50, // Default
          stopLossPct: 100, // Default
        },
        state: 'FILLED' as const,
        openedAt: pos.openedAt || new Date().toISOString(),
      };
    });

    return NextResponse.json({
      positions: transformedPositions,
      accountNumber,
      count: transformedPositions.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to fetch positions', { 
      error: errorMessage,
      stack: errorStack
    }, error as Error);
    
    // Return detailed error in development, generic in production
    return NextResponse.json(
      { 
        error: 'Failed to fetch positions',
        ...(process.env.NODE_ENV === 'development' && { 
          details: errorMessage,
          stack: errorStack
        })
      },
      { status: 500 }
    );
  }
}

