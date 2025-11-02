/**
 * Zod validation schemas for trade data.
 * 
 * Provides runtime validation for trade intent, legs, and related structures.
 * 
 * @module validation/tradeSchemas
 */

import { z } from 'zod';

/**
 * Trade leg validation schema.
 */
export const tradeLegSchema = z.object({
  action: z.enum(['BUY', 'SELL']),
  right: z.enum(['CALL', 'PUT']),
  strike: z.number().positive(),
  expiry: z.string(),
  quantity: z.number().positive().int(),
});

/**
 * Rule bundle validation schema.
 */
export const ruleBundleSchema = z.object({
  takeProfitPct: z.number().min(0).max(100).optional(),
  stopLossPct: z.number().min(0).max(200).optional(),
});

/**
 * Trade intent validation schema.
 */
export const tradeIntentSchema = z.object({
  id: z.string(),
  legs: z.array(tradeLegSchema).min(1),
  quantity: z.number().positive().int(),
  limitPrice: z.number().positive().optional(),
  orderType: z.enum(['LIMIT', 'MARKET']),
  ruleBundle: ruleBundleSchema,
  accountId: z.string(),
  source: z.enum(['manual', 'webhook', 'scheduled']),
  strategyVersion: z.string().optional(),
  chaseStrategy: z.string().optional(),
  riskRuleSet: z.string().optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Vertical legs validation schema.
 */
export const verticalLegsSchema = z.object({
  shortLeg: z.object({
    right: z.enum(['CALL', 'PUT']),
    strike: z.number().positive(),
    expiration: z.string(),
    delta: z.number().optional(),
  }),
  longLeg: z.object({
    right: z.enum(['CALL', 'PUT']),
    strike: z.number().positive(),
    expiration: z.string(),
    delta: z.number().optional(),
  }),
});

/**
 * Chase configuration validation schema.
 */
export const chaseConfigSchema = z.object({
  stepSize: z.number().positive(),
  stepIntervalMs: z.number().positive().int(),
  maxSteps: z.number().positive().int(),
  maxSlippage: z.number().positive(),
  direction: z.enum(['up', 'down']),
  initialPrice: z.number(),
});

/**
 * Orchestration configuration validation schema.
 */
export const orchestrationConfigSchema = z.object({
  enableChase: z.boolean(),
  chaseConfig: chaseConfigSchema.optional(),
  attachBrackets: z.boolean(),
});

/**
 * Validate a trade intent.
 * 
 * @param data - Trade intent data to validate
 * @returns Validated data
 * @throws ZodError if validation fails
 */
export function validateTradeIntentData(data: unknown) {
  return tradeIntentSchema.parse(data);
}

/**
 * Validate trade legs.
 * 
 * @param legs - Trade legs to validate
 * @returns Validated legs
 * @throws ZodError if validation fails
 */
export function validateTradeLegs(legs: unknown) {
  return z.array(tradeLegSchema).parse(legs);
}

/**
 * Validate vertical legs.
 * 
 * @param verticalLegs - Vertical legs to validate
 * @returns Validated vertical legs
 * @throws ZodError if validation fails
 */
export function validateVerticalLegs(verticalLegs: unknown) {
  return verticalLegsSchema.parse(verticalLegs);
}

/**
 * Validate chase configuration.
 * 
 * @param config - Chase config to validate
 * @returns Validated config
 * @throws ZodError if validation fails
 */
export function validateChaseConfig(config: unknown) {
  return chaseConfigSchema.parse(config);
}

/**
 * Validate orchestration configuration.
 * 
 * @param config - Orchestration config to validate
 * @returns Validated config
 * @throws ZodError if validation fails
 */
export function validateOrchestrationConfig(config: unknown) {
  return orchestrationConfigSchema.parse(config);
}

/**
 * Safe validation that returns result instead of throwing.
 * 
 * @param data - Data to validate
 * @param schema - Zod schema to use
 * @returns Validation result
 */
export function safeValidate<T>(data: unknown, schema: z.ZodSchema<T>) {
  const result = schema.safeParse(data);
  if (result.success) {
    return { valid: true, data: result.data };
  } else {
    return { valid: false, errors: result.error.errors };
  }
}

