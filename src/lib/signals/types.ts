/**
 * Signal types for trade signal ingestion.
 * 
 * @module signals/types
 */

/**
 * Signal source type.
 */
export type SignalSource = 'discord' | 'manual' | 'scheduled';

/**
 * Base signal structure (normalized across all sources).
 */
export interface Signal {
  signal_id: string;
  source: SignalSource;
  timestamp: string;
  underlying: string;
  strategy_type: string;
  direction: 'CALL' | 'PUT';
  raw_payload: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Discord-specific signal payload (8Ball alert).
 */
export interface DiscordSignalPayload {
  underlying: string;
  strategy: string;
  direction: 'CALL' | 'PUT';
  strikes: number[];
  price: number;
  quantity: number;
  expiry?: string;
  accountId?: string;
  ruleBundle?: {
    takeProfitPct: number;
    stopLossPct: number;
  };
}

/**
 * Manual signal payload (from UI).
 */
export interface ManualSignalPayload {
  underlying: string;
  strategy: string;
  direction: 'CALL' | 'PUT';
  strikes: number[];
  price: number;
  quantity: number;
  expiry: string;
  accountId: string;
  ruleBundle: {
    takeProfitPct: number;
    stopLossPct: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Scheduled signal payload (from schedule system).
 */
export interface ScheduledSignalPayload {
  underlying: string;
  strategy: string;
  direction: 'CALL' | 'PUT';
  schedule: {
    entryWindow: string;
    exitWindow?: string;
  };
  ruleBundle: {
    takeProfitPct: number;
    stopLossPct: number;
  };
  metadata?: Record<string, any>;
}

/**
 * Signal validation result.
 */
export interface SignalValidationResult {
  valid: boolean;
  reason?: string;
}

