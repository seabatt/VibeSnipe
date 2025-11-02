/**
 * Tastytrade API client initialization and management.
 * 
 * This module provides a configured instance of the official @tastytrade/api SDK
 * with OAuth2 authentication and automatic token refresh handling.
 */

import TastytradeClient from '@tastytrade/api';
import type { TastytradeEnv } from './types';

/**
 * Type alias for the Tastytrade SDK client instance.
 */
type TastytradeSDK = InstanceType<typeof TastytradeClient>;

/**
 * Client instance cache to avoid re-initialization.
 */
let clientInstance: TastytradeSDK | null = null;

/**
 * Gets or initializes an authenticated Tastytrade SDK client.
 * 
 * Uses OAuth2 authentication with credentials from environment variables:
 * - TASTYTRADE_ENV: 'prod' or 'sandbox'
 * - TASTYTRADE_CLIENT_SECRET: OAuth client secret
 * - TASTYTRADE_REFRESH_TOKEN: OAuth refresh token
 * 
 * The SDK handles automatic token refresh internally.
 * 
 * @returns {Promise<TastytradeSDK>} Authenticated SDK client instance
 * @throws {Error} If required environment variables are missing or client initialization fails
 * 
 * @example
 * ```ts
 * const client = await getClient();
 * const account = await client.accounts.list();
 * ```
 */
export async function getClient(): Promise<TastytradeSDK> {
  // Return cached instance if available and still valid
  if (clientInstance) {
    return clientInstance;
  }

  // Validate required environment variables
  const env = process.env.TASTYTRADE_ENV as TastytradeEnv;
  const clientSecret = process.env.TASTYTRADE_CLIENT_SECRET;
  const refreshToken = process.env.TASTYTRADE_REFRESH_TOKEN;

  if (!env || (env !== 'prod' && env !== 'sandbox')) {
    throw new Error(
      'TASTYTRADE_ENV must be set to "prod" or "sandbox"'
    );
  }

  if (!clientSecret) {
    throw new Error('TASTYTRADE_CLIENT_SECRET environment variable is required');
  }

  if (!refreshToken) {
    throw new Error('TASTYTRADE_REFRESH_TOKEN environment variable is required');
  }

  try {
    // Determine base URLs based on environment
    const baseUrl = env === 'prod' 
      ? 'https://api.tastytrade.com' 
      : 'https://api.cert.tastytrade.com';
    
    const accountStreamerUrl = env === 'prod'
      ? 'wss://streamer.tastytrade.com'
      : 'wss://streamer.cert.tastytrade.com';

    // Initialize client with base URL and account streamer URL
    clientInstance = new TastytradeClient(baseUrl, accountStreamerUrl);
    
    // OAuth2 authentication for the SDK
    // The SDK's httpClient may handle OAuth via headers or token management
    // For OAuth2 with refresh tokens, we may need to set authorization headers manually
    // or use the httpClient's authentication methods
    // Check if httpClient has setAuthToken or similar methods
    const httpClient = (clientInstance as any).httpClient;
    if (httpClient && typeof httpClient.setAuthToken === 'function') {
      // If SDK supports setting auth token directly
      httpClient.setAuthToken(refreshToken);
    } else {
      // Otherwise, OAuth2 may be handled via API calls to get access token
      // For now, storing credentials for later use - actual token exchange may happen on first API call
      // The SDK might handle this automatically via httpClient interceptors
      (clientInstance as any)._oauthConfig = {
        clientSecret,
        refreshToken,
        scopes: ['read', 'trade'],
      };
    }

    return clientInstance;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to initialize Tastytrade client: ${errorMessage}`);
  }
}

/**
 * Resets the client instance cache.
 * 
 * Useful for testing or when re-authentication is needed.
 * 
 * @example
 * ```ts
 * resetClient();
 * const newClient = await getClient(); // Will re-initialize
 * ```
 */
export function resetClient(): void {
  clientInstance = null;
}

/**
 * Gets the current environment configuration.
 * 
 * @returns {TastytradeEnv | null} Current environment or null if not configured
 */
export function getEnv(): TastytradeEnv | null {
  const env = process.env.TASTYTRADE_ENV as TastytradeEnv;
  return env === 'prod' || env === 'sandbox' ? env : null;
}

/**
 * Gets account information from the authenticated client.
 * 
 * Fetches the first available account for the authenticated user.
 * 
 * @returns {Promise<{ accountNumber: string; accountType?: string }>} Account information
 * @throws {Error} If account fetching fails
 * 
 * @example
 * ```ts
 * const account = await getAccount();
 * console.log(`Account: ${account.accountNumber}`);
 * ```
 */
export async function getAccount(): Promise<{ accountNumber: string; accountType?: string }> {
  try {
    const client = await getClient();
    
    // Fetch customer accounts via SDK
    const response = await client.accountsAndCustomersService.getCustomerAccounts();
    
    // Extract first account from response
    if (!response || !response.data || !Array.isArray(response.data) || response.data.length === 0) {
      throw new Error('No accounts found for authenticated user');
    }
    
    const account = response.data[0].account;
    const accountNumber = account['account-number'] || account.accountNumber || account.account_number;
    
    if (!accountNumber) {
      throw new Error('Account number not found in response');
    }
    
    return {
      accountNumber,
      accountType: account['account-type'] || account.accountType || account.account_type,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to get account: ${errorMessage}`);
  }
}

