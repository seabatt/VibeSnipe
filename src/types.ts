export type LegAction = 'BUY' | 'SELL';
export type LegRight = 'CALL' | 'PUT';

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
  | '8Ball Butterfly';

export type Underlying = 'SPX' | 'QQQ';

export interface ScheduledBlock {
  time: string; // "10:00"
  strategy: StrategyKind;
  underlying: Underlying;
  delta?: number;
  width?: number;
  ruleBundle?: RuleBundle;
}

export type OrderState =
  | 'PENDING'
  | 'WORKING'
  | 'FILLED'
  | 'CLOSED'
  | 'CANCELLED'
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
