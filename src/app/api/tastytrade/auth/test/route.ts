/**
 * Tastytrade OAuth2 diagnostic endpoint.
 * 
 * GET /api/tastytrade/auth/test
 * 
 * Tests OAuth2 credentials independently and provides detailed diagnostic information.
 * This endpoint helps identify credential issues vs network/proxy issues.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * GET handler for OAuth2 diagnostic testing.
 * 
 * @returns {Promise<NextResponse>} JSON response with diagnostic information
 */
export async function GET() {
  const diagnostics: any = {
    timestamp: new Date().toISOString(),
    environment: 'unknown',
    credentialCheck: {
      hasEnv: false,
      hasClientSecret: false,
      hasRefreshToken: false,
      hasClientId: false,
    },
    urlValidation: {
      baseUrl: null,
      oauthEndpoint: null,
      isValid: false,
    },
    requestDetails: null,
    responseDetails: null,
    error: null,
    success: false,
  };

  try {
    // Step 1: Validate environment variables (without exposing values)
    const { getTastytradeConfig } = await import('@/lib/env');
    let config;
    
    try {
      config = getTastytradeConfig();
      diagnostics.environment = config.env;
      diagnostics.credentialCheck.hasEnv = true;
      diagnostics.credentialCheck.hasClientSecret = !!config.clientSecret;
      diagnostics.credentialCheck.hasRefreshToken = !!config.refreshToken;
      diagnostics.credentialCheck.hasClientId = !!config.clientId;
      diagnostics.credentialCheck.clientSecretLength = config.clientSecret?.length || 0;
      diagnostics.credentialCheck.refreshTokenLength = config.refreshToken?.length || 0;
      diagnostics.credentialCheck.clientIdLength = config.clientId?.length || 0;
    } catch (configError) {
      const configErrorMessage = configError instanceof Error ? configError.message : 'Unknown error';
      diagnostics.error = {
        type: 'config_validation',
        message: configErrorMessage,
        step: 'credential_validation',
      };
      return NextResponse.json(
        {
          ...diagnostics,
          message: 'Credential validation failed',
          troubleshooting: [
            'Go to Vercel Dashboard → Your Project → Settings → Environment Variables',
            'Verify the following variables are set:',
            '  - TASTYTRADE_ENV (must be "sandbox" or "prod")',
            '  - TASTYTRADE_CLIENT_SECRET (required)',
            '  - TASTYTRADE_REFRESH_TOKEN (required)',
            '  - TASTYTRADE_CLIENT_ID (optional but recommended)',
            'Ensure values are not empty or whitespace-only',
          ],
        },
        { status: 400 }
      );
    }

    // Step 2: Validate URL configuration
    const baseUrl = config.env === 'prod' 
      ? 'https://api.tastytrade.com' 
      : 'https://api.cert.tastytrade.com';
    const oauthEndpoint = `${baseUrl}/oauth/token`;
    
    diagnostics.urlValidation.baseUrl = baseUrl;
    diagnostics.urlValidation.oauthEndpoint = oauthEndpoint;
    diagnostics.urlValidation.isValid = 
      baseUrl.startsWith('https://api.tastytrade.com') || 
      baseUrl.startsWith('https://api.cert.tastytrade.com');

    if (!diagnostics.urlValidation.isValid) {
      diagnostics.error = {
        type: 'url_validation',
        message: `Invalid base URL: ${baseUrl}`,
        step: 'url_validation',
      };
      return NextResponse.json(
        {
          ...diagnostics,
          message: 'Invalid base URL configuration',
          troubleshooting: [
            'TASTYTRADE_ENV must be either "sandbox" or "prod"',
            'Expected URLs:',
            '  - prod: https://api.tastytrade.com',
            '  - sandbox: https://api.cert.tastytrade.com',
          ],
        },
        { status: 400 }
      );
    }

    // Step 3: Attempt OAuth2 token exchange with detailed logging
    // Try body params method FIRST (matches Postman format that works)
    const bodyParams: Record<string, string> = {
      grant_type: 'refresh_token',
      refresh_token: config.refreshToken!,
    };

    // Add client_id and client_secret to body (body params method - matches Postman)
    if (config.clientId) {
      bodyParams.client_id = config.clientId;
      bodyParams.client_secret = config.clientSecret!;
    } else {
      // No client_id available, use client_secret only
      bodyParams.client_secret = config.clientSecret!;
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'VibeSnipe/1.0', // Add User-Agent to avoid nginx/proxy blocking
    };

    const requestBody = new URLSearchParams(bodyParams).toString();
    
    // Log request details (sanitized)
    diagnostics.requestDetails = {
      url: oauthEndpoint,
      method: 'POST',
      headers: {
        'Content-Type': headers['Content-Type'],
        'User-Agent': headers['User-Agent'],
        'Authorization': '[NOT SET]', // Body params method - no Basic Auth header
      },
      bodyParams: Object.keys(bodyParams),
      bodyLength: requestBody.length,
    };

    logger.info('OAuth2 diagnostic test - attempting token exchange', {
      url: oauthEndpoint,
      env: config.env,
      hasClientId: !!config.clientId,
      authMethod: 'body_params', // Primary method - matches Postman
    });

    // Make the request
    const startTime = Date.now();
    let response = await fetch(oauthEndpoint, {
      method: 'POST',
      headers,
      body: requestBody,
      redirect: 'manual', // Don't follow redirects automatically - we'll handle them
    });
    
    // If body params method fails and we have clientId, try Basic Auth as fallback
    if (!response.ok && config.clientId) {
      logger.info('OAuth2 diagnostic test - body params failed, trying Basic Auth fallback', {
        url: oauthEndpoint,
        env: config.env,
        status: response.status,
      });
      
      // Try Basic Auth fallback
      const basicAuthHeaders: HeadersInit = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret!}`).toString('base64')}`,
        'User-Agent': 'VibeSnipe/1.0',
      };
      
      const basicAuthBodyParams: Record<string, string> = {
        grant_type: 'refresh_token',
        refresh_token: config.refreshToken!,
      };
      
      const basicAuthRequestBody = new URLSearchParams(basicAuthBodyParams).toString();
      
      // Update diagnostics to show we tried fallback
      diagnostics.requestDetails.headers['Authorization'] = 'Basic [REDACTED]';
      diagnostics.requestDetails.triedMethods = ['body_params', 'basic_auth_header'];
      
      response = await fetch(oauthEndpoint, {
        method: 'POST',
        headers: basicAuthHeaders,
        body: basicAuthRequestBody,
        redirect: 'manual',
      });
    }

    const responseTime = Date.now() - startTime;

    // Get response details
    const responseText = await response.text();
    const contentType = response.headers.get('content-type') || '';
    const isHtmlResponse = contentType.includes('text/html') || responseText.trim().startsWith('<');
    const isJsonResponse = contentType.includes('application/json') || responseText.trim().startsWith('{');

    diagnostics.responseDetails = {
      status: response.status,
      statusText: response.statusText,
      headers: {
        'content-type': contentType,
        'server': response.headers.get('server'),
        'location': response.headers.get('location'),
      },
      responseTime: `${responseTime}ms`,
      contentType: contentType,
      isHtml: isHtmlResponse,
      isJson: isJsonResponse,
      bodyLength: responseText.length,
      bodyPreview: responseText.substring(0, 500),
    };

    // Check for redirects
    if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
      const redirectUrl = response.headers.get('location');
      diagnostics.responseDetails.redirect = {
        status: response.status,
        location: redirectUrl,
        message: 'Request was redirected - this may indicate a proxy or CDN issue',
      };
      diagnostics.error = {
        type: 'redirect_detected',
        message: `Request was redirected to: ${redirectUrl}`,
        step: 'token_exchange',
      };
      
      return NextResponse.json(
        {
          ...diagnostics,
          message: 'Request was redirected - possible proxy/CDN interference',
          troubleshooting: [
            'The OAuth2 request was redirected, which suggests:',
            '1. A proxy or CDN is intercepting the request',
            '2. The endpoint URL may be incorrect',
            '3. Vercel may be redirecting external API calls',
            'Check Vercel deployment settings for any proxy configurations',
            'Verify the redirect location matches expected Tastytrade domain',
          ],
        },
        { status: 400 }
      );
    }

    // Check for HTML response (nginx/proxy issue)
    if (isHtmlResponse) {
      diagnostics.error = {
        type: 'html_response',
        message: 'Received HTML response instead of JSON - likely proxy/nginx issue',
        step: 'token_exchange',
      };
      
      // Extract title from HTML if possible
      const titleMatch = responseText.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1] : 'Unknown';
      
      diagnostics.responseDetails.htmlTitle = title;
      
      return NextResponse.json(
        {
          ...diagnostics,
          message: 'Received HTML response instead of JSON API response',
          troubleshooting: [
            'The API returned HTML (likely from nginx/proxy) instead of JSON. This suggests:',
            '1. Request is not reaching Tastytrade API (hitting proxy/CDN instead)',
            '2. Credentials may be so malformed that proxy rejects before reaching API',
            '3. Vercel protection/proxy may be interfering with external API calls',
            '4. Wrong endpoint URL or network routing issue',
            '',
            'Action steps:',
            '- Verify TASTYTRADE_ENV matches your credentials (sandbox vs prod)',
            '- Check credentials in Vercel are not malformed (no newlines, extra spaces)',
            '- Verify credentials match your Tastytrade OAuth application',
            '- Check Vercel deployment settings for proxy/CDN configurations',
            '- Try regenerating refresh token: https://tastytrade.com/api/settings',
          ],
        },
        { status: 400 }
      );
    }

    // Check if request was successful
    if (!response.ok) {
      let errorDetails = responseText;
      try {
        const errorJson = JSON.parse(responseText);
        errorDetails = JSON.stringify(errorJson, null, 2);
        diagnostics.responseDetails.errorJson = errorJson;
      } catch {
        // Not JSON, use as-is
      }

      diagnostics.error = {
        type: 'api_error',
        message: `API returned ${response.status} ${response.statusText}`,
        step: 'token_exchange',
        status: response.status,
      };

      let troubleshooting: string[] = [];
      
      if (response.status === 401) {
        troubleshooting = [
          'OAuth2 token exchange returned 401 Unauthorized. Possible causes:',
          '1. Invalid or expired refresh token - Regenerate refresh token',
          '2. Client ID/Secret mismatch - Verify credentials match OAuth application',
          '3. Refresh token not associated with this OAuth application',
          '4. Wrong environment - Verify TASTYTRADE_ENV matches credentials',
          '',
          'Action steps:',
          '- Verify credentials in Vercel match Tastytrade OAuth application',
          '- Check that TASTYTRADE_ENV is set correctly (sandbox or prod)',
          '- Regenerate refresh token if expired: https://tastytrade.com/api/settings',
          '- Review Tastytrade OAuth application settings: https://tastytrade.com/api/settings',
        ];
      } else if (response.status === 400) {
        troubleshooting = [
          'OAuth2 token exchange returned 400 Bad Request. Possible causes:',
          '1. Invalid request format - Check grant_type=refresh_token is included',
          '2. Missing required parameters',
          '3. Invalid refresh_token format',
          '',
          'Action steps:',
          '- Review request format and parameters',
          '- Verify TASTYTRADE_REFRESH_TOKEN is a valid refresh token',
        ];
      }

      return NextResponse.json(
        {
          ...diagnostics,
          message: `OAuth2 token exchange failed: ${response.status} ${response.statusText}`,
          troubleshooting,
        },
        { status: 400 }
      );
    }

    // Success - parse the response
    let tokenData;
    try {
      tokenData = JSON.parse(responseText);
      if (!tokenData.access_token) {
        diagnostics.error = {
          type: 'invalid_response',
          message: 'Response missing access_token',
          step: 'token_exchange',
        };
        return NextResponse.json(
          {
            ...diagnostics,
            message: 'OAuth2 response missing access_token',
            troubleshooting: [
              'The API returned a successful response but without access_token',
              'Check Tastytrade API documentation for response format changes',
            ],
          },
          { status: 400 }
        );
      }
    } catch (parseError) {
      diagnostics.error = {
        type: 'parse_error',
        message: 'Failed to parse JSON response',
        step: 'token_exchange',
      };
      return NextResponse.json(
        {
          ...diagnostics,
          message: 'Failed to parse OAuth2 response',
          troubleshooting: [
            'The API returned a response that could not be parsed as JSON',
            'Check response body preview above for details',
          ],
        },
        { status: 400 }
      );
    }

    // Success!
    diagnostics.success = true;
    diagnostics.responseDetails.tokenReceived = true;
    diagnostics.responseDetails.tokenLength = tokenData.access_token?.length || 0;
    diagnostics.responseDetails.tokenType = tokenData.token_type || 'unknown';
    diagnostics.responseDetails.expiresIn = tokenData.expires_in || 'unknown';

    logger.info('OAuth2 diagnostic test - SUCCESS', {
      env: config.env,
      responseTime: `${responseTime}ms`,
    });

    return NextResponse.json(
      {
        ...diagnostics,
        message: 'OAuth2 token exchange successful',
        summary: {
          credentials: 'Valid',
          url: 'Valid',
          tokenExchange: 'Success',
          responseTime: `${responseTime}ms`,
        },
      },
      { status: 200 }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;

    logger.error('OAuth2 diagnostic test - unexpected error', {
      error: errorMessage,
      stack: errorStack,
    }, error as Error);

    diagnostics.error = {
      type: 'unexpected_error',
      message: errorMessage,
      step: 'unknown',
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
    };

    return NextResponse.json(
      {
        ...diagnostics,
        message: 'Unexpected error during diagnostic test',
        troubleshooting: [
          'An unexpected error occurred during the diagnostic test',
          'Check server logs for detailed error information',
          'Verify all environment variables are set correctly',
        ],
      },
      { status: 500 }
    );
  }
}

