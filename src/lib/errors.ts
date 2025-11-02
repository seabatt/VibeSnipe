/**
 * Custom error classes for domain-specific errors.
 * 
 * These provide better error handling and debugging than generic Error objects.
 */

/**
 * Base class for all VibeSnipe errors.
 */
export class VibeSnipeError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Thrown when an order is rejected by the broker.
 */
export class OrderRejectionError extends VibeSnipeError {
  constructor(
    message: string,
    public readonly orderId?: string,
    public readonly reason?: string
  ) {
    super(message, 'ORDER_REJECTED');
  }
}

/**
 * Thrown when account has insufficient buying power.
 */
export class InsufficientBuyingPowerError extends VibeSnipeError {
  constructor(
    message: string,
    public readonly required: number,
    public readonly available: number
  ) {
    super(message, 'INSUFFICIENT_BUYING_POWER');
  }
}

/**
 * Thrown when option chain fetch fails.
 */
export class ChainFetchError extends VibeSnipeError {
  constructor(
    message: string,
    public readonly symbol: string,
    public readonly expiration: string
  ) {
    super(message, 'CHAIN_FETCH_FAILED');
  }
}

/**
 * Thrown when alert format is invalid.
 */
export class InvalidAlertFormatError extends VibeSnipeError {
  constructor(
    message: string,
    public readonly alertText: string
  ) {
    super(message, 'INVALID_ALERT_FORMAT');
  }
}

/**
 * Thrown when validation fails for risk rules.
 */
export class RiskRuleViolationError extends VibeSnipeError {
  constructor(
    message: string,
    public readonly rule: string,
    public readonly value: number,
    public readonly threshold: number
  ) {
    super(message, 'RISK_RULE_VIOLATION');
  }
}

/**
 * Thrown when trade is outside allowed time window.
 */
export class TimeWindowViolationError extends VibeSnipeError {
  constructor(
    message: string,
    public readonly currentTime: string,
    public readonly allowedWindows: string[]
  ) {
    super(message, 'TIME_WINDOW_VIOLATION');
  }
}

/**
 * Thrown when strike/delta not found in chain.
 */
export class StrikeNotFoundError extends VibeSnipeError {
  constructor(
    message: string,
    public readonly targetDelta?: number,
    public readonly targetStrike?: number
  ) {
    super(message, 'STRIKE_NOT_FOUND');
  }
}

/**
 * Thrown when API authentication fails.
 */
export class AuthenticationError extends VibeSnipeError {
  constructor(message: string) {
    super(message, 'AUTHENTICATION_FAILED');
  }
}

/**
 * Thrown when API rate limit is exceeded.
 */
export class RateLimitError extends VibeSnipeError {
  constructor(
    message: string,
    public readonly retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * Thrown when WebSocket connection fails.
 */
export class ConnectionError extends VibeSnipeError {
  constructor(
    message: string,
    public readonly endpoint: string
  ) {
    super(message, 'CONNECTION_FAILED');
  }
}

/**
 * Type guard to check if error is a VibeSnipe error.
 */
export function isVibeSnipeError(error: unknown): error is VibeSnipeError {
  return error instanceof VibeSnipeError;
}

/**
 * Helper to safely extract error message from unknown error.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unknown error occurred';
}

/**
 * Helper to safely extract error code from unknown error.
 */
export function getErrorCode(error: unknown): string | undefined {
  if (isVibeSnipeError(error)) {
    return error.code;
  }
  return undefined;
}

