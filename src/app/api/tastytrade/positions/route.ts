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
    // Using the accountsAndCustomersService to get positions
    // Tasty Trade API pattern: GET /accounts/{account-number}/positions
    const accountsService = client.accountsAndCustomersService;
    
    // Try different method names that might exist in the SDK
    const serviceMethods = Object.keys(accountsService);
    logger.info('Available accountsAndCustomersService methods', { 
      accountNumber,
      methods: serviceMethods.filter(m => typeof (accountsService as any)[m] === 'function')
    });
    
    let response: any;
    let positions: any[] = [];
    
    try {
      // Try getLivePositions first (most common method name)
      if (typeof (accountsService as any).getLivePositions === 'function') {
        logger.info('Trying getLivePositions method');
        response = await (accountsService as any).getLivePositions(accountNumber);
        positions = response?.data?.items || response?.data || response?.items || [];
      } 
      // Try getPositions
      else if (typeof (accountsService as any).getPositions === 'function') {
        logger.info('Trying getPositions method');
        response = await (accountsService as any).getPositions(accountNumber);
        positions = response?.data?.items || response?.data || response?.items || [];
      }
      // Try getAccountPositions
      else if (typeof (accountsService as any).getAccountPositions === 'function') {
        logger.info('Trying getAccountPositions method');
        response = await (accountsService as any).getAccountPositions(accountNumber);
        positions = response?.data?.items || response?.data || response?.items || [];
      }
      // Try getAccountLivePositions
      else if (typeof (accountsService as any).getAccountLivePositions === 'function') {
        logger.info('Trying getAccountLivePositions method');
        response = await (accountsService as any).getAccountLivePositions(accountNumber);
        positions = response?.data?.items || response?.data || response?.items || [];
      }
      // Fallback: Use REST API directly
      else {
        logger.info('SDK methods not found, trying REST API directly');
        const baseUrl = process.env.TASTYTRADE_ENV === 'prod' 
          ? 'https://api.tastytrade.com' 
          : 'https://api.cert.tastytrade.com';
        
        // Get the session token from the client - try different locations
        const sessionToken = (client as any).sessionToken 
          || (client as any).session?.sessionToken
          || (client as any).sessionTokenValue;
        
        if (!sessionToken) {
          logger.error('No session token available');
          throw new Error('No session token available for API call');
        }
        
        const apiUrl = `${baseUrl}/accounts/${accountNumber}/positions`;
        logger.info('Fetching positions via REST API', { apiUrl });
        
        const authResponse = await fetch(apiUrl, {
          headers: {
            'Authorization': `Bearer ${sessionToken}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!authResponse.ok) {
          const errorText = await authResponse.text();
          logger.error('REST API call failed', { 
            status: authResponse.status, 
            statusText: authResponse.statusText,
            error: errorText.substring(0, 500)
          });
          throw new Error(`Failed to fetch positions: ${authResponse.status} ${authResponse.statusText}`);
        }
        
        response = await authResponse.json();
        positions = response?.data?.items || response?.data || response?.items || [];
      }
      
      logger.info('Positions fetched successfully', { 
        accountNumber, 
        count: positions.length,
        responseStructure: response ? Object.keys(response) : []
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
    logger.error('Failed to fetch positions', undefined, error as Error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch positions',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      },
      { status: 500 }
    );
  }
}

