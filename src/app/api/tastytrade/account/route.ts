/**
 * Tastytrade account info endpoint.
 * 
 * GET /api/tastytrade/account
 * 
 * Fetches account number and status from Tastytrade.
 */

import { NextResponse } from 'next/server';
import { getAccount, getClient } from '@/lib/tastytrade/client';
import { logger } from '@/lib/logger';

export async function GET() {
  try {
    // Get account number
    const account = await getAccount();
    const accountNumber = account.accountNumber;
    
    // Check account status by fetching account balances/positions
    // If we can fetch successfully, account is active
    let isActive = false;
    try {
      const client = await getClient();
      const balancesAndPositionsService = client.balancesAndPositionsService;
      await balancesAndPositionsService.getAccountBalanceValues(accountNumber);
      isActive = true;
    } catch (error) {
      // Account fetch failed - not active
      isActive = false;
      logger.warn('Failed to fetch account balances - account may be inactive', { accountNumber });
    }
    
    return NextResponse.json({
      accountNumber,
      isActive,
      accountType: account.accountType,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch account info', undefined, error as Error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch account info',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}
