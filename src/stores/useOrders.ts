import { create } from 'zustand';
import { TradeLeg, RuleBundle, OrderState, Position, Underlying, StrategyKind } from '@/types';
import type { AppOrder, OrderLeg } from '@/lib/tastytrade';

export interface PendingOrder {
  legs: TradeLeg[];
  ruleBundle: RuleBundle;
  spreadPrice?: number;
  maxLoss?: number;
  maxGain?: number;
}

/**
 * Working order tracking structure.
 */
export interface WorkingOrder {
  id: string;
  accountId: string;
  status: OrderState;
  legs: TradeLeg[];
  quantity: number;
  netPrice?: number;
  createdAt: string;
  updatedAt?: string;
  error?: string;
}

interface OrdersStore {
  pendingOrder: PendingOrder | null;
  positions: Position[];
  workingOrders: WorkingOrder[];
  setPendingOrder: (order: PendingOrder | null) => void;
  addPosition: (position: Position) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  removePosition: (id: string) => void;
  subscribeToOrders: (accountId: string) => void;
  unsubscribeFromOrders: () => void;
}

/**
 * Maps OrderLeg from AppOrder to TradeLeg format.
 */
function mapOrderLegToTradeLeg(orderLeg: OrderLeg): TradeLeg {
  // Parse streamer symbol to extract strike and right
  // Format may vary: SYMBOL-EXPIRATION-STRIKE-C/P or similar
  // For now, this is a placeholder - actual parsing will depend on Tastytrade's format
  const parts = orderLeg.streamerSymbol.split('-');
  
  return {
    action: orderLeg.action.includes('SELL') ? 'SELL' : 'BUY',
    right: orderLeg.action.includes('CALL') || orderLeg.streamerSymbol.includes('C') 
      ? 'CALL' 
      : 'PUT',
    strike: 0, // Would need to parse from streamerSymbol
    expiry: '', // Would need to parse from streamerSymbol
    quantity: orderLeg.quantity,
    price: orderLeg.price,
  };
}

/**
 * Maps AppOrder to WorkingOrder format.
 */
function mapAppOrderToWorkingOrder(order: AppOrder): WorkingOrder {
  return {
    id: order.id,
    accountId: order.accountId,
    status: order.status as OrderState,
    legs: order.legs.map(mapOrderLegToTradeLeg),
    quantity: order.quantity,
    netPrice: order.netPrice,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    error: order.error,
  };
}

/**
 * Maps position update to Position format.
 * This will need to be adjusted based on actual position update structure from SSE.
 */
function mapPositionUpdateToPosition(update: any): Position | null {
  // Placeholder - actual mapping will depend on Tastytrade's position update format
  // This is a simplified version that should be expanded based on actual API
  if (!update.id || !update.legs) {
    return null;
  }

  return {
    id: update.id,
    underlying: (update.underlying || 'SPX') as Underlying,
    strategy: (update.strategy || 'Vertical') as StrategyKind,
    legs: update.legs.map((leg: any) => ({
      action: leg.action,
      right: leg.right,
      strike: leg.strike,
      expiry: leg.expiry || leg.expiration,
      quantity: leg.quantity,
      price: leg.price,
    })),
    qty: update.qty || update.quantity || 1,
    avgPrice: update.avgPrice || update.averagePrice || 0,
    pnl: update.pnl || update.profitLoss || 0,
    ruleBundle: update.ruleBundle || {
      takeProfitPct: 50,
      stopLossPct: 100,
    },
    state: (update.state || 'WORKING') as OrderState,
    openedAt: update.openedAt || update.createdAt || new Date().toISOString(),
  };
}

export const useOrders = create<OrdersStore>((set, get) => {
  let eventSource: EventSource | null = null;
  let currentAccountId: string | null = null;

  return {
    pendingOrder: null,
    positions: [],
    workingOrders: [],
    setPendingOrder: (order) => set({ pendingOrder: order }),
    addPosition: (position) =>
      set((state) => ({ positions: [...state.positions, position] })),
    updatePosition: (id, updates) =>
      set((state) => ({
        positions: state.positions.map((p) =>
          p.id === id ? { ...p, ...updates } : p
        ),
      })),
    removePosition: (id) =>
      set((state) => ({
        positions: state.positions.filter((p) => p.id !== id),
      })),
    subscribeToOrders: (accountId: string) => {
      // Cleanup existing subscription
      get().unsubscribeFromOrders();

      // Store current account ID
      currentAccountId = accountId;

      // Build SSE URL with accountId query parameter
      const url = `/api/tastytrade/stream/orders?accountId=${encodeURIComponent(accountId)}`;

      // Create EventSource connection
      eventSource = new EventSource(url);

      // Handle order updates
      eventSource.addEventListener('order', (event: MessageEvent) => {
        try {
          const orderUpdate: AppOrder = JSON.parse(event.data);
          const workingOrder = mapAppOrderToWorkingOrder(orderUpdate);

          set((state) => {
            // Update or add working order
            const existingIndex = state.workingOrders.findIndex(
              (o) => o.id === workingOrder.id
            );

            let updatedWorkingOrders: WorkingOrder[];
            if (existingIndex >= 0) {
              // Update existing order
              updatedWorkingOrders = [...state.workingOrders];
              updatedWorkingOrders[existingIndex] = workingOrder;
            } else {
              // Add new order
              updatedWorkingOrders = [...state.workingOrders, workingOrder];
            }

            // If order is filled, convert to position
            if (workingOrder.status === 'FILLED') {
              // Create position from filled order
              const position: Position = {
                id: workingOrder.id,
                underlying: 'SPX' as Underlying, // Would need to determine from legs
                strategy: 'Vertical' as StrategyKind, // Would need to determine from legs
                legs: workingOrder.legs,
                qty: workingOrder.quantity,
                avgPrice: workingOrder.netPrice || 0,
                pnl: 0,
                ruleBundle: {
                  takeProfitPct: 50,
                  stopLossPct: 100,
                },
                state: 'WORKING',
                openedAt: workingOrder.createdAt,
              };
              return {
                workingOrders: updatedWorkingOrders,
                positions: [...state.positions, position],
              };
            }

            // If order is cancelled or rejected, remove from working orders
            if (
              workingOrder.status === 'CANCELLED' ||
              workingOrder.status === 'REJECTED'
            ) {
              return {
                workingOrders: updatedWorkingOrders.filter(
                  (o) => o.id !== workingOrder.id
                ),
              };
            }

            return { workingOrders: updatedWorkingOrders };
          });
        } catch (error) {
          console.error('Error parsing order update event:', error);
        }
      });

      // Handle position updates
      eventSource.addEventListener('position', (event: MessageEvent) => {
        try {
          const positionUpdate = JSON.parse(event.data);
          const position = mapPositionUpdateToPosition(positionUpdate);

          if (!position) {
            console.warn('Invalid position update format:', positionUpdate);
            return;
          }

          set((state) => {
            // Update or add position
            const existingIndex = state.positions.findIndex(
              (p) => p.id === position.id
            );

            if (existingIndex >= 0) {
              // Update existing position
              const updatedPositions = [...state.positions];
              updatedPositions[existingIndex] = position;
              return { positions: updatedPositions };
            } else {
              // Add new position
              return { positions: [...state.positions, position] };
            }
          });
        } catch (error) {
          console.error('Error parsing position update event:', error);
        }
      });

      // Handle account updates (e.g., balance changes)
      eventSource.addEventListener('account', (event: MessageEvent) => {
        try {
          const accountUpdate = JSON.parse(event.data);
          console.log('Account update received:', accountUpdate);
          // Handle account-level updates if needed
        } catch (error) {
          console.error('Error parsing account update event:', error);
        }
      });

      // Handle connection events
      eventSource.addEventListener('connected', (event: MessageEvent) => {
        console.log('Order/account stream connected:', event.data);
      });

      // Handle errors (network/connection errors)
      eventSource.onerror = (event) => {
        console.error('Order stream connection error:', event);
        // EventSource will automatically attempt to reconnect
      };

      // Handle custom error events from server (these are SSE messages, not connection errors)
      eventSource.addEventListener('error', (event: MessageEvent) => {
        try {
          const errorData = JSON.parse(event.data);
          console.error('Order stream server error:', errorData);
        } catch (e) {
          // Ignore parse errors for non-JSON error messages
        }
      });
    },
    unsubscribeFromOrders: () => {
      // Close EventSource connection
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }

      currentAccountId = null;

      // Optionally clear working orders (may want to keep for UI)
      // set({ workingOrders: [] });
    },
  };
});
