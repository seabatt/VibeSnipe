import { create } from 'zustand';
import { TradeLeg, RuleBundle, OrderState, Position } from '@/types';

export interface PendingOrder {
  legs: TradeLeg[];
  ruleBundle: RuleBundle;
  spreadPrice?: number;
  maxLoss?: number;
  maxGain?: number;
}

interface OrdersStore {
  pendingOrder: PendingOrder | null;
  positions: Position[];
  setPendingOrder: (order: PendingOrder | null) => void;
  addPosition: (position: Position) => void;
  updatePosition: (id: string, updates: Partial<Position>) => void;
  removePosition: (id: string) => void;
}

export const useOrders = create<OrdersStore>((set) => ({
  pendingOrder: null,
  positions: [],
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
}));
