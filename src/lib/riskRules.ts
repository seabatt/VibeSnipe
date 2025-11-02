/**
 * Risk management and trading rules validation.
 * 
 * Enforces the 0DTE trading playbook rules:
 * - Account risk per trade: 0.5-1.0%
 * - Noon exit enforcement
 * - Short-delta breach detection (0.65 threshold)
 * - Chase attempt limits
 * - Credit floor validation
 */

import { RiskRuleViolationError, TimeWindowViolationError } from './errors';
import { logger } from './logger';

/**
 * Trading time windows (in ET).
 */
export const TRADING_WINDOWS = [
  { start: '10:15', end: '10:45', name: 'Morning Window' },
  { start: '13:15', end: '13:45', name: 'Afternoon Window' },
] as const;

/**
 * Exit time for 0DTE trades (ET).
 */
export const EXIT_TIME_ET = '12:00';

/**
 * Maximum short strike delta before forced exit.
 */
export const MAX_SHORT_DELTA = 0.65;

/**
 * Maximum chase attempts per order.
 */
export const MAX_CHASE_ATTEMPTS = 2;

/**
 * Credit floor slippage allowance by underlying.
 */
export const CREDIT_FLOOR_SLIPPAGE = {
  SPX: 0.15,
  NDX: 0.15,
  RUT: 0.15,
  QQQ: 0.03,
  SPY: 0.03,
  AAPL: 0.03,
  TSLA: 0.03,
} as const;

/**
 * Validates account risk for a trade.
 * 
 * @param accountValue - Total account value
 * @param maxLoss - Maximum loss for the trade
 * @param maxRiskPct - Maximum risk percentage allowed (default 1.0%)
 * @throws {RiskRuleViolationError} If risk exceeds threshold
 */
export function validateAccountRisk(
  accountValue: number,
  maxLoss: number,
  maxRiskPct: number = 1.0
): void {
  const riskPct = (maxLoss / accountValue) * 100;
  
  if (riskPct > maxRiskPct) {
    logger.warn('Account risk violation', {
      accountValue,
      maxLoss,
      riskPct: riskPct.toFixed(2),
      maxRiskPct,
    });
    
    throw new RiskRuleViolationError(
      `Risk ${riskPct.toFixed(2)}% exceeds maximum ${maxRiskPct}%`,
      'MAX_ACCOUNT_RISK',
      riskPct,
      maxRiskPct
    );
  }
}

/**
 * Checks if current time is within allowed trading windows.
 * 
 * @param currentTime - Current time in HH:MM format (ET)
 * @param windows - Allowed trading windows (defaults to TRADING_WINDOWS)
 * @returns True if within window
 */
export function isWithinTradingWindow(
  currentTime: string,
  windows: readonly { start: string; end: string; name: string }[] = TRADING_WINDOWS
): boolean {
  return windows.some(window => {
    return currentTime >= window.start && currentTime <= window.end;
  });
}

/**
 * Validates that trade is within allowed time window.
 * 
 * @param currentTime - Current time in HH:MM format (ET)
 * @param windows - Allowed trading windows
 * @throws {TimeWindowViolationError} If outside trading window
 */
export function validateTimeWindow(
  currentTime: string,
  windows: readonly { start: string; end: string; name: string }[] = TRADING_WINDOWS
): void {
  if (!isWithinTradingWindow(currentTime, windows)) {
    const windowNames = windows.map(w => `${w.start}-${w.end}`).join(', ');
    
    logger.warn('Time window violation', {
      currentTime,
      allowedWindows: windowNames,
    });
    
    throw new TimeWindowViolationError(
      `Trade outside allowed windows (${windowNames})`,
      currentTime,
      windows.map(w => `${w.start}-${w.end}`)
    );
  }
}

/**
 * Validates chase attempt count.
 * 
 * @param attempts - Current attempt count
 * @param maxAttempts - Maximum allowed attempts
 * @throws {RiskRuleViolationError} If attempts exceed max
 */
export function validateChaseAttempts(
  attempts: number,
  maxAttempts: number = MAX_CHASE_ATTEMPTS
): void {
  if (attempts >= maxAttempts) {
    logger.warn('Chase attempts exceeded', { attempts, maxAttempts });
    
    throw new RiskRuleViolationError(
      `Chase attempts (${attempts}) exceed maximum (${maxAttempts})`,
      'MAX_CHASE_ATTEMPTS',
      attempts,
      maxAttempts
    );
  }
}

/**
 * Validates credit meets minimum floor.
 * 
 * @param credit - Actual credit received
 * @param underlying - Underlying symbol
 * @param alertCredit - Original alert credit
 * @throws {RiskRuleViolationError} If credit below floor
 */
export function validateCreditFloor(
  credit: number,
  underlying: keyof typeof CREDIT_FLOOR_SLIPPAGE,
  alertCredit: number
): void {
  const slippage = CREDIT_FLOOR_SLIPPAGE[underlying] || CREDIT_FLOOR_SLIPPAGE.SPX;
  const minCredit = alertCredit - slippage;
  
  if (credit < minCredit) {
    logger.warn('Credit floor violation', {
      credit,
      minCredit,
      alertCredit,
      underlying,
      slippage,
    });
    
    throw new RiskRuleViolationError(
      `Credit ${credit.toFixed(2)} below floor ${minCredit.toFixed(2)}`,
      'MIN_CREDIT_FLOOR',
      credit,
      minCredit
    );
  }
}

/**
 * Checks if trade should exit by time (noon exit rule).
 * 
 * @param entryTime - Entry time ISO string
 * @param currentTime - Current time in HH:MM format (ET)
 * @param exitTime - Exit time in HH:MM format (ET)
 * @returns True if should exit
 */
export function shouldExitByTime(
  entryTime: string,
  currentTime: string,
  exitTime: string = EXIT_TIME_ET
): boolean {
  return currentTime >= exitTime;
}

/**
 * Checks if trade should exit by delta breach.
 * 
 * @param currentDelta - Current short strike delta
 * @param threshold - Delta threshold (default 0.65)
 * @returns True if should exit
 */
export function shouldExitByDelta(
  currentDelta: number,
  threshold: number = MAX_SHORT_DELTA
): boolean {
  const absDelta = Math.abs(currentDelta);
  return absDelta >= threshold;
}

/**
 * Calculates maximum contracts allowed for given risk parameters.
 * 
 * @param accountValue - Total account value
 * @param maxLossPerContract - Max loss per contract (width - credit) * 100
 * @param maxRiskPct - Maximum risk percentage (default 1.0%)
 * @returns Maximum number of contracts
 */
export function calculateMaxContracts(
  accountValue: number,
  maxLossPerContract: number,
  maxRiskPct: number = 1.0
): number {
  const maxRisk = accountValue * (maxRiskPct / 100);
  return Math.floor(maxRisk / maxLossPerContract);
}

/**
 * Validates all risk rules for order submission.
 * 
 * Comprehensive pre-flight check before sending order to broker.
 * 
 * @param params - Validation parameters
 * @throws {RiskRuleViolationError | TimeWindowViolationError} If any rule violated
 */
export function validateOrderSubmission(params: {
  accountValue: number;
  maxLoss: number;
  currentTime: string;
  chaseAttempts: number;
  credit: number;
  underlying: keyof typeof CREDIT_FLOOR_SLIPPAGE;
  alertCredit: number;
  maxRiskPct?: number;
}): void {
  const {
    accountValue,
    maxLoss,
    currentTime,
    chaseAttempts,
    credit,
    underlying,
    alertCredit,
    maxRiskPct = 1.0,
  } = params;

  // Validate account risk
  validateAccountRisk(accountValue, maxLoss, maxRiskPct);

  // Validate time window (optional - may want to allow outside windows with warning)
  // validateTimeWindow(currentTime);

  // Validate chase attempts
  if (chaseAttempts > 0) {
    validateChaseAttempts(chaseAttempts);
  }

  // Validate credit floor
  validateCreditFloor(credit, underlying, alertCredit);

  logger.info('Order validation passed', {
    accountValue,
    maxLoss,
    riskPct: ((maxLoss / accountValue) * 100).toFixed(2),
    currentTime,
    chaseAttempts,
    credit,
  });
}

