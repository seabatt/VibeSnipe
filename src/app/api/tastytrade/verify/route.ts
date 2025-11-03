import { NextResponse } from 'next/server';
import { getTastytradeConfig } from '@/lib/env';
import { logger } from '@/lib/logger';

/**
 * Verify OAuth2 credentials endpoint.
 * Tests token exchange without making full API calls.
 * Useful for debugging OAuth2 authentication issues.
 */
export async function GET() {
  try {
    // Validate configuration
    const config = getTastytradeConfig();
    
    if (config.authMethod !== 'oauth2') {
      return NextResponse.json(
        { 
          error: 'Only OAuth2 authentication method is supported for verification',
          authMethod: config.authMethod
        },
        { status: 400 }
      );
    }
    
    // Validate required credentials are present (TypeScript guard)
    if (!config.refreshToken || !config.clientSecret) {
      return NextResponse.json(
        { 
          error: 'Missing required OAuth2 credentials',
          hasRefreshToken: !!config.refreshToken,
          hasClientSecret: !!config.clientSecret
        },
        { status: 400 }
      );
    }
    
    // Test token exchange
    const baseUrl = config.env === 'prod' 
      ? 'https://api.tastytrade.com' 
      : 'https://api.cert.tastytrade.com';
    
    logger.info('Verifying OAuth2 credentials', {
      env: config.env,
      hasClientId: !!config.clientId,
      clientIdLength: config.clientId?.length || 0,
      clientSecretLength: config.clientSecret.length,
      refreshTokenLength: config.refreshToken.length,
      refreshTokenPrefix: config.refreshToken.substring(0, 10)
    });
    
    // Try Basic auth method first
    let authMethod = 'basic_auth_header';
    let headers: HeadersInit = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    
    if (config.clientId) {
      const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }
    
    const bodyParams: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken,
    };
    
    let response = await fetch(`${baseUrl}/oauth/token`, {
      method: 'POST',
      headers,
      body: new URLSearchParams(bodyParams),
    });
    
    // If Basic auth fails, try body params method
    if (!response.ok && config.clientId) {
      logger.info('Basic auth method failed, trying body params method');
      authMethod = 'body_params';
      
      headers = {
        'Content-Type': 'application/x-www-form-urlencoded',
      };
      
      bodyParams.client_id = config.clientId;
      bodyParams.client_secret = config.clientSecret;
      
      response = await fetch(`${baseUrl}/oauth/token`, {
        method: 'POST',
        headers,
        body: new URLSearchParams(bodyParams),
      });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = JSON.stringify(errorJson, null, 2);
      } catch {
        // Not JSON, use as-is
      }
      
      logger.error('OAuth2 credential verification failed', {
        status: response.status,
        statusText: response.statusText,
        error: errorDetails,
        authMethod,
        triedMethods: config.clientId ? ['basic_auth_header', 'body_params'] : ['body_params']
      });
      
      // Provide actionable error message
      let errorMessage = `OAuth2 token exchange failed: ${response.status} ${response.statusText}`;
      
      if (response.status === 401) {
        errorMessage += '\n\nPossible causes:\n' +
          '1. Invalid or expired refresh token - Regenerate refresh token in Tastytrade OAuth application\n' +
          '2. Client ID/Secret mismatch - Verify TASTYTRADE_CLIENT_ID and TASTYTRADE_CLIENT_SECRET match your OAuth application\n' +
          '3. Refresh token not associated with this OAuth application - Ensure refresh token was generated with the same Client ID/Secret\n' +
          '4. Refresh token revoked or expired - Generate a new refresh token\n\n' +
          'Action steps:\n' +
          '- Verify credentials in Vercel match Tastytrade OAuth application\n' +
          '- Regenerate refresh token if it expired\n' +
          '- Check Tastytrade OAuth application settings at https://tastytrade.com/api/settings\n' +
          '- Review Tastytrade OAuth2 documentation: https://developer.tastytrade.com';
      }
      
      return NextResponse.json(
        {
          verified: false,
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          errorDetails: errorDetails,
          authMethod,
          triedMethods: config.clientId ? ['basic_auth_header', 'body_params'] : ['body_params']
        },
        { status: 400 }
      );
    }
    
    const data = await response.json();
    
    if (!data.access_token) {
      logger.error('OAuth2 response missing access_token', { response: data });
      return NextResponse.json(
        {
          verified: false,
          error: 'OAuth2 token exchange returned no access token',
          response: data
        },
        { status: 400 }
      );
    }
    
    logger.info('OAuth2 credential verification successful', {
      authMethod,
      tokenLength: data.access_token?.length || 0,
      hasRefreshToken: !!data.refresh_token,
      expiresIn: data.expires_in
    });
    
    return NextResponse.json({
      verified: true,
      message: 'OAuth2 credentials are valid',
      authMethod,
      tokenLength: data.access_token.length,
      expiresIn: data.expires_in,
      hasRefreshToken: !!data.refresh_token,
      // Don't expose actual tokens
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to verify OAuth2 credentials', {
      error: errorMessage,
      stack: errorStack
    }, error as Error);
    
    return NextResponse.json(
      {
        verified: false,
        error: 'Failed to verify OAuth2 credentials',
        details: errorMessage,
        ...(process.env.NODE_ENV === 'development' && { stack: errorStack })
      },
      { status: 500 }
    );
  }
}
