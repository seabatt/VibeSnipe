/**
 * YAML risk rules loader.
 * 
 * Loads and parses YAML risk rule configurations.
 * 
 * @module risk/yamlLoader
 */

import fs from 'fs';
import path from 'path';
import { load } from 'js-yaml';
import { logger } from '../logger';
import { db } from '../db/client';
import type { RiskRuleRecord } from '../db/client';

/**
 * Load YAML risk rules configuration.
 */
export function loadRiskRulesFromYAML(filePath?: string): void {
  try {
    const configPath = filePath || path.join(process.cwd(), 'src/lib/risk/rules.yaml');
    
    if (!fs.existsSync(configPath)) {
      logger.warn('Risk rules YAML file not found', { configPath });
      return;
    }

    const fileContents = fs.readFileSync(configPath, 'utf8');
    const config = load(fileContents) as any;

    if (!config?.rules) {
      logger.warn('No rules found in YAML config');
      return;
    }

    // Load rules into database
    for (const rule of config.rules) {
      // Map condition string to condition_type enum
      let conditionType: 'delta_breach' | 'time_exit' | 'portfolio_limit' | 'custom' = 'custom';
      if (rule.condition.includes('short_delta') || rule.condition.includes('delta')) {
        conditionType = 'delta_breach';
      } else if (rule.condition.includes('time') || rule.condition.includes('hour') || rule.condition.includes('minute')) {
        conditionType = 'time_exit';
      } else if (rule.condition.includes('margin') || rule.condition.includes('credit') || rule.condition.includes('position_count')) {
        conditionType = 'portfolio_limit';
      }

      const record: RiskRuleRecord = {
        rule_id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        name: rule.name,
        enabled: rule.enabled !== false,
        priority: rule.priority || 10,
        rule_set: rule.rule_set || 'default',
        condition_type: conditionType,
        condition_params: rule.condition_params || {},
        action: rule.action,
        created_at: new Date().toISOString(),
      };

      // Check if rule already exists (by name and rule_set)
      const existing = db.getAllRiskRules().find(
        r => r.name === rule.name && r.rule_set === rule.rule_set
      );

      if (existing) {
        // Update by recreating with same ID
        const updatedRecord = {
          ...existing,
          name: record.name,
          enabled: record.enabled,
          priority: record.priority,
          rule_set: record.rule_set,
          condition_type: record.condition_type,
          condition_params: record.condition_params,
          action: record.action,
        };
        db.createRiskRule(updatedRecord);
        logger.info('Updated risk rule from YAML', { rule_id: existing.rule_id, name: rule.name });
      } else {
        db.createRiskRule(record);
        logger.info('Created risk rule from YAML', { rule_id: record.rule_id, name: rule.name });
      }
    }

    logger.info('Risk rules loaded from YAML', { count: config.rules.length });
  } catch (error) {
    logger.error('Failed to load risk rules from YAML', undefined, error as Error);
    throw error;
  }
}

/**
 * Initialize risk rules from YAML on startup.
 */
export function initializeRiskRules(): void {
  // Load from YAML
  loadRiskRulesFromYAML();

  // Also ensure seeded rules exist
  const { seedRiskRules } = require('../db/seed');
  seedRiskRules();
}

