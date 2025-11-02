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
    // Get environment configuration
    const tastytradeEnv = env.TASTYTRADE_ENV;

    if (!tastytradeEnv) {
      return NextResponse.json(
        { error: 'Tastytrade environment not configured' },
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

    return NextResponse.json({
      status: 'ok',
      env: tastytradeEnv,
      accountInfo,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Don't expose sensitive error details
    return NextResponse.json(
      { 
        status: 'error',
        error: 'Authentication check failed',
        // In production, don't expose internal error messages
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      },
      { status: 401 }
    );
  }
}

