export type LegAction = 'BUY' | 'SELL';
export type LegRight = 'CALL' | 'PUT';

// Import TradeState from state machine
export { TradeState } from './lib/tradeStateMachine';
export type { TradeIntent } from './lib/tradeIntent';
export type { TradeResult } from './lib/tradeOrchestrator';

export interface TradeLeg {
  action: LegAction;
  right: LegRight;
  strike: number;
  expiry: string; // "2025-10-31"
  quantity: number;
  price?: number;
}

export interface RuleBundle {
  takeProfitPct: number; // 50 = +50%
  stopLossPct: number;   // 100 = -100%
  timeExit?: string;     // "13:00"
}

export type StrategyKind =
  | 'Vertical'
  | 'Butterfly'
  | '8Ball Vertical'
  | '8Ball Butterfly'
  | 'Iron Condor'
  | '8Ball Sonar';

export type StrategySource = 'user' | '8ball' | 'imported';

export type ExitStrategy = 'profit_target' | 'time_exit' | 'both' | 'expiration';

export type Underlying = 'SPX' | 'QQQ' | 'NDX' | 'AAPL' | 'TSLA' | 'SPY' | 'RUT';

export interface ScheduledBlock {
  id: string;
  label: string;
  windowStart: string; // "09:30"
  windowEnd: string; // "10:00"
  underlying: Underlying;
  strategy: StrategyKind;
  entryMech: 'manual_preset' | 'copy_paste' | 'auto';
  rules: { tpPct: number; slPct: number; timeExitEt?: string };
  limits: { maxTrades: number; perBlockExposureUsd: number };
  toggles?: { autoArm: boolean; autoFire: boolean };
}

/**
 * @deprecated Use TradeState from tradeStateMachine instead
 * Kept for backward compatibility
 */
export type OrderState =
  | 'PENDING'
  | 'WORKING'
  | 'FILLED'
  | 'CLOSED'
  | 'CANCELLED'
  | 'REJECTED'
  | 'ERROR';

export interface Position {
  id: string;
  underlying: Underlying;
  strategy: StrategyKind;
  legs: TradeLeg[];
  qty: number;
  avgPrice: number;
  pnl: number;
  ruleBundle: RuleBundle;
  state: OrderState;
  openedAt: string; // ISO date
}

export interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  source: StrategySource;
  underlying: Underlying;
  strategy: StrategyKind;
  direction: LegRight;
  targetDelta: number;
  width: number;
  ruleBundle: RuleBundle;
  exitStrategy: ExitStrategy;
  entryWindow?: string; // "09:00" CT
  autoArm?: boolean;
  tags?: string[];
  /** Strategy version for A/B testing */
  strategyVersion?: string;
  /** Chase strategy to use */
  chaseStrategy?: string;
  /** Risk rule set to use */
  riskRuleSet?: string;
  createdAt: string;
  lastModified?: string;
}
