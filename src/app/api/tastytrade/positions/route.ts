/**
 * Tastytrade positions endpoint.
 * 
 * GET /api/tastytrade/positions
 * 
 * Fetches live positions for the authenticated account.
 */

import { NextResponse } from 'next/server';
import { getClient, getAccount, resetClient } from '@/lib/tastytrade/client';
import { logger } from '@/lib/logger';

/**
 * GET handler for fetching positions.
 * 
 * @returns {Promise<NextResponse>} JSON response with positions array
 */
export async function GET() {
  try {
    // Validate credentials before attempting authentication
    let config;
    try {
      const { getTastytradeConfig } = await import('@/lib/env');
      config = getTastytradeConfig();
    } catch (configError) {
      const configErrorMessage = configError instanceof Error ? configError.message : 'Unknown error';
      
      logger.error('Failed to load Tastytrade configuration', { 
        error: configErrorMessage 
      });
      
      return NextResponse.json(
        { 
          error: 'Tastytrade credentials not configured',
          message: 'Missing or invalid Tastytrade credentials',
          details: configErrorMessage,
          troubleshooting: [
            'Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
            'Verify the following variables are set:',
            '  - TASTYTRADE_ENV (must be "sandbox" or "prod")',
            '  - TASTYTRADE_CLIENT_SECRET (required)',
            '  - TASTYTRADE_REFRESH_TOKEN (required)',
            '  - TASTYTRADE_CLIENT_ID (optional but recommended)',
            'Ensure values are not empty or whitespace-only',
            'Verify credentials match your Tastytrade OAuth application'
          ]
        },
        { status: 500 }
      );
    }

    // Get account information
    const account = await getAccount();
    const accountNumber = account.accountNumber;

    if (!accountNumber) {
      return NextResponse.json(
        { 
          error: 'Account number not found',
          message: 'Unable to retrieve account number from Tastytrade',
          troubleshooting: [
            'Verify TASTYTRADE_ACCOUNT_NUMBER is set in Vercel (if using specific account)',
            'Check that your Tastytrade account has access enabled',
            'Verify credentials are correct and not expired'
          ]
        },
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
      // Check if getPositionsList accepts additional parameters
      // Some APIs require parameters like include_closed, fields, etc.
      logger.info('Calling getPositionsList', { 
        accountNumber,
        method: 'getPositionsList',
        service: 'balancesAndPositionsService',
        // Log method signature to check available parameters
        methodInfo: typeof balancesAndPositionsService.getPositionsList === 'function' ? 'function exists' : 'method not found'
      });
      
      // Try calling with account number first
      // If it fails or returns empty, we might need additional parameters
      response = await balancesAndPositionsService.getPositionsList(accountNumber);
      
      // If response is empty, log warning about potential missing parameters
      if (!response || (response?.data?.items && response.data.items.length === 0) || (Array.isArray(response?.data) && response.data.length === 0)) {
        logger.warn('Positions response is empty - may need additional parameters', {
          accountNumber,
          responseStructure: response ? Object.keys(response) : [],
          note: 'Consider checking if getPositionsList needs parameters like include_closed, fields, etc.'
        });
      }
      
      // Log raw response structure for debugging
      logger.info('Raw API response received', {
        accountNumber,
        responseType: typeof response,
        responseIsNull: response === null,
        responseIsUndefined: response === undefined,
        responseKeys: response ? Object.keys(response) : [],
        responseStringified: response ? JSON.stringify(response).substring(0, 500) : 'null',
        hasData: response?.data !== undefined,
        dataType: response?.data ? typeof response?.data : 'undefined',
        dataKeys: response?.data ? Object.keys(response?.data) : [],
        dataIsArray: Array.isArray(response?.data),
        dataLength: Array.isArray(response?.data) ? response.data.length : 'not array',
        hasItems: response?.data?.items !== undefined,
        itemsIsArray: Array.isArray(response?.data?.items),
        itemsLength: Array.isArray(response?.data?.items) ? response.data.items.length : 'not array',
      });
      
      // Extract positions from response
      // Response structure can be:
      // 1. Array directly: [...]
      // 2. { data: { items: [...] } }
      // 3. { data: [...] }
      // 4. { items: [...] }
      if (Array.isArray(response)) {
        // Response is an array directly
        positions = response;
      } else {
        // Response is an object, try various extraction paths
        positions = response?.data?.items || response?.data || response?.items || [];
      }
      
      logger.info('Positions extracted from response', {
        accountNumber,
        positionsType: typeof positions,
        positionsIsArray: Array.isArray(positions),
        positionsLength: Array.isArray(positions) ? positions.length : 'not array',
        extractionPath: response?.data?.items ? 'data.items' : response?.data ? 'data' : response?.items ? 'items' : 'none',
      });
      
      logger.info('Positions fetched successfully', { 
        accountNumber, 
        count: positions.length,
        responseStructure: response ? Object.keys(response) : [],
        samplePosition: positions.length > 0 ? Object.keys(positions[0]) : [],
        firstPositionPreview: positions.length > 0 ? JSON.stringify(positions[0]).substring(0, 300) : 'no positions'
      });
    } catch (apiError) {
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
      const isAuthError = errorMessage.includes('401') || errorMessage.includes('status code 401');
      
      logger.error('Error fetching positions from API', { 
        accountNumber,
        error: errorMessage,
        isAuthError,
        stack: apiError instanceof Error ? apiError.stack : undefined
      });
      
      // If it's an authentication error, reset the client to force re-authentication
      if (isAuthError) {
        logger.warn('401 authentication error detected, resetting client cache', {
          accountNumber
        });
        resetClient();
      }
      
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
    
    // Check if it's an authentication error with OAuth2 details
    const isOAuth2Error = errorMessage.includes('OAuth2') || errorMessage.includes('token exchange');
    const isCredentialError = errorMessage.includes('missing') || errorMessage.includes('empty') || errorMessage.includes('invalid');
    const isAuthError = errorMessage.includes('401') || errorMessage.includes('Unauthorized') || isOAuth2Error || isCredentialError;
    
    // Provide more actionable error messages
    let errorResponse: any = {
      error: 'Failed to fetch positions',
    };
    
    if (isAuthError) {
      errorResponse = {
        ...errorResponse,
        message: 'Authentication failed while fetching positions',
        troubleshooting: [
          'Verify TASTYTRADE_CLIENT_SECRET and TASTYTRADE_REFRESH_TOKEN are set in Vercel',
          'Ensure credentials match your Tastytrade OAuth application',
          'Check that TASTYTRADE_ENV is set correctly (sandbox or prod)',
          'Regenerate refresh token if it expired: https://tastytrade.com/api/settings',
          'Review Tastytrade OAuth application settings: https://tastytrade.com/api/settings',
          'Use diagnostic endpoint to test credentials: /api/tastytrade/auth/test'
        ]
      };
      
      // Include detailed error in development
      if (process.env.NODE_ENV === 'development') {
        errorResponse.details = errorMessage;
        if (errorStack) {
          errorResponse.stack = errorStack;
        }
      }
    } else if (process.env.NODE_ENV === 'development') {
      // Include error details in development for other errors
      errorResponse.details = errorMessage;
      if (errorStack) {
        errorResponse.stack = errorStack;
      }
    }
    
    // Return appropriate status code based on error type
    const statusCode = isAuthError ? 401 : 500;
    
    return NextResponse.json(
      errorResponse,
      { status: statusCode }
    );
  }
}

