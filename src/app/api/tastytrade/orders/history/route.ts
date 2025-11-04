/**
 * Tastytrade historical orders endpoint.
 * 
 * GET /api/tastytrade/orders/history?startDate=2025-11-01
 * 
 * Fetches historical transactions from Tastytrade and converts them to trade history format.
 */

import { NextResponse } from 'next/server';
import { getClient, getAccount } from '@/lib/tastytrade/client';
import { logger } from '@/lib/logger';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') || '2025-11-01';
    
    const account = await getAccount();
    const accountNumber = account.accountNumber;
    const client = await getClient();
    
    // Fetch transactions using transactionsService
    let transactions: any[] = [];
    
    try {
      const transactionsService = client.transactionsService;
      
      if (typeof transactionsService.getAccountTransactions === 'function') {
        const response = await transactionsService.getAccountTransactions(accountNumber);
        
        // Handle different response formats
        transactions = response?.data?.items || response?.data || response || [];
        
        // Filter transactions by date if startDate is provided
        if (startDate && transactions.length > 0) {
          const startDateObj = new Date(startDate);
          transactions = transactions.filter((tx: any) => {
            const txDate = new Date(tx['transaction-date'] || tx.transactionDate || tx.date || tx.createdAt || tx['executed-at']);
            return txDate >= startDateObj;
          });
        }
        
        // Filter for trade-related transactions only
        transactions = transactions.filter((tx: any) => {
          const type = tx['transaction-type'] || tx.transactionType || tx.type || '';
          const subType = tx['transaction-sub-type'] || tx.transactionSubType || tx.subType || '';
          
          // Include trade-related transactions
          return type === 'Trade' || 
                 type === 'Fill' || 
                 subType === 'Fill' ||
                 subType === 'Trade' ||
                 type.toLowerCase().includes('trade') ||
                 subType.toLowerCase().includes('trade') ||
                 subType.toLowerCase().includes('fill');
        });
        
        logger.info('Fetched transactions successfully', {
          accountNumber,
          totalTransactions: transactions.length,
          startDate,
        });
      } else {
        logger.warn('transactionsService.getAccountTransactions is not available', {
          accountNumber,
          availableMethods: Object.keys(transactionsService || {}),
        });
      }
    } catch (apiError) {
      logger.error('Failed to fetch historical transactions', { 
        accountNumber, 
        startDate,
        error: apiError instanceof Error ? apiError.message : 'Unknown error'
      });
      throw apiError;
    }
    
    // Transform transactions to trade history format
    const tradeHistory = transactions.map((tx: any) => {
      // Extract transaction details
      const transactionId = tx.id || tx['transaction-id'] || tx.transactionId || `tx-${Date.now()}-${Math.random()}`;
      const transactionDate = tx['transaction-date'] || tx.transactionDate || tx.date || tx.createdAt || tx['executed-at'];
      const description = tx.description || '';
      
      // Extract price/amount information
      // Note: price-effect might be 'Credit' or 'Debit'
      const priceEffect = tx['price-effect'] || tx.priceEffect || '';
      const netPrice = parseFloat(tx['net-price'] || tx.netPrice || tx.price || tx.amount || tx['net-amount'] || '0');
      const quantity = parseFloat(tx.quantity || tx['transaction-quantity'] || tx['order-quantity'] || '0');
      
      // Extract legs (from order structure if available)
      let legs: any[] = [];
      if (tx.legs && Array.isArray(tx.legs) && tx.legs.length > 0) {
        legs = tx.legs.map((leg: any) => ({
          symbol: leg.symbol || leg['instrument-symbol'] || '',
          action: leg.action || leg['action-type'] || '',
          quantity: leg.quantity || Math.abs(quantity),
          price: parseFloat(leg.price || leg['fill-price'] || leg['avg-fill-price'] || '0'),
          strike: parseFloat(leg['strike-price'] || leg.strikePrice || '0'),
          right: leg['option-type'] || leg.optionType || leg.right || '',
          expiry: leg['expiration-date'] || leg.expirationDate || leg.expiry || '',
        }));
      }
      
      // Extract profit/loss if available
      const profitLoss = parseFloat(tx['realized-pnl'] || tx.realizedPnl || tx['profit-loss'] || tx.profitLoss || '0');
      
      // Determine entry credit based on price-effect
      // For credit spreads, price-effect is 'Credit', entry credit is positive
      // For debit spreads, price-effect is 'Debit', entry credit is negative
      const entryCredit = priceEffect === 'Credit' ? Math.abs(netPrice) : -Math.abs(netPrice);
      
      return {
        tradeId: transactionId, // TradeHistoryRecord expects tradeId, not id
        createdAt: transactionDate,
        updatedAt: transactionDate,
        stateHistory: [], // Required field - empty array for transactions
        currentState: 'CLOSED' as const, // Transactions are historical, so they're closed
        accountId: accountNumber,
        orderIds: [transactionId],
        legs: legs.map(leg => ({
          symbol: leg.symbol,
          instrumentType: leg.right ? 'Option' : 'Equity',
          quantity: leg.quantity,
          action: leg.action,
          price: leg.price,
        })),
        quantity: Math.abs(quantity),
        entryCredit,
        exitCredit: 0, // Will be updated when position is closed
        profitLoss,
        strategy: {
          name: determineStrategy(legs), // Strategy must be an object with name property
          source: 'tastytrade',
        },
        metadata: {
          description,
          transactionType: tx['transaction-type'] || tx.transactionType,
          transactionSubType: tx['transaction-sub-type'] || tx.transactionSubType,
          priceEffect,
          source: 'tastytrade', // Mark as from TastyTrade
        },
      };
    });
    
    return NextResponse.json({
      trades: tradeHistory,
      count: tradeHistory.length,
      startDate,
      accountNumber,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to fetch historical transactions', undefined, error as Error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch historical transactions',
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

// Helper to determine strategy from legs
function determineStrategy(legs: any[]): string {
  if (legs.length === 0) return 'Unknown';
  if (legs.length === 1) return 'Single';
  if (legs.length === 2) return 'Vertical';
  if (legs.length === 3) return 'Butterfly';
  if (legs.length === 4) return 'Iron Condor';
  return 'Multi-Leg';
}
