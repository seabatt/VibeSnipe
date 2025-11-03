/**
 * Tastytrade positions debug endpoint.
 * 
 * GET /api/tastytrade/positions/debug
 * 
 * Returns raw API response without transformation for debugging purposes.
 * This helps identify response structure issues.
 */

import { NextResponse } from 'next/server';
import { getClient, getAccount } from '@/lib/tastytrade/client';
import { logger } from '@/lib/logger';

/**
 * GET handler for positions debug.
 * 
 * @returns {Promise<NextResponse>} JSON response with raw API data
 */
export async function GET() {
  try {
    // Get account information
    const account = await getAccount();
    const accountNumber = account.accountNumber;

    if (!accountNumber) {
      return NextResponse.json(
        { 
          error: 'Account number not found',
          message: 'Unable to retrieve account number from Tastytrade',
        },
        { status: 400 }
      );
    }

    // Get authenticated client
    const client = await getClient();

    // Fetch raw positions response
    const balancesAndPositionsService = client.balancesAndPositionsService;
    
    logger.info('Debug: Fetching raw positions response', { accountNumber });
    
    const response = await balancesAndPositionsService.getPositionsList(accountNumber);
    
    // Return raw response without transformation
    return NextResponse.json({
      accountNumber,
      rawResponse: response,
      responseType: typeof response,
      responseKeys: response ? Object.keys(response) : [],
      hasData: response?.data !== undefined,
      dataType: response?.data ? typeof response?.data : 'undefined',
      dataKeys: response?.data ? Object.keys(response?.data) : [],
      dataIsArray: Array.isArray(response?.data),
      dataLength: Array.isArray(response?.data) ? response.data.length : 'not array',
      hasItems: response?.data?.items !== undefined,
      itemsIsArray: Array.isArray(response?.data?.items),
      itemsLength: Array.isArray(response?.data?.items) ? response.data.items.length : 'not array',
      extractionPaths: {
        'data.items': response?.data?.items,
        'data': response?.data,
        'items': response?.items,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Debug: Failed to fetch positions', { 
      error: errorMessage,
      stack: errorStack
    });
    
    return NextResponse.json(
      {
        error: 'Failed to fetch positions',
        message: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    );
  }
}

