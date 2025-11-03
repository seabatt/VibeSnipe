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
  clientId: string | undefined,
  env: 'prod' | 'sandbox'
): Promise<string> {
  // Validate credentials before attempting token exchange
  const validateCredential = (name: string, value: string | undefined | null): void => {
    if (!value || typeof value !== 'string' || value.trim().length === 0) {
      const error = new Error(`Invalid ${name}: value is empty, null, or whitespace only`);
      logger.error(`Credential validation failed: ${name}`, {
        error: error.message,
        valueLength: value?.length || 0,
        isEmpty: !value,
        isWhitespaceOnly: value ? value.trim().length === 0 : false
      });
      throw error;
    }
  };

  // Validate required credentials
  validateCredential('refreshToken', refreshToken);
  validateCredential('clientSecret', clientSecret);
  
  // Validate optional clientId if provided
  if (clientId !== undefined && clientId !== null) {
    validateCredential('clientId', clientId);
  }

  // Validate env
  if (env !== 'prod' && env !== 'sandbox') {
    const error = new Error(`Invalid env: must be 'prod' or 'sandbox', got '${env}'`);
    logger.error('Credential validation failed: env', { error: error.message, env });
    throw error;
  }

  logger.info('Entering exchangeRefreshToken function', {
    env,
    hasClientId: !!clientId,
    hasRefreshToken: !!refreshToken,
    hasClientSecret: !!clientSecret,
    clientIdLength: clientId?.length || 0,
    clientSecretLength: clientSecret?.length || 0,
    refreshTokenLength: refreshToken?.length || 0,
    refreshTokenPrefix: refreshToken?.substring(0, 10) || 'none' // First 10 chars for debugging
  });
  
  const baseUrl = env === 'prod' 
    ? 'https://api.tastytrade.com' 
    : 'https://api.cert.tastytrade.com';
  
  // OAuth2 token exchange endpoint
  // Tastytrade OAuth2 refresh token flow requires:
  // - grant_type: 'refresh_token'
  // - refresh_token: the refresh token
  // - client_secret: the client secret
  // - client_id: optional but recommended
  // 
  // Try different authentication methods in order:
  // 1. Body params method FIRST (this works in Postman) - client_id and client_secret in body
  // 2. Basic auth header (fallback if body params fails)
  
  const oauthUrl = `${baseUrl}/oauth/token`;
  
  // Method 1: Try body params method FIRST (matches Postman format that works)
  // This includes client_id and client_secret in the body, no Authorization header
  const bodyParams: Record<string, string> = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  };
  
  if (clientId) {
    bodyParams.client_id = clientId;
    bodyParams.client_secret = clientSecret;
  } else {
    // No client_id available, use client_secret only
    bodyParams.client_secret = clientSecret;
  }
  
  const headers: HeadersInit = {
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': 'VibeSnipe/1.0', // Add User-Agent to avoid nginx/proxy blocking
  };
  
  logger.info('OAuth2 token exchange attempt: Body params (primary method - matches Postman)', {
    url: oauthUrl,
    method: 'body_params',
    bodyParams: Object.keys(bodyParams),
    env,
    baseUrl,
    urlValidation: {
      isProd: env === 'prod',
      expectedProd: 'https://api.tastytrade.com',
      expectedSandbox: 'https://api.cert.tastytrade.com',
      actualBaseUrl: baseUrl,
      matchesExpected: (env === 'prod' && baseUrl === 'https://api.tastytrade.com') || 
                       (env === 'sandbox' && baseUrl === 'https://api.cert.tastytrade.com'),
    },
    requestHeaders: {
      'Content-Type': headers['Content-Type'],
      'User-Agent': headers['User-Agent'],
    },
  });
  
  try {
    const startTime = Date.now();
    const response = await fetch(oauthUrl, {
      method: 'POST',
      headers,
      body: new URLSearchParams(bodyParams),
      redirect: 'manual', // Don't auto-follow redirects - we'll handle them
    });
    const responseTime = Date.now() - startTime;
    
    const contentType = response.headers.get('content-type') || '';
    const location = response.headers.get('location');
    const server = response.headers.get('server');
    
    // Check for redirects
    if (response.status >= 300 && response.status < 400 && location) {
      logger.warn('OAuth2 token exchange redirected', {
        status: response.status,
        redirectLocation: location,
        finalUrl: location,
        method: 'body_params',
        env,
        baseUrl,
        message: 'Request was redirected - possible proxy/CDN interference',
      });
      // Fall through to try Basic Auth method
    }

    if (response.ok) {
      const responseText = await response.text();
      const isJson = contentType.includes('application/json') || responseText.trim().startsWith('{');
      
      if (!isJson) {
        logger.error('OAuth2 response is not JSON', {
          contentType,
          responsePreview: responseText.substring(0, 200),
          method: 'body_params',
          env,
        });
        throw new Error('OAuth2 token exchange returned non-JSON response');
      }
      
      const data = JSON.parse(responseText);
      
      if (!data.access_token) {
        logger.error('OAuth2 response missing access_token', { response: data });
        throw new Error('OAuth2 token exchange returned no access token');
      }
      
      logger.info('OAuth2 token exchange successful (Body params method)', {
        env,
        responseTime: `${responseTime}ms`,
        tokenLength: data.access_token?.length || 0,
      });
      return data.access_token;
    } else {
      const errorText = await response.text();
      const isHtmlResponse = contentType.includes('text/html') || errorText.trim().startsWith('<');
      const isJsonResponse = contentType.includes('application/json') || errorText.trim().startsWith('{');
      
      logger.warn('OAuth2 token exchange failed with body params method', {
        status: response.status,
        statusText: response.statusText,
        method: 'body_params',
        willTryFallback: clientId ? true : false,
        responseTime: `${responseTime}ms`,
        contentType,
        isHtml: isHtmlResponse,
        isJson: isJsonResponse,
        server,
        responsePreview: errorText.substring(0, 200),
        responseHeaders: {
          'content-type': contentType,
          server,
          location: location || undefined,
        },
      });
      
      // Fall through to try Basic Auth method if we have clientId
      if (!clientId) {
        // No fallback available, throw error
        throw new Error('OAuth2 token exchange failed: No clientId available for Basic Auth fallback');
      }
    }
  } catch (error) {
    // If body params method failed and we have clientId, try Basic Auth as fallback
    if (clientId && error instanceof Error && !error.message.includes('No clientId available')) {
      logger.warn('OAuth2 token exchange error with body params method, trying Basic Auth fallback', {
        error: error instanceof Error ? error.message : 'Unknown error',
        method: 'body_params',
        willTryFallback: true
      });
      // Fall through to try Basic Auth method
    } else {
      throw error;
    }
  }
  
  // Method 2: Fallback to Basic auth header (only if body params failed and we have clientId)
  if (clientId) {
    const basicAuthHeaders: HeadersInit = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'User-Agent': 'VibeSnipe/1.0', // Add User-Agent to avoid nginx/proxy blocking
    };
    
    const basicAuthBodyParams: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    };
    
    logger.info('OAuth2 token exchange attempt: Basic auth (fallback method)', {
      url: oauthUrl,
      method: 'basic_auth_header',
      bodyParams: Object.keys(basicAuthBodyParams),
      env,
      baseUrl,
      urlValidation: {
        isProd: env === 'prod',
        expectedProd: 'https://api.tastytrade.com',
        expectedSandbox: 'https://api.cert.tastytrade.com',
        actualBaseUrl: baseUrl,
        matchesExpected: (env === 'prod' && baseUrl === 'https://api.tastytrade.com') || 
                         (env === 'sandbox' && baseUrl === 'https://api.cert.tastytrade.com'),
      },
      requestHeaders: {
        'Content-Type': basicAuthHeaders['Content-Type'],
        'Authorization': 'Basic [REDACTED]',
        'User-Agent': basicAuthHeaders['User-Agent'],
      },
    });
    
    try {
      const startTime = Date.now();
      const response = await fetch(oauthUrl, {
        method: 'POST',
        headers: basicAuthHeaders,
        body: new URLSearchParams(basicAuthBodyParams),
        redirect: 'manual', // Don't auto-follow redirects - we'll handle them
      });

      const responseTime = Date.now() - startTime;
      const contentType = response.headers.get('content-type') || '';
      const location = response.headers.get('location');
      const server = response.headers.get('server');
      
      // Check for redirects
      if (response.status >= 300 && response.status < 400 && location) {
        logger.warn('OAuth2 token exchange redirected', {
          status: response.status,
          redirectLocation: location,
          finalUrl: location,
          method: 'basic_auth_header',
          env,
          baseUrl,
          message: 'Request was redirected - possible proxy/CDN interference',
        });
      }

      if (response.ok) {
        const responseText = await response.text();
        const isJson = contentType.includes('application/json') || responseText.trim().startsWith('{');
        
        if (!isJson) {
          logger.error('OAuth2 response is not JSON', {
            contentType,
            responsePreview: responseText.substring(0, 200),
            method: 'basic_auth_header',
            env,
          });
          throw new Error('OAuth2 token exchange returned non-JSON response');
        }
        
        const data = JSON.parse(responseText);
        
        if (!data.access_token) {
          logger.error('OAuth2 response missing access_token', { response: data });
          throw new Error('OAuth2 token exchange returned no access token');
        }
        
        logger.info('OAuth2 token exchange successful (Basic auth fallback)', {
          env,
          responseTime: `${responseTime}ms`,
          tokenLength: data.access_token?.length || 0,
        });
        return data.access_token;
      } else {
        const errorText = await response.text();
        const isHtmlResponse = contentType.includes('text/html') || errorText.trim().startsWith('<');
        const isJsonResponse = contentType.includes('application/json') || errorText.trim().startsWith('{');
        
        logger.warn('OAuth2 token exchange failed with Basic auth (all methods exhausted)', {
          status: response.status,
          statusText: response.statusText,
          method: 'basic_auth_header',
          responseTime: `${responseTime}ms`,
          contentType,
          isHtml: isHtmlResponse,
          isJson: isJsonResponse,
          server,
          responsePreview: errorText.substring(0, 200),
          responseHeaders: {
            'content-type': contentType,
            server,
            location: location || undefined,
          },
        });
        
        // Both methods failed, will throw error below
      }
    } catch (error) {
      logger.warn('OAuth2 token exchange error with Basic auth (all methods exhausted)', {
        error: error instanceof Error ? error.message : 'Unknown error',
        method: 'basic_auth_header',
      });
      
      // Both methods failed - throw generic error (details already logged above)
      throw new Error('OAuth2 token exchange failed: All authentication methods exhausted. Both body params and Basic Auth methods failed.');
    }
  }
  
  // If we reach here, both methods failed and we didn't have clientId
  // Throw a generic error
  throw new Error('OAuth2 token exchange failed: All authentication methods exhausted. No clientId available for Basic Auth fallback.');
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
  // Log whether we're using cached client or initializing new one
  if (clientInstance) {
    logger.info('Using cached Tastytrade client instance');
    return clientInstance;
  }

  logger.info('Initializing new Tastytrade client instance');
  
  // Validate required environment variables
  const config = getTastytradeConfig();
  
  logger.info('Tastytrade configuration loaded', {
    authMethod: config.authMethod,
    hasClientId: !!config.clientId,
    hasClientSecret: !!config.clientSecret,
    hasRefreshToken: !!config.refreshToken,
    env: config.env,
    clientIdLength: config.clientId?.length || 0,
    clientSecretLength: config.clientSecret?.length || 0,
    refreshTokenLength: config.refreshToken?.length || 0
  });

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
      logger.info('Starting OAuth2 authentication flow', {
        env: config.env,
        hasClientId: !!config.clientId,
        hasRefreshToken: !!config.refreshToken
      });
      
      // Validate required credentials are present (TypeScript guard)
      if (!config.refreshToken || !config.clientSecret) {
        throw new Error(
          'OAuth2 credentials are missing: refreshToken and clientSecret are required'
        );
      }
      
      // OAuth2 authentication: exchange refresh token for access token
      // Non-null assertions are safe here because we've validated above
      const accessToken = await exchangeRefreshToken(
        config.refreshToken!,
        config.clientSecret!,
        config.clientId,
        config.env
      );
      
      // Set the access token in the session
      // Note: The HTTP client uses authToken directly in Authorization header
      // Tastytrade OAuth2 requires "Bearer" prefix for access tokens
      clientInstance.session.authToken = `Bearer ${accessToken}`;
      
      logger.info('Tastytrade client initialized and authenticated via OAuth2', { 
        env: config.env,
        tokenLength: accessToken?.length || 0
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
    
    // Log detailed error information including credential presence
    logger.error('Failed to initialize Tastytrade client', {
      env: config.env,
      authMethod: config.authMethod,
      credentialPresence: {
        hasClientId: !!config.clientId,
        hasClientSecret: !!config.clientSecret,
        hasRefreshToken: !!config.refreshToken,
        clientIdLength: config.clientId?.length || 0,
        clientSecretLength: config.clientSecret?.length || 0,
        refreshTokenLength: config.refreshToken?.length || 0,
      },
      error: errorMessage,
    }, error as Error);
    
    // Provide enhanced error message if it's an OAuth2-related error
    let enhancedMessage = `Failed to initialize Tastytrade client: ${errorMessage}`;
    
    if (config.authMethod === 'oauth2') {
      // Check if credentials are missing or invalid
      const missingCredentials: string[] = [];
      if (!config.clientSecret || config.clientSecret.trim().length === 0) {
        missingCredentials.push('TASTYTRADE_CLIENT_SECRET');
      }
      if (!config.refreshToken || config.refreshToken.trim().length === 0) {
        missingCredentials.push('TASTYTRADE_REFRESH_TOKEN');
      }
      
      if (missingCredentials.length > 0) {
        enhancedMessage += '\n\nMissing or invalid credentials detected:\n' +
          missingCredentials.map(c => `- ${c} is missing or empty`).join('\n') +
          '\n\nAction steps:\n' +
          '- Set all required environment variables in Vercel\n' +
          '- Verify credentials are not empty or whitespace-only\n' +
          '- Check Vercel environment variable settings';
      } else if (errorMessage.includes('OAuth2')) {
        enhancedMessage += '\n\nOAuth2 Authentication Troubleshooting:\n' +
          '1. Verify TASTYTRADE_CLIENT_ID, TASTYTRADE_CLIENT_SECRET, and TASTYTRADE_REFRESH_TOKEN in Vercel\n' +
          '2. Ensure credentials match your Tastytrade OAuth application\n' +
          '3. Verify TASTYTRADE_ENV is set correctly (sandbox or prod)\n' +
          '4. Regenerate refresh token if it expired or was revoked\n' +
          '5. Check Tastytrade OAuth application settings: https://tastytrade.com/api/settings\n' +
          '6. Review error details above for specific OAuth2 error guidance';
      } else {
        enhancedMessage += '\n\nOAuth2 Authentication Error:\n' +
          '- Check that all credentials are set in Vercel\n' +
          '- Verify TASTYTRADE_ENV matches your credentials (sandbox vs prod)\n' +
          '- Review error details above for specific error guidance';
      }
    }
    
    throw new AuthenticationError(enhancedMessage);
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

