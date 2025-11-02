/**
 * Tests for trade state machine.
 * 
 * Validates:
 * - State transitions
 * - Invalid transition prevention
 * - Event emission
 * - State history
 * - Error handling
 */

import {
  createTrade,
  getTrade,
  transitionState,
  getStateHistory,
  isValidTransition,
  isTerminalState,
  onTransition,
  removeTrade,
  clearAllTrades,
  TradeState,
} from '../tradeStateMachine';

describe('TradeStateMachine', () => {
  beforeEach(() => {
    // Clear all trades before each test
    clearAllTrades();
  });

  describe('createTrade', () => {
    it('should create a new trade in PENDING state', () => {
      const trade = createTrade('trade-123', { source: 'manual' });
      
      expect(trade.id).toBe('trade-123');
      expect(trade.state).toBe(TradeState.PENDING);
      expect(trade.createdAt).toBeDefined();
      expect(trade.stateHistory).toHaveLength(0);
      expect(trade.metadata?.source).toBe('manual');
    });

    it('should throw error if trade ID already exists', () => {
      createTrade('trade-123');
      
      expect(() => createTrade('trade-123')).toThrow('Trade trade-123 already exists');
    });
  });

  describe('getTrade', () => {
    it('should return created trade', () => {
      const created = createTrade('trade-123');
      const retrieved = getTrade('trade-123');
      
      expect(retrieved).toEqual(created);
    });

    it('should return undefined for non-existent trade', () => {
      const retrieved = getTrade('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('transitionState', () => {
    it('should transition from PENDING to SUBMITTED', () => {
      const trade = createTrade('trade-123');
      const updated = transitionState('trade-123', TradeState.SUBMITTED);
      
      expect(updated.state).toBe(TradeState.SUBMITTED);
      expect(updated.stateHistory).toHaveLength(1);
      expect(updated.stateHistory[0].fromState).toBe(TradeState.PENDING);
      expect(updated.stateHistory[0].toState).toBe(TradeState.SUBMITTED);
    });

    it('should reject invalid transition from PENDING to FILLED', () => {
      createTrade('trade-123');
      
      expect(() => transitionState('trade-123', TradeState.FILLED)).toThrow(
        'Invalid transition from PENDING to FILLED'
      );
    });

    it('should reject invalid transition from CLOSED to any state', () => {
      const trade = createTrade('trade-123');
      transitionState('trade-123', TradeState.SUBMITTED);
      transitionState('trade-123', TradeState.WORKING);
      transitionState('trade-123', TradeState.FILLED);
      transitionState('trade-123', TradeState.OCO_ATTACHED);
      transitionState('trade-123', TradeState.CLOSED);
      
      // CLOSED is terminal - no further transitions allowed
      expect(() => transitionState('trade-123', TradeState.WORKING)).toThrow(
        'Invalid transition from CLOSED to WORKING'
      );
    });

    it('should build complete state history', () => {
      const trade = createTrade('trade-123');
      transitionState('trade-123', TradeState.SUBMITTED);
      transitionState('trade-123', TradeState.WORKING);
      transitionState('trade-123', TradeState.FILLED);
      
      const history = getStateHistory('trade-123');
      
      expect(history).toHaveLength(3);
      expect(history[0].fromState).toBe(TradeState.PENDING);
      expect(history[0].toState).toBe(TradeState.SUBMITTED);
      expect(history[1].fromState).toBe(TradeState.SUBMITTED);
      expect(history[1].toState).toBe(TradeState.WORKING);
      expect(history[2].fromState).toBe(TradeState.WORKING);
      expect(history[2].toState).toBe(TradeState.FILLED);
    });

    it('should include error message in transition event', () => {
      const trade = createTrade('trade-123');
      const updated = transitionState('trade-123', TradeState.ERROR, 'Test error');
      
      expect(updated.stateHistory[0].error).toBe('Test error');
    });

    it('should include metadata in transition event', () => {
      const trade = createTrade('trade-123');
      const updated = transitionState(
        'trade-123',
        TradeState.SUBMITTED,
        undefined,
        { orderId: 'order-456' }
      );
      
      expect(updated.stateHistory[0].metadata).toEqual({ orderId: 'order-456' });
    });
  });

  describe('isValidTransition', () => {
    it('should return true for valid transition', () => {
      expect(isValidTransition(TradeState.PENDING, TradeState.SUBMITTED)).toBe(true);
      expect(isValidTransition(TradeState.WORKING, TradeState.FILLED)).toBe(true);
      expect(isValidTransition(TradeState.FILLED, TradeState.OCO_ATTACHED)).toBe(true);
    });

    it('should return false for invalid transition', () => {
      expect(isValidTransition(TradeState.PENDING, TradeState.FILLED)).toBe(false);
      expect(isValidTransition(TradeState.FILLED, TradeState.WORKING)).toBe(false);
      expect(isValidTransition(TradeState.CLOSED, TradeState.WORKING)).toBe(false);
    });
  });

  describe('isTerminalState', () => {
    it('should return true for terminal states', () => {
      expect(isTerminalState(TradeState.CLOSED)).toBe(true);
      expect(isTerminalState(TradeState.CANCELLED)).toBe(true);
      expect(isTerminalState(TradeState.REJECTED)).toBe(true);
      expect(isTerminalState(TradeState.ERROR)).toBe(true);
    });

    it('should return false for non-terminal states', () => {
      expect(isTerminalState(TradeState.PENDING)).toBe(false);
      expect(isTerminalState(TradeState.WORKING)).toBe(false);
      expect(isTerminalState(TradeState.FILLED)).toBe(false);
      expect(isTerminalState(TradeState.OCO_ATTACHED)).toBe(false);
    });
  });

  describe('onTransition', () => {
    it('should emit events on state transitions', (done) => {
      createTrade('trade-123');
      
      const unsubscribe = onTransition((event) => {
        expect(event.tradeId).toBe('trade-123');
        expect(event.fromState).toBe(TradeState.PENDING);
        expect(event.toState).toBe(TradeState.SUBMITTED);
        unsubscribe();
        done();
      });

      transitionState('trade-123', TradeState.SUBMITTED);
    });

    it('should allow multiple subscribers', () => {
      const events: any[] = [];
      const events2: any[] = [];
      
      const unsubscribe1 = onTransition((event) => events.push(event));
      const unsubscribe2 = onTransition((event) => events2.push(event));
      
      createTrade('trade-123');
      transitionState('trade-123', TradeState.SUBMITTED);
      
      expect(events).toHaveLength(1);
      expect(events2).toHaveLength(1);
      
      unsubscribe1();
      unsubscribe2();
    });

    it('should stop emitting after unsubscribe', () => {
      const events: any[] = [];
      const unsubscribe = onTransition((event) => events.push(event));
      
      createTrade('trade-123');
      transitionState('trade-123', TradeState.SUBMITTED);
      expect(events).toHaveLength(1);
      
      unsubscribe();
      transitionState('trade-123', TradeState.WORKING);
      expect(events).toHaveLength(1); // No new events after unsubscribe
    });
  });

  describe('removeTrade', () => {
    it('should remove trade from registry', () => {
      createTrade('trade-123');
      expect(getTrade('trade-123')).toBeDefined();
      
      removeTrade('trade-123');
      expect(getTrade('trade-123')).toBeUndefined();
    });
  });

  describe('clearAllTrades', () => {
    it('should clear all trades', () => {
      createTrade('trade-123');
      createTrade('trade-456');
      expect(getTrade('trade-123')).toBeDefined();
      expect(getTrade('trade-456')).toBeDefined();
      
      clearAllTrades();
      expect(getTrade('trade-123')).toBeUndefined();
      expect(getTrade('trade-456')).toBeUndefined();
    });
  });

  describe('state machine flow', () => {
    it('should handle complete entry flow', () => {
      const trade = createTrade('trade-123');
      transitionState('trade-123', TradeState.SUBMITTED);
      transitionState('trade-123', TradeState.WORKING);
      transitionState('trade-123', TradeState.FILLED);
      transitionState('trade-123', TradeState.OCO_ATTACHED);
      
      const updated = getTrade('trade-123');
      expect(updated?.state).toBe(TradeState.OCO_ATTACHED);
      expect(updated?.stateHistory).toHaveLength(4);
    });

    it('should handle cancellation flow', () => {
      const trade = createTrade('trade-123');
      transitionState('trade-123', TradeState.SUBMITTED);
      transitionState('trade-123', TradeState.WORKING);
      transitionState('trade-123', TradeState.CANCELLED);
      
      const updated = getTrade('trade-123');
      expect(updated?.state).toBe(TradeState.CANCELLED);
      expect(isTerminalState(updated!.state)).toBe(true);
    });

    it('should handle rejection flow', () => {
      const trade = createTrade('trade-123');
      transitionState('trade-123', TradeState.SUBMITTED);
      transitionState('trade-123', TradeState.REJECTED);
      
      const updated = getTrade('trade-123');
      expect(updated?.state).toBe(TradeState.REJECTED);
      expect(isTerminalState(updated!.state)).toBe(true);
    });

    it('should handle error flow from any state', () => {
      const trade = createTrade('trade-123');
      transitionState('trade-123', TradeState.SUBMITTED);
      transitionState('trade-123', TradeState.ERROR, 'System error');
      
      const updated = getTrade('trade-123');
      expect(updated?.state).toBe(TradeState.ERROR);
      expect(updated?.stateHistory[updated.stateHistory.length - 1].error).toBe('System error');
      expect(isTerminalState(updated!.state)).toBe(true);
    });
  });
});
