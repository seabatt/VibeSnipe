/**
 * Zustand store for trade state machine.
 * 
 * Provides reactive UI updates by wrapping the core state machine
 * with Zustand. This allows components to subscribe to trade state changes
 * and provides convenient actions for trade management.
 * 
 * @module useTradeStateMachine
 */

import { create } from 'zustand';
import {
  getTrade,
  getAllTrades,
  createTrade as coreCreateTrade,
  transitionState as coreTransitionState,
  onTransition as coreOnTransition,
  type Trade,
  type TradeState,
  type StateTransitionEvent,
} from '@/lib/tradeStateMachine';

/**
 * Trade state machine store interface.
 */
interface TradeStateMachineStore {
  /** All trades being tracked */
  trades: Map<string, Trade>;
  /** Map of trade IDs to their current state */
  tradeStates: Map<string, TradeState>;
  /** Whether store is initialized */
  initialized: boolean;
  /** Initialize the store and subscribe to state machine events */
  initialize: () => void;
  /** Create a new trade */
  createTrade: (tradeId: string, metadata?: Record<string, any>) => Trade;
  /** Get a trade by ID */
  getTrade: (tradeId: string) => Trade | undefined;
  /** Get all trades */
  getAllTrades: () => Trade[];
  /** Manually transition a trade (for testing or manual overrides) */
  transitionState: (
    tradeId: string,
    newState: TradeState,
    error?: string,
    metadata?: Record<string, any>
  ) => Trade;
  /** Refresh trades from state machine */
  refreshTrades: () => void;
  /** Subscribe to state transitions (for external monitoring) */
  subscribe: (callback: (event: StateTransitionEvent) => void) => () => void;
}

/**
 * Create the trade state machine store.
 */
export const useTradeStateMachine = create<TradeStateMachineStore>((set, get) => {
  // Subscription cleanup function
  let unsubscribe: (() => void) | null = null;

  return {
    trades: new Map(),
    tradeStates: new Map(),
    initialized: false,

    /**
     * Initialize the store and subscribe to state machine events.
     */
    initialize: () => {
      const state = get();
      
      if (state.initialized) {
        return; // Already initialized
      }

      // Subscribe to state machine transitions
      unsubscribe = coreOnTransition((event: StateTransitionEvent) => {
        // Update trades map
        const trade = getTrade(event.tradeId);
        if (trade) {
          state.trades.set(event.tradeId, trade);
          state.tradeStates.set(event.tradeId, event.toState);
          
          // Trigger re-render by updating store
          set({
            trades: new Map(state.trades),
            tradeStates: new Map(state.tradeStates),
          });
        }
      });

      // Mark as initialized
      set({ initialized: true });

      // Initial refresh
      state.refreshTrades();
    },

    /**
     * Create a new trade in the state machine.
     */
    createTrade: (tradeId: string, metadata?: Record<string, any>) => {
      const state = get();
      
      // Ensure initialized
      if (!state.initialized) {
        state.initialize();
      }

      // Create trade in core state machine
      const trade = coreCreateTrade(tradeId, metadata);
      
      // Update store
      state.trades.set(tradeId, trade);
      state.tradeStates.set(tradeId, trade.state);
      
      set({
        trades: new Map(state.trades),
        tradeStates: new Map(state.tradeStates),
      });

      return trade;
    },

    /**
     * Get a trade by ID.
     */
    getTrade: (tradeId: string) => {
      const state = get();
      return state.trades.get(tradeId);
    },

    /**
     * Get all trades.
     */
    getAllTrades: () => {
      const state = get();
      return Array.from(state.trades.values());
    },

    /**
     * Manually transition a trade state.
     */
    transitionState: (
      tradeId: string,
      newState: TradeState,
      error?: string,
      metadata?: Record<string, any>
    ) => {
      const state = get();
      
      // Ensure initialized
      if (!state.initialized) {
        state.initialize();
      }

      // Transition in core state machine
      const trade = coreTransitionState(tradeId, newState, error, metadata);
      
      // Update store
      state.trades.set(tradeId, trade);
      state.tradeStates.set(tradeId, trade.state);
      
      set({
        trades: new Map(state.trades),
        tradeStates: new Map(state.tradeStates),
      });

      return trade;
    },

    /**
     * Refresh trades from state machine.
     */
    refreshTrades: () => {
      const state = get();
      
      const allTrades = getAllTrades();
      const newTrades = new Map<string, Trade>();
      const newTradeStates = new Map<string, TradeState>();

      for (const trade of allTrades) {
        newTrades.set(trade.id, trade);
        newTradeStates.set(trade.id, trade.state);
      }

      set({
        trades: newTrades,
        tradeStates: newTradeStates,
      });
    },

    /**
     * Subscribe to state transitions.
     */
    subscribe: (callback: (event: StateTransitionEvent) => void) => {
      const state = get();
      
      // Ensure initialized
      if (!state.initialized) {
        state.initialize();
      }

      // Return subscription function
      return coreOnTransition(callback);
    },
  };
});

/**
 * Hook to get all trades as an array.
 * 
 * @returns Array of all trades
 */
export function useAllTrades(): Trade[] {
  return useTradeStateMachine((state) => state.getAllTrades());
}

/**
 * Hook to get a specific trade by ID.
 * 
 * @param tradeId - Trade ID
 * @returns Trade or undefined
 */
export function useTrade(tradeId: string): Trade | undefined {
  return useTradeStateMachine((state) => state.getTrade(tradeId));
}

/**
 * Hook to get trade state by ID.
 * 
 * @param tradeId - Trade ID
 * @returns Trade state or undefined
 */
export function useTradeState(tradeId: string): TradeState | undefined {
  return useTradeStateMachine((state) => state.tradeStates.get(tradeId));
}
