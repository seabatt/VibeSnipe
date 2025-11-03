/**
 * Tastytrade authentication status endpoint.
 * 
 * GET /api/tastytrade/auth
 * 
 * Returns authentication status and account information without exposing secrets.
 */

import { NextResponse } from 'next/server';
import { getAccount } from '@/lib/tastytrade/client';
import { env } from '@/lib/env';

/**
 * GET handler for authentication status.
 * 
 * @returns {Promise<NextResponse>} JSON response with status, env, and account info
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
      
      // Return detailed error for credential validation issues
      return NextResponse.json(
        { 
          status: 'error',
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

    // Get environment configuration
    const tastytradeEnv = env.TASTYTRADE_ENV;

    if (!tastytradeEnv) {
      return NextResponse.json(
        { 
          error: 'Tastytrade environment not configured',
          message: 'TASTYTRADE_ENV is missing or invalid',
          troubleshooting: [
            'Set TASTYTRADE_ENV to either "sandbox" or "prod" in Vercel environment variables'
          ]
        },
        { status: 500 }
      );
    }

    // Get account information using getAccount() utility
    // This will initialize the client internally to validate credentials
    const account = await getAccount();
    
    const accountInfo = {
      accountNumber: account.accountNumber,
      accountType: account.accountType || 'MARGIN',
      // Do not include sensitive fields like tokens, secrets, etc.
    };

    // Return format compatible with CreateTradeV3.tsx
    return NextResponse.json({
      accountNumber: account.accountNumber,
      accountType: account.accountType,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Check if it's an authentication error with OAuth2 details
    const isOAuth2Error = errorMessage.includes('OAuth2') || errorMessage.includes('token exchange');
    const isCredentialError = errorMessage.includes('missing') || errorMessage.includes('empty') || errorMessage.includes('invalid');
    
    // Provide more actionable error messages
    let errorResponse: any = {
      status: 'error',
      error: 'Authentication check failed',
    };
    
    if (isOAuth2Error || isCredentialError) {
      errorResponse = {
        ...errorResponse,
        message: 'OAuth2 authentication failed',
        troubleshooting: [
          'Verify TASTYTRADE_CLIENT_SECRET and TASTYTRADE_REFRESH_TOKEN are set in Vercel',
          'Ensure credentials match your Tastytrade OAuth application',
          'Check that TASTYTRADE_ENV is set correctly (sandbox or prod)',
          'Regenerate refresh token if it expired: https://tastytrade.com/api/settings',
          'Review Tastytrade OAuth application settings: https://tastytrade.com/api/settings'
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
    
    return NextResponse.json(
      errorResponse,
      { status: 401 }
    );
  }
}

