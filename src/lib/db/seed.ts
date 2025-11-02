/**
 * Database seed data for initial setup.
 * 
 * @module db/seed
 */

import { db } from './client';
import type { StrategyVersionRecord, PortfolioStateRecord, RiskRuleRecord } from './client';

/**
 * Seed default strategy versions.
 */
export function seedStrategyVersions(): void {
  const versions: StrategyVersionRecord[] = [
    {
      version_id: 'v1-default',
      version_tag: 'v1.0.0-default',
      chase_strategy: 'aggressive-linear',
      risk_rule_set: 'conservative',
      config: {
        delta_target: 30,
        take_profit_pct: 50,
        stop_loss_pct: 100,
        chase_enabled: true,
        chase_steps: 10,
        chase_step_size: 0.05,
      },
      created_at: new Date().toISOString(),
      enabled: true,
    },
    {
      version_id: 'v1-aggressive',
      version_tag: 'v1.0.0-aggressive',
      chase_strategy: 'time-weighted',
      risk_rule_set: 'moderate',
      config: {
        delta_target: 50,
        take_profit_pct: 50,
        stop_loss_pct: 100,
        chase_enabled: true,
        chase_steps: 15,
        chase_step_size: 0.05,
      },
      created_at: new Date().toISOString(),
      enabled: true,
    },
  ];

  versions.forEach(v => db.createStrategyVersion(v));
}

/**
 * Seed initial portfolio state.
 */
export function seedPortfolioState(): void {
  const state: PortfolioStateRecord[] = [
    {
      underlying: 'SPX',
      short_delta: 0,
      net_credit: 0,
      margin_usage: 0,
      updated_at: new Date().toISOString(),
    },
    {
      underlying: 'QQQ',
      short_delta: 0,
      net_credit: 0,
      margin_usage: 0,
      updated_at: new Date().toISOString(),
    },
  ];

  state.forEach(s => db.updatePortfolioState(s.underlying, s));
}

/**
 * Seed default risk rules.
 */
export function seedRiskRules(): void {
  const rules: RiskRuleRecord[] = [
    {
      rule_id: 'rule-1',
      name: 'max_delta_breach',
      rule_set: 'conservative',
      priority: 1,
      condition_type: 'delta_breach',
      condition_params: { max_delta: 65 },
      action: 'block_trade',
      enabled: true,
      created_at: new Date().toISOString(),
    },
    {
      rule_id: 'rule-2',
      name: 'midday_exit',
      rule_set: 'conservative',
      priority: 2,
      condition_type: 'time_exit',
      condition_params: { exit_time: '12:00:00' },
      action: 'close_trade',
      enabled: true,
      created_at: new Date().toISOString(),
    },
    {
      rule_id: 'rule-3',
      name: 'margin_usage_limit',
      rule_set: 'conservative',
      priority: 3,
      condition_type: 'portfolio_limit',
      condition_params: { max_margin_usage: 80 },
      action: 'block_trade',
      enabled: true,
      created_at: new Date().toISOString(),
    },
    {
      rule_id: 'rule-4',
      name: 'moderate_delta_breach',
      rule_set: 'moderate',
      priority: 1,
      condition_type: 'delta_breach',
      condition_params: { max_delta: 85 },
      action: 'alert',
      enabled: true,
      created_at: new Date().toISOString(),
    },
    {
      rule_id: 'rule-5',
      name: 'moderate_margin_limit',
      rule_set: 'moderate',
      priority: 2,
      condition_type: 'portfolio_limit',
      condition_params: { max_margin_usage: 90 },
      action: 'block_trade',
      enabled: true,
      created_at: new Date().toISOString(),
    },
  ];

  rules.forEach(r => db.createRiskRule(r));
}

/**
 * Run all seed functions.
 */
export function seed(): void {
  seedStrategyVersions();
  seedPortfolioState();
  seedRiskRules();
}

