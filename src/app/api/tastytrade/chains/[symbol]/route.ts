/**
 * Tastytrade option chain fetching endpoint.
 * 
 * GET /api/tastytrade/chains/[symbol]?exp=YYYY-MM-DD
 * 
 * Fetches option chain for a given symbol and expiration date.
 */

import { NextResponse } from 'next/server';
import { fetchOptionChain } from '@/lib/tastytrade/chains';

/**
 * GET handler for option chain.
 * 
 * @param {Request} request - Next.js request object
 * @param {{ params: Promise<{ symbol: string }> }} context - Route context with dynamic params
 * @returns {Promise<NextResponse>} JSON response with option chain
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    // Resolve params (Next.js 15+ uses async params)
    const { symbol } = await params;

    // Get expiration from query string
    const { searchParams } = new URL(request.url);
    const exp = searchParams.get('exp');

    if (!exp) {
      return NextResponse.json(
        { error: 'Expiration parameter (exp) is required in format YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Validate expiration format
    const expirationDate = new Date(exp);
    if (isNaN(expirationDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid expiration format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // Fetch option chain
    const chain = await fetchOptionChain(symbol.toUpperCase(), exp);

    return NextResponse.json({
      symbol: symbol.toUpperCase(),
      expiration: exp,
      contracts: chain,
      count: chain.length,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch option chain',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage })
      },
      { status: 500 }
    );
  }
}

