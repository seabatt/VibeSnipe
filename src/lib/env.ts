/**
 * Type-safe environment variable validation and access.
 * 
 * Validates all required environment variables at startup and provides
 * typed access throughout the application.
 */

import { z } from 'zod';

// Note: Cannot use logger here as it would create circular dependency

const envSchema = z.object({
  // Node environment
  NODE_ENV: z.string().default('development'),
  
  // Tastytrade API (optional for development)
  TASTYTRADE_ENV: z.enum(['prod', 'sandbox']).optional(),
  // OAuth2 credentials (preferred)
  TASTYTRADE_CLIENT_ID: z.string().optional(),
  TASTYTRADE_CLIENT_SECRET: z.string().optional(),
  TASTYTRADE_REFRESH_TOKEN: z.string().optional(),
  // Legacy username/password (deprecated, kept for backward compatibility)
  TASTYTRADE_USERNAME: z.string().optional(),
  TASTYTRADE_PASSWORD: z.string().optional(),
  TASTYTRADE_ACCOUNT_NUMBER: z.string().optional(),
  
  // Next.js
  NEXT_PUBLIC_APP_URL: z.string().optional(),
  
  // Feature flags
  ENABLE_TEST_LOGS: z.string().optional().transform(val => val === 'true'),
  ENABLE_SENTRY: z.string().optional().transform(val => val === 'true'),
  
  // Sentry (optional)
  SENTRY_DSN: z.string().optional(),
  SENTRY_AUTH_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validates environment variables and returns typed env object.
 * 
 * @throws {Error} If required environment variables are missing or invalid
 */
function validateEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  
  if (!parsed.success) {
    // Use console.error here as logger would create circular dependency
    console.error('❌ Invalid environment variables:');
    console.error(JSON.stringify(parsed.error.format(), null, 2));
    throw new Error('Invalid environment variables');
  }
  
  return parsed.data;
}

// Validate and export env
// Note: This will throw if validation fails at import time
export const env = validateEnv();

/**
 * Checks if Tastytrade API is configured.
 * Supports OAuth2 (preferred) or username/password (legacy).
 */
export function isTastytradeConfigured(): boolean {
  const hasEnv = !!env.TASTYTRADE_ENV;
  
  // OAuth2 method (preferred)
  const hasOAuth2 = !!(
    env.TASTYTRADE_CLIENT_SECRET &&
    env.TASTYTRADE_REFRESH_TOKEN
  );
  
  // Legacy username/password method
  const hasUsernamePassword = !!(
    env.TASTYTRADE_USERNAME &&
    env.TASTYTRADE_PASSWORD
  );
  
  return hasEnv && (hasOAuth2 || hasUsernamePassword);
}

/**
 * Gets Tastytrade configuration or throws if not configured.
 * Validates that credentials are non-empty and properly formatted.
 */
export function getTastytradeConfig() {
  if (!isTastytradeConfigured()) {
    throw new Error(
      'Tastytrade API not configured. Set TASTYTRADE_ENV, TASTYTRADE_CLIENT_SECRET, and TASTYTRADE_REFRESH_TOKEN (OAuth2) or TASTYTRADE_USERNAME and TASTYTRADE_PASSWORD (legacy).'
    );
  }
  
  // Validate TASTYTRADE_ENV
  if (!env.TASTYTRADE_ENV || (env.TASTYTRADE_ENV !== 'prod' && env.TASTYTRADE_ENV !== 'sandbox')) {
    throw new Error(
      `Invalid TASTYTRADE_ENV: must be 'prod' or 'sandbox', got '${env.TASTYTRADE_ENV}'`
    );
  }
  
  const hasOAuth2 = !!(
    env.TASTYTRADE_CLIENT_SECRET &&
    env.TASTYTRADE_REFRESH_TOKEN
  );
  
  if (hasOAuth2) {
    // Validate OAuth2 credentials are non-empty and non-whitespace
    const clientSecret = env.TASTYTRADE_CLIENT_SECRET?.trim();
    const refreshToken = env.TASTYTRADE_REFRESH_TOKEN?.trim();
    
    if (!clientSecret || clientSecret.length === 0) {
      throw new Error(
        'TASTYTRADE_CLIENT_SECRET is empty or whitespace only. Please set a valid client secret in Vercel.'
      );
    }
    
    if (!refreshToken || refreshToken.length === 0) {
      throw new Error(
        'TASTYTRADE_REFRESH_TOKEN is empty or whitespace only. Please set a valid refresh token in Vercel. If your refresh token expired, you may need to regenerate it.'
      );
    }
    
    // Validate clientId if provided (optional but recommended)
    let clientId = env.TASTYTRADE_CLIENT_ID?.trim();
    if (clientId !== undefined && clientId !== null && clientId.length === 0) {
      // Warn but don't fail - client_id is optional
      console.warn('TASTYTRADE_CLIENT_ID is set but empty. Including client_id is recommended for OAuth2.');
      clientId = undefined;
    }
    
    return {
      env: env.TASTYTRADE_ENV,
      clientId: clientId,
      clientSecret: clientSecret,
      refreshToken: refreshToken,
      accountNumber: env.TASTYTRADE_ACCOUNT_NUMBER?.trim() || undefined,
      authMethod: 'oauth2' as const,
    };
  } else {
    // Legacy username/password - validate they're non-empty
    const username = env.TASTYTRADE_USERNAME?.trim();
    const password = env.TASTYTRADE_PASSWORD?.trim();
    
    if (!username || username.length === 0) {
      throw new Error(
        'TASTYTRADE_USERNAME is empty or whitespace only. Please set a valid username in Vercel.'
      );
    }
    
    if (!password || password.length === 0) {
      throw new Error(
        'TASTYTRADE_PASSWORD is empty or whitespace only. Please set a valid password in Vercel.'
      );
    }
    
    return {
      env: env.TASTYTRADE_ENV,
      username: username,
      password: password,
      accountNumber: env.TASTYTRADE_ACCOUNT_NUMBER?.trim() || undefined,
      authMethod: 'username_password' as const,
    };
  }
}

