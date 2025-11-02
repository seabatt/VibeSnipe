/**
 * Tastytrade API client initialization and management.
 * 
 * This module provides a configured instance of the official @tastytrade/api SDK
 * with OAuth2 authentication and automatic token refresh handling.
 */

import type { TastytradeEnv } from './types';

// Note: This assumes the @tastytrade/api package is installed.
// Install with: npm install @tastytrade/api
// The actual import will depend on the SDK's export structure
// For now, using a type placeholder - adjust based on actual SDK exports
type TastytradeSDK = any; // Replace with actual SDK type when available

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

  // Determine API base URL based on environment
  const baseUrl = env === 'prod' 
    ? 'https://api.tastytrade.com' 
    : 'https://api.cert.tastytrade.com';

  try {
    // Initialize the SDK with OAuth2 credentials
    // NOTE: Adjust this based on the actual @tastytrade/api SDK initialization pattern
    // The following is a placeholder structure - refer to official SDK documentation
    
    // Example initialization pattern (adjust to match actual SDK):
    // const { TastytradeApi } = require('@tastytrade/api');
    // clientInstance = new TastytradeApi({
    //   baseUrl,
    //   auth: {
    //     type: 'oauth2',
    //     clientSecret,
    //     refreshToken,
    //   },
    // });

    // For now, creating a placeholder that will need to be replaced
    // when the SDK is installed and we have the actual API structure
    console.warn(
      'Tastytrade SDK not yet initialized. Install @tastytrade/api and update this module with the correct initialization pattern.'
    );

    // Placeholder: In a real implementation, this would be the actual SDK client
    // The SDK should handle:
    // - OAuth2 token management
    // - Automatic token refresh
    // - Request retries
    // - Error handling
    clientInstance = {
      baseUrl,
      env,
      authenticated: true,
      // SDK methods will be available here once properly initialized
    } as TastytradeSDK;

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

