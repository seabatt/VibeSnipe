/**
 * Discord webhook handler for 8Ball alerts.
 * 
 * This endpoint receives Discord webhooks for scheduled 8Ball alerts
 * and initiates trade execution via the orchestrator.
 * 
 * Separation of concerns:
 * - This handler ONLY decides WHEN to trade (based on schedule)
 * - The orchestrator decides HOW to execute (via execution service)
 * 
 * Future implementation will include:
 * - Scheduling window validation (10:15-10:45 AM, 1:15-1:45 PM ET)
 * - Auto-arm/auto-fire logic based on PresetTemplate
 * - Rate limiting and duplicate detection
 * 
 * @module webhooks/discord
 */

import { NextResponse } from 'next/server';
import { buildTradeIntentFromWebhook, validateTradeIntent } from '@/lib/tradeIntent';
import { executeTradeLifecycle } from '@/lib/tradeOrchestrator';
import { logger } from '@/lib/logger';
import { fetchAndBuildVertical } from '@/lib/tastytrade/chains';
import type { VerticalSpec } from '@/lib/tastytrade/types';

/**
 * Discord webhook payload structure.
 * This matches the expected format from 8Ball Discord alerts.
 */
interface DiscordWebhookPayload {
  /** Underlying symbol */
  underlying: string;
  /** Strategy type (Vertical, Butterfly, etc.) */
  strategy: string;
  /** Direction (CALL or PUT) */
  direction: 'CALL' | 'PUT';
  /** Strikes array [shortStrike, longStrike, wingStrike?] */
  strikes: number[];
  /** Price */
  price: number;
  /** Quantity */
  quantity: number;
  /** Optional expiry date */
  expiry?: string;
  /** Optional account ID (will use default if not provided) */
  accountId?: string;
  /** Optional rule bundle override */
  ruleBundle?: {
    takeProfitPct: number;
    stopLossPct: number;
  };
}

/**
 * Webhook validation result.
 */
interface ValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Validates whether we should execute a trade based on webhook payload.
 * 
 * This is where scheduling window logic will go.
 * For now, this is a placeholder that always returns true.
 * 
 * Future: Check if current time is within valid trading window (10:15-10:45 AM, 1:15-1:45 PM ET)
 * Future: Check autoArm/autoFire flags from PresetTemplate
 * 
 * @param payload - Webhook payload
 * @returns Validation result
 */
function validateWebhookSchedule(payload: DiscordWebhookPayload): ValidationResult {
  // TODO: Implement scheduling window validation
  // - Check current time against entryWindow for preset
  // - Validate within allowed window (10:15-10:45 AM, 1:15-1:45 PM ET)
  // - Check autoArm and autoFire flags
  
  const now = new Date();
  logger.info('Webhook schedule validation (placeholder)', {
    timestamp: now.toISOString(),
    underlying: payload.underlying,
  });

  // Placeholder: always valid
  return { valid: true };
}

/**
 * POST handler for Discord webhook.
 * 
 * Process flow:
 * 1. Parse and validate webhook payload
 * 2. Check scheduling window
 * 3. Build trade intent from alert
 * 4. Build vertical legs from spec
 * 5. Execute trade lifecycle via orchestrator
 * 6. Return result
 * 
 * @param request - Next.js request object
 * @returns JSON response with trade status
 */
export async function POST(request: Request) {
  try {
    // Parse webhook payload
    const payload: DiscordWebhookPayload = await request.json();

    // Validate payload structure
    if (!payload.underlying || !payload.strategy || !payload.strikes) {
      return NextResponse.json(
        { error: 'Invalid webhook payload: missing required fields' },
        { status: 400 }
      );
    }

    if (payload.strikes.length < 2) {
      return NextResponse.json(
        { error: 'Invalid webhook payload: strikes must have at least 2 values' },
        { status: 400 }
      );
    }

    // Validate scheduling window (placeholder)
    const scheduleValidation = validateWebhookSchedule(payload);
    if (!scheduleValidation.valid) {
      return NextResponse.json(
        { error: scheduleValidation.reason || 'Outside trading window' },
        { status: 403 }
      );
    }

    // Get account ID (placeholder - should come from session/context)
    const accountId = payload.accountId || 'default-account';
    if (!accountId) {
      return NextResponse.json(
        { error: 'Account ID required' },
        { status: 400 }
      );
    }

    // Build trade intent from webhook data
    // Use default rule bundle if not provided
    const ruleBundle = payload.ruleBundle || {
      takeProfitPct: 50,
      stopLossPct: 100,
    };

    const intent = buildTradeIntentFromWebhook(payload, accountId, ruleBundle);

    if (!validateTradeIntent(intent)) {
      return NextResponse.json(
        { error: 'Invalid trade intent constructed from webhook' },
        { status: 400 }
      );
    }

    // Build vertical legs from spec
    // Parse expiration date (use today if not provided)
    const expiration = payload.expiry || new Date().toISOString().split('T')[0];

    // Build vertical spec
    const [shortStrike, longStrike] = payload.strikes;
    const verticalSpec: VerticalSpec = {
      underlying: payload.underlying,
      expiration,
      targetDelta: 50, // Placeholder - would come from preset/config
      right: payload.direction,
      width: Math.abs(longStrike - shortStrike),
      quantity: payload.quantity,
    };

    // Fetch and build vertical
    const vertical = await fetchAndBuildVertical(verticalSpec);
    if (!vertical) {
      return NextResponse.json(
        { error: 'Failed to build vertical spread from spec' },
        { status: 400 }
      );
    }

    // Execute trade lifecycle via orchestrator
    logger.info('Executing trade from webhook', {
      intentId: intent.id,
      underlying: payload.underlying,
      strategy: payload.strategy,
    });

    const result = await executeTradeLifecycle(
      intent,
      vertical,
      {
        enableChase: true,
        attachBrackets: true,
      }
    );

    // Return result
    if (result.success) {
      return NextResponse.json({
        success: true,
        tradeId: result.trade.id,
        state: result.trade.state,
        orderId: result.order?.id,
        brackets: result.brackets,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          tradeId: result.trade.id,
          state: result.trade.state,
          error: result.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Webhook processing failed', undefined, error as Error);

    return NextResponse.json(
      {
        error: 'Failed to process webhook',
        ...(process.env.NODE_ENV === 'development' && { details: errorMessage }),
      },
      { status: 500 }
    );
  }
}
