/**
 * Tastytrade API client initialization and management.
 * 
 * This module provides a configured instance of the official @tastytrade/api SDK
 * with OAuth2 authentication and automatic token refresh handling.
 */

import TastytradeClient from '@tastytrade/api';
import type { TastytradeEnv } from './types';
import { logger } from '../logger';
import { AuthenticationError } from '../errors';
import { getTastytradeConfig } from '../env';

/**
 * Type alias for the Tastytrade SDK client instance.
 */
type TastytradeSDK = InstanceType<typeof TastytradeClient>;

/**
 * Client instance cache to avoid re-initialization.
 */
let clientInstance: TastytradeSDK | null = null;

/**
 * Exchanges a refresh token for an access token using OAuth2.
 * 
 * @param refreshToken - OAuth2 refresh token
 * @param clientSecret - OAuth2 client secret
 * @param env - Environment ('prod' or 'sandbox')
 * @returns Promise<string> - Access token
 */
async function exchangeRefreshToken(
  refreshToken: string,
  clientSecret: string,
  env: 'prod' | 'sandbox'
): Promise<string> {
  const baseUrl = env === 'prod' 
    ? 'https://api.tastytrade.com' 
    : 'https://api.cert.tastytrade.com';
  
  // OAuth2 token exchange endpoint
  // According to Tastytrade API docs, refresh token flow requires:
  // - grant_type: 'refresh_token'
  // - refresh_token: the refresh token
  // - client_secret: the client secret
  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth2 token exchange failed: ${response.status} ${response.statusText} - ${errorText}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Gets or initializes an authenticated Tastytrade SDK client.
 * 
 * Supports OAuth2 (preferred) or username/password (legacy) authentication.
 * 
 * OAuth2 credentials (environment variables):
 * - TASTYTRADE_ENV: 'prod' or 'sandbox'
 * - TASTYTRADE_CLIENT_SECRET: OAuth2 client secret
 * - TASTYTRADE_REFRESH_TOKEN: OAuth2 refresh token
 * 
 * Legacy username/password credentials:
 * - TASTYTRADE_ENV: 'prod' or 'sandbox'
 * - TASTYTRADE_USERNAME: Tastytrade username
 * - TASTYTRADE_PASSWORD: Tastytrade password
 * 
 * @returns {Promise<TastytradeSDK>} Authenticated SDK client instance
 * @throws {Error} If required environment variables are missing or client initialization fails
 * 
 * @example
 * ```ts
 * const client = await getClient();
 * const accounts = await client.accountsAndCustomersService.getCustomerAccounts();
 * ```
 */
export async function getClient(): Promise<TastytradeSDK> {
  // Return cached instance if available and still valid
  if (clientInstance) {
    return clientInstance;
  }

  // Validate required environment variables
  const config = getTastytradeConfig();

  try {
    // Determine base URLs based on environment
    const baseUrl = config.env === 'prod' 
      ? 'https://api.tastytrade.com' 
      : 'https://api.cert.tastytrade.com';
    
    const accountStreamerUrl = config.env === 'prod'
      ? 'wss://streamer.tastytrade.com'
      : 'wss://streamer.cert.tastytrade.com';

    // Initialize client with base URL and account streamer URL
    clientInstance = new TastytradeClient(baseUrl, accountStreamerUrl);

    // Authenticate based on method
    if (config.authMethod === 'oauth2') {
      // OAuth2 authentication: exchange refresh token for access token
      const accessToken = await exchangeRefreshToken(
        config.refreshToken,
        config.clientSecret,
        config.env
      );
      
      // Set the access token in the session
      // Note: The HTTP client uses authToken directly in Authorization header
      // Tastytrade OAuth2 requires "Bearer" prefix for access tokens
      clientInstance.session.authToken = `Bearer ${accessToken}`;
      
      logger.info('Tastytrade client initialized and authenticated via OAuth2', { 
        env: config.env 
      });
    } else {
      // Legacy username/password authentication
      await clientInstance.sessionService.login(config.username, config.password);
      
      logger.info('Tastytrade client initialized and authenticated via username/password', { 
        env: config.env 
      });
    }

    return clientInstance;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to initialize Tastytrade client', { env: config.env }, error as Error);
    throw new AuthenticationError(`Failed to initialize Tastytrade client: ${errorMessage}`);
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
    const config = getTastytradeConfig();
    
    // If TASTYTRADE_ACCOUNT_NUMBER is set, use it directly
    if (config.accountNumber) {
      logger.info('Using configured account number', { accountNumber: config.accountNumber });
      return {
        accountNumber: config.accountNumber,
        accountType: 'configured',
      };
    }
    
    // Otherwise, fetch accounts via SDK and use first one
    const client = await getClient();
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
    
    logger.info('Account fetched', { accountNumber });
    return {
      accountNumber,
      accountType: account['account-type'] || account.accountType || account.account_type,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Failed to get account', undefined, error as Error);
    throw new AuthenticationError(`Failed to get account: ${errorMessage}`);
  }
}

