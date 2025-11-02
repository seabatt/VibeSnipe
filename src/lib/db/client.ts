/**
 * Database client for VibeSnipe.
 * 
 * For MVP, we use an in-memory cache with JSON file persistence.
 * This provides audit trail and crash recovery without requiring a binary dependency.
 * 
 * For production scale, migrate to PostgreSQL or similar.
 * 
 * @module db/client
 */

import { EventEmitter } from 'events';
import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../logger';

/**
 * In-memory data cache.
 */
interface DataCache {
  signals: Map<string, SignalRecord>;
  decisions: Map<string, DecisionRecord>;
  tradeIntents: Map<string, TradeIntentRecord>;
  trades: Map<string, TradeRecord>;
  fills: Map<string, FillRecord>;
  riskEvents: Map<string, RiskEventRecord>;
  riskRules: Map<string, RiskRuleRecord>;
  strategyVersions: Map<string, StrategyVersionRecord>;
  portfolioState: Map<string, PortfolioStateRecord>;
}

/**
 * Raw signal record.
 */
export interface SignalRecord {
  signal_id: string;
  source: 'discord' | 'manual' | 'scheduled';
  timestamp: string;
  underlying: string;
  strategy_type: string;
  direction: 'CALL' | 'PUT';
  raw_payload: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Decision record.
 */
export interface DecisionRecord {
  decision_id: string;
  signal_id: string;
  should_trade: boolean;
  reason: string;
  trade_spec: Record<string, any> | null;
  decision_time: string;
  strategy_version?: string;
  metadata?: Record<string, any>;
}

/**
 * Trade intent record.
 */
export interface TradeIntentRecord {
  intent_id: string;
  decision_id: string;
  trade_id: string;
  intent_snapshot: {
    market_conditions: Record<string, any>;
    greeks: Record<string, number>;
  };
  built_at: string;
  strategy_version?: string;
  metadata?: Record<string, any>;
}

/**
 * Trade record (state machine instance).
 */
export interface TradeRecord {
  trade_id: string;
  intent_id: string;
  current_state: string;
  created_at: string;
  updated_at: string;
  metadata?: Record<string, any>;
}

/**
 * Fill record.
 */
export interface FillRecord {
  fill_id: string;
  trade_id: string;
  order_id: string;
  fill_price: number;
  fill_time: string;
  latency_ms: number;
  slippage: number;
  metadata?: Record<string, any>;
}

/**
 * Risk rule record.
 */
export interface RiskRuleRecord {
  rule_id: string;
  name: string;
  rule_set: string;
  priority: number;
  condition_type: 'delta_breach' | 'time_exit' | 'portfolio_limit' | 'custom';
  condition_params: Record<string, any>;
  action: 'block_trade' | 'close_trade' | 'alert';
  enabled: boolean;
  created_at: string;
}

/**
 * Risk event record.
 */
export interface RiskEventRecord {
  event_id: string;
  trade_id?: string;
  rule_name: string;
  rule_set: string;
  triggered_at: string;
  action: string;
  context: Record<string, any>;
  metadata?: Record<string, any>;
}

/**
 * Strategy version record.
 */
export interface StrategyVersionRecord {
  version_id: string;
  version_tag: string;
  chase_strategy: string;
  risk_rule_set: string;
  config: Record<string, any>;
  created_at: string;
  enabled: boolean;
}

/**
 * Portfolio state record.
 */
export interface PortfolioStateRecord {
  underlying: string;
  short_delta: number;
  net_credit: number;
  margin_usage: number;
  updated_at: string;
}

/**
 * Database singleton.
 */
class Database {
  private cache: DataCache;
  private emitter: EventEmitter;
  private persistPath: string;
  private persistInterval?: NodeJS.Timeout;

  constructor() {
    this.cache = {
      signals: new Map(),
      decisions: new Map(),
      tradeIntents: new Map(),
      trades: new Map(),
      fills: new Map(),
      riskEvents: new Map(),
      riskRules: new Map(),
      strategyVersions: new Map(),
      portfolioState: new Map(),
    };
    this.emitter = new EventEmitter();
    this.persistPath = path.join(process.cwd(), '.data');
  }

  /**
   * Initialize database.
   * Loads persisted data if available.
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.persistPath, { recursive: true });
      await this.loadPersisted();
      
      // Auto-persist every 5 seconds
      this.persistInterval = setInterval(() => {
        this.persist().catch(err => logger.error('Failed to persist data', undefined, err));
      }, 5000);
      
      logger.info('Database initialized');
    } catch (error) {
      logger.error('Failed to initialize database', undefined, error as Error);
      throw error;
    }
  }

  /**
   * Shutdown database.
   */
  async shutdown(): Promise<void> {
    if (this.persistInterval) {
      clearInterval(this.persistInterval);
    }
    await this.persist();
    logger.info('Database shutdown complete');
  }

  /**
   * Persist data to JSON files.
   */
  private async persist(): Promise<void> {
    try {
      const data = {
        signals: Array.from(this.cache.signals.values()),
        decisions: Array.from(this.cache.decisions.values()),
        tradeIntents: Array.from(this.cache.tradeIntents.values()),
        trades: Array.from(this.cache.trades.values()),
        fills: Array.from(this.cache.fills.values()),
        riskEvents: Array.from(this.cache.riskEvents.values()),
        riskRules: Array.from(this.cache.riskRules.values()),
        strategyVersions: Array.from(this.cache.strategyVersions.values()),
        portfolioState: Array.from(this.cache.portfolioState.values()),
      };

      await fs.writeFile(
        path.join(this.persistPath, 'database.json'),
        JSON.stringify(data, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error('Failed to persist database', undefined, error as Error);
    }
  }

  /**
   * Load persisted data from JSON files.
   */
  private async loadPersisted(): Promise<void> {
    try {
      const filePath = path.join(this.persistPath, 'database.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(data);

      if (parsed.signals) parsed.signals.forEach((s: SignalRecord) => this.cache.signals.set(s.signal_id, s));
      if (parsed.decisions) parsed.decisions.forEach((d: DecisionRecord) => this.cache.decisions.set(d.decision_id, d));
      if (parsed.tradeIntents) parsed.tradeIntents.forEach((t: TradeIntentRecord) => this.cache.tradeIntents.set(t.intent_id, t));
      if (parsed.trades) parsed.trades.forEach((t: TradeRecord) => this.cache.trades.set(t.trade_id, t));
      if (parsed.fills) parsed.fills.forEach((f: FillRecord) => this.cache.fills.set(f.fill_id, f));
      if (parsed.riskEvents) parsed.riskEvents.forEach((r: RiskEventRecord) => this.cache.riskEvents.set(r.event_id, r));
      if (parsed.riskRules) parsed.riskRules.forEach((r: RiskRuleRecord) => this.cache.riskRules.set(r.rule_id, r));
      if (parsed.strategyVersions) parsed.strategyVersions.forEach((s: StrategyVersionRecord) => this.cache.strategyVersions.set(s.version_id, s));
      if (parsed.portfolioState) parsed.portfolioState.forEach((p: PortfolioStateRecord) => this.cache.portfolioState.set(p.underlying, p));

      logger.info('Loaded persisted data', {
        signals: this.cache.signals.size,
        decisions: this.cache.decisions.size,
        trades: this.cache.trades.size,
      });
    } catch (error) {
      // File doesn't exist yet, start fresh
      logger.info('No persisted data found, starting fresh');
    }
  }

  // Signals
  createSignal(record: SignalRecord): void {
    this.cache.signals.set(record.signal_id, record);
    this.emitter.emit('signal:created', record);
  }

  getSignal(signal_id: string): SignalRecord | undefined {
    return this.cache.signals.get(signal_id);
  }

  getAllSignals(): SignalRecord[] {
    return Array.from(this.cache.signals.values());
  }

  // Decisions
  createDecision(record: DecisionRecord): void {
    this.cache.decisions.set(record.decision_id, record);
    this.emitter.emit('decision:created', record);
  }

  getDecision(decision_id: string): DecisionRecord | undefined {
    return this.cache.decisions.get(decision_id);
  }

  getDecisionsBySignal(signal_id: string): DecisionRecord[] {
    return Array.from(this.cache.decisions.values()).filter(d => d.signal_id === signal_id);
  }

  getAllDecisions(): DecisionRecord[] {
    return Array.from(this.cache.decisions.values());
  }

  // Trade Intents
  createTradeIntent(record: TradeIntentRecord): void {
    this.cache.tradeIntents.set(record.intent_id, record);
    this.emitter.emit('intent:created', record);
  }

  getTradeIntent(intent_id: string): TradeIntentRecord | undefined {
    return this.cache.tradeIntents.get(intent_id);
  }

  // Trades
  createTrade(record: TradeRecord): void {
    this.cache.trades.set(record.trade_id, record);
    this.emitter.emit('trade:created', record);
  }

  updateTrade(trade_id: string, updates: Partial<TradeRecord>): void {
    const existing = this.cache.trades.get(trade_id);
    if (existing) {
      const updated = { ...existing, ...updates, updated_at: new Date().toISOString() };
      this.cache.trades.set(trade_id, updated);
      this.emitter.emit('trade:updated', updated);
    }
  }

  getTrade(trade_id: string): TradeRecord | undefined {
    return this.cache.trades.get(trade_id);
  }

  getAllTrades(): TradeRecord[] {
    return Array.from(this.cache.trades.values());
  }

  // Fills
  createFill(record: FillRecord): void {
    this.cache.fills.set(record.fill_id, record);
    this.emitter.emit('fill:created', record);
  }

  getFillsByTrade(trade_id: string): FillRecord[] {
    return Array.from(this.cache.fills.values()).filter(f => f.trade_id === trade_id);
  }

  // Risk Events
  createRiskEvent(record: RiskEventRecord): void {
    this.cache.riskEvents.set(record.event_id, record);
    this.emitter.emit('risk:event', record);
  }

  getRiskEventsByTrade(trade_id: string): RiskEventRecord[] {
    return Array.from(this.cache.riskEvents.values()).filter(r => r.trade_id === trade_id);
  }

  // Strategy Versions
  createStrategyVersion(record: StrategyVersionRecord): void {
    this.cache.strategyVersions.set(record.version_id, record);
    this.emitter.emit('strategy:version:created', record);
  }

  getStrategyVersion(version_id: string): StrategyVersionRecord | undefined {
    return this.cache.strategyVersions.get(version_id);
  }

  getEnabledStrategyVersions(): StrategyVersionRecord[] {
    return Array.from(this.cache.strategyVersions.values()).filter(v => v.enabled);
  }

  // Portfolio State
  updatePortfolioState(underlying: string, state: Partial<PortfolioStateRecord>): void {
    const existing = this.cache.portfolioState.get(underlying);
    const updated = {
      underlying,
      short_delta: 0,
      net_credit: 0,
      margin_usage: 0,
      updated_at: new Date().toISOString(),
      ...existing,
      ...state,
    };
    this.cache.portfolioState.set(underlying, updated);
    this.emitter.emit('portfolio:updated', updated);
  }

  getPortfolioState(underlying: string): PortfolioStateRecord | undefined {
    return this.cache.portfolioState.get(underlying);
  }

  getAllPortfolioState(): PortfolioStateRecord[] {
    return Array.from(this.cache.portfolioState.values());
  }

  // Risk Rules
  createRiskRule(record: RiskRuleRecord): void {
    this.cache.riskRules.set(record.rule_id, record);
    this.emitter.emit('risk:rule:created', record);
  }

  getRiskRule(rule_id: string): RiskRuleRecord | undefined {
    return this.cache.riskRules.get(rule_id);
  }

  getAllRiskRules(): RiskRuleRecord[] {
    return Array.from(this.cache.riskRules.values());
  }

  getEnabledRiskRules(): RiskRuleRecord[] {
    return Array.from(this.cache.riskRules.values()).filter(r => r.enabled);
  }

  getRiskRulesBySet(rule_set: string): RiskRuleRecord[] {
    return Array.from(this.cache.riskRules.values()).filter(r => r.rule_set === rule_set);
  }

  /**
   * Subscribe to events.
   */
  on(event: string, callback: (...args: any[]) => void): void {
    this.emitter.on(event, callback);
  }

  /**
   * Unsubscribe from events.
   */
  off(event: string, callback: (...args: any[]) => void): void {
    this.emitter.off(event, callback);
  }
}

/**
 * Singleton database instance.
 */
export const db = new Database();

