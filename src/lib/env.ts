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
 */
export function getTastytradeConfig() {
  if (!isTastytradeConfigured()) {
    throw new Error(
      'Tastytrade API not configured. Set TASTYTRADE_ENV, TASTYTRADE_CLIENT_SECRET, and TASTYTRADE_REFRESH_TOKEN (OAuth2) or TASTYTRADE_USERNAME and TASTYTRADE_PASSWORD (legacy).'
    );
  }
  
  const hasOAuth2 = !!(
    env.TASTYTRADE_CLIENT_SECRET &&
    env.TASTYTRADE_REFRESH_TOKEN
  );
  
  if (hasOAuth2) {
    return {
      env: env.TASTYTRADE_ENV!,
      clientId: env.TASTYTRADE_CLIENT_ID,
      clientSecret: env.TASTYTRADE_CLIENT_SECRET!,
      refreshToken: env.TASTYTRADE_REFRESH_TOKEN!,
      accountNumber: env.TASTYTRADE_ACCOUNT_NUMBER,
      authMethod: 'oauth2' as const,
    };
  } else {
    // Legacy username/password
    return {
      env: env.TASTYTRADE_ENV!,
      username: env.TASTYTRADE_USERNAME!,
      password: env.TASTYTRADE_PASSWORD!,
      accountNumber: env.TASTYTRADE_ACCOUNT_NUMBER,
      authMethod: 'username_password' as const,
    };
  }
}

