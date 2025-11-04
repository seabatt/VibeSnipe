import type { TradeHistoryRecord } from '@/lib/tradeHistoryService';
import { TradeState } from '@/lib/tradeStateMachine';

export interface TradeHistory {
  id: string;
  date: string;
  time: string;
  underlying: 'SPX' | 'QQQ' | 'NDX' | 'AAPL' | 'TSLA' | 'SPY' | 'RUT';
  strategy: string;
  entry: number;
  exit: number;
  plDollar: number;
  plPercent: number;
  exitReason: 'TP' | 'SL' | 'TIME' | 'MANUAL';
  duration: number; // minutes
  notes: string;
  state: TradeState;
  chaseInfo?: {
    attempts: number;
    initialPrice: number;
    finalPrice?: number;
    totalTimeMs: number;
    strategy: string;
  };
  hasBrackets: boolean;
  originalRecord: TradeHistoryRecord;
}

