/**
 * Trade state machine for managing trade lifecycle.
 * 
 * Implements a finite-state machine pattern to ensure explicit, testable state transitions.
 * All trades progress through well-defined states: PENDING → SUBMITTED → WORKING → FILLED → OCO_ATTACHED → CLOSED
 * 
 * @module tradeStateMachine
 */

import { EventEmitter } from 'events';

/**
 * Valid trade states in the lifecycle.
 * 
 * Flow:
 * - Entry: PENDING → SUBMITTED → WORKING → FILLED → OCO_ATTACHED
 * - Exit: FILLED/OCO_ATTACHED → CLOSED
 * - Errors: Any state → CANCELLED, REJECTED, or ERROR
 */
export enum TradeState {
  /** Trade intent created but not yet submitted to broker */
  PENDING = 'PENDING',
  /** Order sent to broker, awaiting acknowledgment */
  SUBMITTED = 'SUBMITTED',
  /** Order live in market, actively working */
  WORKING = 'WORKING',
  /** Entry order successfully filled */
  FILLED = 'FILLED',
  /** OCO brackets attached after fill */
  OCO_ATTACHED = 'OCO_ATTACHED',
  /** Position closed (exit order filled) */
  CLOSED = 'CLOSED',
  /** Order cancelled before fill */
  CANCELLED = 'CANCELLED',
  /** Order rejected by broker */
  REJECTED = 'REJECTED',
  /** System error occurred */
  ERROR = 'ERROR',
}

/**
 * Valid state transitions.
 * Maps each state to the states it can transition to.
 */
const VALID_TRANSITIONS: Record<TradeState, TradeState[]> = {
  [TradeState.PENDING]: [
    TradeState.SUBMITTED,
    TradeState.CANCELLED,
    TradeState.ERROR,
  ],
  [TradeState.SUBMITTED]: [
    TradeState.WORKING,
    TradeState.FILLED,
    TradeState.REJECTED,
    TradeState.ERROR,
  ],
  [TradeState.WORKING]: [
    TradeState.FILLED,
    TradeState.CANCELLED,
    TradeState.REJECTED,
    TradeState.ERROR,
  ],
  [TradeState.FILLED]: [
    TradeState.OCO_ATTACHED,
    TradeState.CLOSED,
    TradeState.ERROR,
  ],
  [TradeState.OCO_ATTACHED]: [
    TradeState.CLOSED,
    TradeState.ERROR,
  ],
  [TradeState.CLOSED]: [], // Terminal state
  [TradeState.CANCELLED]: [], // Terminal state
  [TradeState.REJECTED]: [], // Terminal state
  [TradeState.ERROR]: [], // Terminal state
};

/**
 * State transition event data.
 */
export interface StateTransitionEvent {
  /** Trade ID */
  tradeId: string;
  /** Previous state */
  fromState: TradeState;
  /** New state */
  toState: TradeState;
  /** Timestamp of transition */
  timestamp: string;
  /** Optional error message */
  error?: string;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Trade instance managed by the state machine.
 */
export interface Trade {
  /** Unique trade ID */
  id: string;
  /** Current state */
  state: TradeState;
  /** State history (all transitions) */
  stateHistory: StateTransitionEvent[];
  /** Created timestamp */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
  /** Associated order ID (once submitted) */
  orderId?: string;
  /** Associated position ID (once filled) */
  positionId?: string;
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * State machine event emitter.
 * Emits 'transition' events when state changes occur.
 */
class TradeStateMachineEmitter extends EventEmitter {
  /**
   * Subscribe to state transition events.
   * 
   * @param event - Event name ('transition')
   * @param callback - Callback function
   * @returns this
   * 
   * @example
   * ```ts
   * tradeStateMachine.on('transition', (event: StateTransitionEvent) => {
   *   console.log(`Trade ${event.tradeId} transitioned from ${event.fromState} to ${event.toState}`);
   * });
   * ```
   */
  on(event: 'transition', callback: (event: StateTransitionEvent) => void): this;
  on(event: string, callback: (...args: any[]) => void): this {
    return super.on(event, callback);
  }

  /**
   * Remove event listener.
   * 
   * @param event - Event name
   * @param callback - Callback function
   * @returns this
   */
  off(event: string, callback: (...args: any[]) => void): this {
    return super.off(event, callback);
  }
}

/**
 * Global state machine event emitter.
 */
const stateMachineEmitter = new TradeStateMachineEmitter();

/**
 * Internal registry of all trades being managed.
 */
const trades = new Map<string, Trade>();

/**
 * Creates a new trade in the PENDING state.
 * 
 * @param tradeId - Unique trade ID
 * @param metadata - Optional metadata
 * @returns The created Trade instance
 * 
 * @example
 * ```ts
 * const trade = createTrade('trade-123', { source: 'webhook' });
 * console.log(trade.state); // 'PENDING'
 * ```
 */
export function createTrade(tradeId: string, metadata?: Record<string, any>): Trade {
  if (trades.has(tradeId)) {
    throw new Error(`Trade ${tradeId} already exists`);
  }

  const trade: Trade = {
    id: tradeId,
    state: TradeState.PENDING,
    stateHistory: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata,
  };

  trades.set(tradeId, trade);
  return trade;
}

/**
 * Retrieves a trade by ID.
 * 
 * @param tradeId - Trade ID
 * @returns The Trade instance or undefined
 */
export function getTrade(tradeId: string): Trade | undefined {
  return trades.get(tradeId);
}

/**
 * Gets all trades.
 * 
 * @returns Array of all trades
 */
export function getAllTrades(): Trade[] {
  return Array.from(trades.values());
}

/**
 * Transitions a trade to a new state.
 * 
 * Validates the transition, updates the trade state, adds to history,
 * and emits a 'transition' event.
 * 
 * @param tradeId - Trade ID
 * @param newState - Target state
 * @param error - Optional error message
 * @param metadata - Optional additional metadata
 * @returns The updated Trade instance
 * @throws Error if transition is invalid
 * 
 * @example
 * ```ts
 * const trade = transitionState('trade-123', TradeState.SUBMITTED);
 * console.log(trade.state); // 'SUBMITTED'
 * ```
 */
export function transitionState(
  tradeId: string,
  newState: TradeState,
  error?: string,
  metadata?: Record<string, any>
): Trade {
  const trade = trades.get(tradeId);
  if (!trade) {
    throw new Error(`Trade ${tradeId} not found`);
  }

  // Validate transition
  const validNextStates = VALID_TRANSITIONS[trade.state];
  if (!validNextStates.includes(newState)) {
    throw new Error(
      `Invalid transition from ${trade.state} to ${newState}. ` +
      `Valid transitions: ${validNextStates.join(', ')}`
    );
  }

  const transitionEvent: StateTransitionEvent = {
    tradeId,
    fromState: trade.state,
    toState: newState,
    timestamp: new Date().toISOString(),
    error,
    metadata,
  };

  // Update trade state
  trade.state = newState;
  trade.stateHistory.push(transitionEvent);
  trade.updatedAt = new Date().toISOString();

  // Emit transition event
  stateMachineEmitter.emit('transition', transitionEvent);

  return trade;
}

/**
 * Updates trade metadata.
 * 
 * @param tradeId - Trade ID
 * @param updates - Metadata updates
 * @returns The updated Trade instance
 */
export function updateTradeMetadata(
  tradeId: string,
  updates: Partial<Trade>
): Trade {
  const trade = trades.get(tradeId);
  if (!trade) {
    throw new Error(`Trade ${tradeId} not found`);
  }

  Object.assign(trade, updates);
  trade.updatedAt = new Date().toISOString();
  return trade;
}

/**
 * Gets the state history for a trade.
 * 
 * @param tradeId - Trade ID
 * @returns Array of state transitions
 */
export function getStateHistory(tradeId: string): StateTransitionEvent[] {
  const trade = trades.get(tradeId);
  if (!trade) {
    throw new Error(`Trade ${tradeId} not found`);
  }
  return trade.stateHistory;
}

/**
 * Checks if a transition is valid.
 * 
 * @param fromState - Source state
 * @param toState - Target state
 * @returns True if transition is valid
 */
export function isValidTransition(fromState: TradeState, toState: TradeState): boolean {
  const validNextStates = VALID_TRANSITIONS[fromState];
  return validNextStates.includes(toState);
}

/**
 * Checks if a state is terminal (no further transitions allowed).
 * 
 * @param state - State to check
 * @returns True if state is terminal
 */
export function isTerminalState(state: TradeState): boolean {
  return VALID_TRANSITIONS[state].length === 0;
}

/**
 * Subscribes to state transition events.
 * 
 * @param callback - Callback function
 * @returns Function to unsubscribe
 * 
 * @example
 * ```ts
 * const unsubscribe = onTransition((event) => {
 *   console.log(`Trade ${event.tradeId} transitioned`);
 * });
 * 
 * // Later...
 * unsubscribe();
 * ```
 */
export function onTransition(callback: (event: StateTransitionEvent) => void): () => void {
  stateMachineEmitter.on('transition', callback);
  return () => stateMachineEmitter.off('transition', callback);
}

/**
 * Removes a trade from the registry.
 * 
 * @param tradeId - Trade ID
 */
export function removeTrade(tradeId: string): void {
  trades.delete(tradeId);
}

/**
 * Clears all trades from the registry.
 * Useful for testing.
 */
export function clearAllTrades(): void {
  trades.clear();
}
