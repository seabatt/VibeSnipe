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
    // Tastytrade API returns fields directly on pos using kebab-case
    const transformedPositions = positions.map((pos: any) => {
      // Extract fields directly from pos (kebab-case)
      const symbol = pos.symbol || pos['symbol'] || '';
      const instrumentType = pos['instrument-type'] || pos.instrumentType || '';
      const underlyingSymbol = pos['underlying-symbol'] || pos.underlyingSymbol || symbol;
      const quantity = pos.quantity || 0;
      const quantityDirection = pos['quantity-direction'] || pos.quantityDirection || 'Long';
      const isLong = quantityDirection === 'Long' || quantity > 0;
      
      // Parse prices from strings to numbers
      const averageOpenPriceStr = pos['average-open-price'] || pos.averageOpenPrice || '0';
      const averageOpenPrice = parseFloat(averageOpenPriceStr) || 0;
      
      // Use close-price or average-daily-market-close-price for current price
      const closePriceStr = pos['close-price'] || pos['average-daily-market-close-price'] || pos.closePrice || pos.mark || '0';
      const currentPrice = parseFloat(closePriceStr) || 0;
      
      // For options, extract additional fields
      const optionType = pos['option-type'] || pos.optionType || '';
      const strikePrice = parseFloat(pos['strike-price'] || pos.strikePrice || '0') || 0;
      const expirationDate = pos['expiration-date'] || pos.expirationDate || '';
      
      // Calculate P/L
      // For equity: P/L = (currentPrice - averageOpenPrice) * quantity
      // For options: P/L = (currentPrice - averageOpenPrice) * quantity * multiplier * 100
      const multiplier = pos.multiplier || (instrumentType === 'Equity' ? 1 : 100);
      const pnl = isLong
        ? (currentPrice - averageOpenPrice) * Math.abs(quantity) * multiplier
        : (averageOpenPrice - currentPrice) * Math.abs(quantity) * multiplier;
      
      // Generate ID
      const positionId = pos['instrument-id'] || pos.instrumentId || 
        (instrumentType === 'Equity' 
          ? `${symbol}` 
          : `${underlyingSymbol}-${expirationDate}-${strikePrice}-${optionType}`);
      
      // Handle equity vs options
      const isEquity = instrumentType === 'Equity';
      const isOption = instrumentType === 'Option' || optionType !== '';
      
      // Build legs array
      const legs = [];
      if (isOption) {
        // Option position
        legs.push({
          action: isLong ? 'BUY' : 'SELL',
          right: optionType === 'C' ? 'CALL' : 'PUT',
          strike: strikePrice,
          expiry: expirationDate ? expirationDate.split('T')[0] : '', // Format to YYYY-MM-DD
          quantity: Math.abs(quantity),
          price: currentPrice,
        });
      } else {
        // Equity position - use CALL as default for type compatibility
        legs.push({
          action: isLong ? 'BUY' : 'SELL',
          right: 'CALL', // Use CALL as placeholder for equity (SPOT not in LegRight type)
          strike: 0,
          expiry: '',
          quantity: Math.abs(quantity),
          price: currentPrice,
        });
      }

      return {
        id: positionId,
        underlying: underlyingSymbol || symbol,
        strategy: isOption ? 'Vertical' : 'SPOT', // Will be updated when we group spreads
        legs: legs,
        qty: Math.abs(quantity),
        avgPrice: averageOpenPrice,
        pnl: pnl,
        ruleBundle: {
          takeProfitPct: null, // Not set by default - will be set if actually configured
          stopLossPct: null, // Not set by default - will be set if actually configured
        },
        state: 'FILLED' as const,
        openedAt: pos['created-at'] || pos.createdAt || pos.openedAt || new Date().toISOString(),
        // Store raw position data for spread grouping
        _raw: {
          symbol,
          instrumentType,
          underlyingSymbol,
          optionType,
          strikePrice,
          expirationDate,
          quantity,
          quantityDirection,
        },
      };
    });

    // Group options into spreads
    // Separate equity and options
    const equityPositions = transformedPositions.filter(p => p._raw?.instrumentType === 'Equity');
    const optionPositions = transformedPositions.filter(p => p._raw?.instrumentType === 'Option' || p._raw?.optionType);
    
    // Group options by underlying + expiration
    const optionGroups = new Map<string, typeof optionPositions>();
    optionPositions.forEach(pos => {
      const raw = pos._raw;
      if (!raw) return;
      
      const key = `${raw.underlyingSymbol}-${raw.expirationDate}`;
      if (!optionGroups.has(key)) {
        optionGroups.set(key, []);
      }
      optionGroups.get(key)!.push(pos);
    });
    
    // Identify and group spreads
    const spreadPositions: any[] = [];
    
    optionGroups.forEach((options, key) => {
      if (options.length === 0) return;
      
      // Sort by strike price
      const sortedOptions = [...options].sort((a, b) => {
        const strikeA = a._raw?.strikePrice || 0;
        const strikeB = b._raw?.strikePrice || 0;
        return strikeA - strikeB;
      });
      
      // Group by option type (calls vs puts)
      const calls = sortedOptions.filter(o => o._raw?.optionType === 'C');
      const puts = sortedOptions.filter(o => o._raw?.optionType === 'P');
      
      // Process call spreads
      if (calls.length >= 2) {
        spreadPositions.push(...groupIntoSpreads(calls, 'Call'));
      }
      
      // Process put spreads
      if (puts.length >= 2) {
        spreadPositions.push(...groupIntoSpreads(puts, 'Put'));
      }
      
      // If no spreads found, add individual options
      if (calls.length === 1 && puts.length === 0) {
        spreadPositions.push(calls[0]);
      }
      if (puts.length === 1 && calls.length === 0) {
        spreadPositions.push(puts[0]);
      }
    });
    
    // Combine equity positions with spread positions
    const finalPositions = [...equityPositions, ...spreadPositions];
    
    // Helper function to group options into spreads
    function groupIntoSpreads(options: any[], optionTypeName: string): any[] {
      const spreads: any[] = [];
      const used = new Set<number>();
      
      for (let i = 0; i < options.length; i++) {
        if (used.has(i)) continue;
        
        const option1 = options[i];
        const strike1 = option1._raw?.strikePrice || 0;
        
        // Try to find a matching option for a vertical spread
        for (let j = i + 1; j < options.length; j++) {
          if (used.has(j)) continue;
          
          const option2 = options[j];
          const strike2 = option2._raw?.strikePrice || 0;
          
          // Check if this could be a vertical spread (adjacent or nearby strikes)
          const strikeDiff = Math.abs(strike2 - strike1);
          
          // Vertical spread: 2 options with same expiration, different strikes
          // Check if they're opposite directions (one long, one short)
          const qty1 = option1._raw?.quantity || 0;
          const qty2 = option2._raw?.quantity || 0;
          const dir1 = option1._raw?.quantityDirection || 'Long';
          const dir2 = option2._raw?.quantityDirection || 'Long';
          
          // Check if they form a spread (opposite directions or different quantities)
          const isVerticalSpread = strikeDiff > 0 && 
            (dir1 !== dir2 || (Math.abs(qty1) !== Math.abs(qty2)));
          
          if (isVerticalSpread) {
            // Create vertical spread
            const spreadQty = Math.min(Math.abs(qty1), Math.abs(qty2));
            const combinedPnl = option1.pnl + option2.pnl;
            const combinedAvgPrice = ((option1.avgPrice * Math.abs(qty1)) + (option2.avgPrice * Math.abs(qty2))) / (Math.abs(qty1) + Math.abs(qty2));
            
            const spread: any = {
              id: `${option1._raw?.underlyingSymbol}-${option1._raw?.expirationDate}-${Math.min(strike1, strike2)}/${Math.max(strike1, strike2)}-${optionTypeName}Vertical`,
              underlying: option1.underlying,
              strategy: `${optionTypeName} Vertical`,
              legs: [
                ...option1.legs,
                ...option2.legs,
              ],
              qty: spreadQty,
              avgPrice: combinedAvgPrice,
              pnl: combinedPnl,
              ruleBundle: option1.ruleBundle,
              state: 'FILLED' as const,
              openedAt: option1.openedAt,
              _raw: {
                ...option1._raw,
                spreadType: 'Vertical',
                strikes: [Math.min(strike1, strike2), Math.max(strike1, strike2)],
              },
            };
            
            spreads.push(spread);
            used.add(i);
            used.add(j);
            break;
          }
        }
        
        // If not part of a spread, add as individual option
        if (!used.has(i)) {
          spreads.push(option1);
        }
      }
      
      // Check for butterfly spreads (3 options with specific pattern)
      // Need to check original indices, not unused options
      for (let i = 0; i < options.length - 2; i++) {
        if (used.has(i)) continue;
        for (let j = i + 1; j < options.length - 1; j++) {
          if (used.has(j)) continue;
          for (let k = j + 1; k < options.length; k++) {
            if (used.has(k)) continue;
            
            const opt1 = options[i];
            const opt2 = options[j];
            const opt3 = options[k];
            
            const strikes = [
              opt1._raw?.strikePrice || 0,
              opt2._raw?.strikePrice || 0,
              opt3._raw?.strikePrice || 0,
            ].sort((a, b) => a - b);
            
            // Check if middle strike is average of outer strikes (butterfly pattern)
            // Allow some tolerance for floating point comparison
            const expectedMiddle = (strikes[0] + strikes[2]) / 2;
            const isButterfly = Math.abs(strikes[1] - expectedMiddle) < 0.01;
            
            if (isButterfly) {
              const combinedPnl = opt1.pnl + opt2.pnl + opt3.pnl;
              const combinedQty = Math.min(Math.abs(opt1.qty), Math.abs(opt2.qty), Math.abs(opt3.qty));
              const totalQty = Math.abs(opt1.qty) + Math.abs(opt2.qty) + Math.abs(opt3.qty);
              const combinedAvgPrice = totalQty > 0 
                ? ((opt1.avgPrice * Math.abs(opt1.qty)) + 
                   (opt2.avgPrice * Math.abs(opt2.qty)) + 
                   (opt3.avgPrice * Math.abs(opt3.qty))) / totalQty
                : 0;
              
              const butterfly: any = {
                id: `${opt1._raw?.underlyingSymbol}-${opt1._raw?.expirationDate}-${strikes[0]}/${strikes[1]}/${strikes[2]}-${optionTypeName}Butterfly`,
                underlying: opt1.underlying,
                strategy: `${optionTypeName} Butterfly`,
                legs: [
                  ...opt1.legs,
                  ...opt2.legs,
                  ...opt3.legs,
                ],
                qty: combinedQty,
                avgPrice: combinedAvgPrice,
                pnl: combinedPnl,
                ruleBundle: opt1.ruleBundle,
                state: 'FILLED' as const,
                openedAt: opt1.openedAt,
                _raw: {
                  ...opt1._raw,
                  spreadType: 'Butterfly',
                  strikes: strikes,
                },
              };
              
              spreads.push(butterfly);
              used.add(i);
              used.add(j);
              used.add(k);
              break; // Found butterfly, break out of inner loops
            }
          }
        }
      }
      
      return spreads;
    }

    return NextResponse.json({
      positions: finalPositions.map(p => {
        // Remove _raw from response
        const { _raw, ...position } = p;
        return position;
      }),
      accountNumber,
      count: finalPositions.length,
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

