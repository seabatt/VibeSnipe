/**
 * Risk rule engine.
 * 
 * Evaluates database-stored risk rules against trade and portfolio context.
 * Returns which rules triggered and what actions to take.
 * 
 * @module risk/ruleEngine
 */

import { db } from '../db/client';
import type { RiskRuleRecord } from '../db/client';
import { createRiskEvent } from '../db/services/riskService';
import { logger } from '../logger';
import type { TradeSpec } from '../decision/types';

/**
 * Evaluation context for risk rules.
 */
export interface RuleEvaluationContext {
  /** Trade being evaluated */
  trade: {
    underlying: string;
    strategy: string;
    direction: 'CALL' | 'PUT';
    strikes: number[];
    quantity: number;
    target_delta: number;
  };
  /** Current portfolio exposure */
  portfolio: {
    underlying: string;
    short_delta: number;
    net_credit: number;
    margin_usage: number;
  };
  /** Current time (for time-based rules) */
  time?: Date;
}

/**
 * Rule evaluation result.
 */
export interface RuleEvaluationResult {
  /** Whether rules passed */
  passed: boolean;
  /** Rules that triggered */
  triggered_rules: {
    rule_id: string;
    rule_name: string;
    action: string;
    reason: string;
  }[];
  /** Actions to take (highest priority) */
  actions: string[];
  /** Blocking reason (if any) */
  blocking_reason?: string;
}

/**
 * Evaluate risk rules against context.
 */
export function evaluateRules(
  context: RuleEvaluationContext,
  ruleSet?: string
): RuleEvaluationResult {
  // Load enabled rules (from specific set or all)
  let rules: RiskRuleRecord[];
  if (ruleSet) {
    rules = db.getRiskRulesBySet(ruleSet).filter(r => r.enabled);
  } else {
    rules = db.getEnabledRiskRules();
  }

  // Sort by priority (lower number = higher priority)
  rules.sort((a, b) => a.priority - b.priority);

  const triggeredRules: RuleEvaluationResult['triggered_rules'] = [];
  const actions: string[] = [];

  // Evaluate each rule
  for (const rule of rules) {
    const result = evaluateRule(rule, context);
    
    if (result.triggered) {
      triggeredRules.push({
        rule_id: rule.rule_id,
        rule_name: rule.name,
        action: rule.action,
        reason: result.reason,
      });

      actions.push(rule.action);

      // Log risk event to database
      createRiskEvent({
        trade_id: undefined, // Trade hasn't been created yet
        rule_name: rule.name,
        rule_set: rule.rule_set,
        action: rule.action,
        context: {
          underlying: context.trade.underlying,
          strategy: context.trade.strategy,
          short_delta: context.portfolio.short_delta,
        },
        metadata: {
          condition_params: rule.condition_params,
        },
      });

      logger.warn('Risk rule triggered', {
        rule_name: rule.name,
        action: rule.action,
        reason: result.reason,
      });

      // Blocking actions stop evaluation
      if (rule.action === 'block_trade') {
        return {
          passed: false,
          triggered_rules: triggeredRules,
          actions,
          blocking_reason: result.reason,
        };
      }
    }
  }

  // All rules passed
  return {
    passed: triggeredRules.length === 0,
    triggered_rules: triggeredRules,
    actions,
  };
}

/**
 * Evaluate a single rule.
 */
interface RuleCheckResult {
  triggered: boolean;
  reason: string;
}

function evaluateRule(
  rule: RiskRuleRecord,
  context: RuleEvaluationContext
): RuleCheckResult {
  const { condition_type, condition_params } = rule;

  switch (condition_type) {
    case 'delta_breach':
      return evaluateDeltaBreach(condition_params, context);

    case 'time_exit':
      return evaluateTimeExit(condition_params, context);

    case 'portfolio_limit':
      return evaluatePortfolioLimit(condition_params, context);

    case 'custom':
      return evaluateCustomRule(condition_params, context);

    default:
      logger.warn('Unknown rule condition type', { type: condition_type });
      return { triggered: false, reason: 'Unknown condition type' };
  }
}

/**
 * Evaluate delta breach rule.
 */
function evaluateDeltaBreach(
  params: Record<string, any>,
  context: RuleEvaluationContext
): RuleCheckResult {
  const maxDelta = params.max_delta || 65; // Default 0.65 delta
  const currentDelta = Math.abs(context.portfolio.short_delta);

  if (currentDelta > maxDelta) {
    return {
      triggered: true,
      reason: `Short delta ${currentDelta} exceeds max ${maxDelta}`,
    };
  }

  return { triggered: false, reason: 'Delta within limits' };
}

/**
 * Evaluate time exit rule.
 */
function evaluateTimeExit(
  params: Record<string, any>,
  context: RuleEvaluationContext
): RuleCheckResult {
  if (!context.time) {
    return { triggered: false, reason: 'No time context' };
  }

  const exitTime = params.exit_time; // e.g., "12:00:00"
  if (!exitTime) {
    return { triggered: false, reason: 'No exit time configured' };
  }

  const [exitHour, exitMin] = exitTime.split(':').map(Number);
  const currentHour = context.time.getHours();
  const currentMin = context.time.getMinutes();

  if (currentHour > exitHour || (currentHour === exitHour && currentMin >= exitMin)) {
    return {
      triggered: true,
      reason: `Current time ${context.time.toTimeString()} past exit time ${exitTime}`,
    };
  }

  return { triggered: false, reason: 'Within trading window' };
}

/**
 * Evaluate portfolio limit rule.
 */
function evaluatePortfolioLimit(
  params: Record<string, any>,
  context: RuleEvaluationContext
): RuleCheckResult {
  const maxPositionSize = params.max_position_size || 10000; // Default $10k
  const maxMarginUsage = params.max_margin_usage || 80; // Default 80%

  // Check position size (simplified - would need actual position value)
  // For now, just check margin usage
  if (context.portfolio.margin_usage > maxMarginUsage) {
    return {
      triggered: true,
      reason: `Margin usage ${context.portfolio.margin_usage}% exceeds max ${maxMarginUsage}%`,
    };
  }

  return { triggered: false, reason: 'Within portfolio limits' };
}

/**
 * Evaluate custom rule.
 */
function evaluateCustomRule(
  params: Record<string, any>,
  context: RuleEvaluationContext
): RuleCheckResult {
  // Custom rules would have their own evaluation logic
  // For now, always pass
  logger.warn('Custom rule evaluation not implemented', { params });
  return { triggered: false, reason: 'Custom rule not implemented' };
}

