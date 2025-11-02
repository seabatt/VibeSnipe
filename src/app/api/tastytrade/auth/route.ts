/**
 * Tastytrade authentication status endpoint.
 * 
 * GET /api/tastytrade/auth
 * 
 * Returns authentication status and account information without exposing secrets.
 */

import { NextResponse } from 'next/server';
import { getClient, getEnv } from '@/lib/tastytrade';

/**
 * GET handler for authentication status.
 * 
 * @param {Request} request - Next.js request object
 * @returns {Promise<NextResponse>} JSON response with status, env, and account info
 */
export async function GET(request: Request) {
  try {
    // Get environment configuration
    const env = getEnv();

    if (!env) {
      return NextResponse.json(
        { error: 'Tastytrade environment not configured' },
        { status: 500 }
      );
    }

    // Initialize client (this will validate credentials)
    const client = await getClient();

    // Get account information from SDK
    // NOTE: Adjust this based on actual @tastytrade/api SDK API
    // Example:
    // const accounts = await client.accounts.list();
    // const accountInfo = accounts.data[0]; // Or get by ID

    // Placeholder account info - replace with actual SDK call
    const accountInfo = {
      accountNumber: 'DEMO-ACCOUNT',
      accountType: 'MARGIN',
      // Do not include sensitive fields like tokens, secrets, etc.
    };

    return NextResponse.json({
      status: 'ok',
      env,
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

