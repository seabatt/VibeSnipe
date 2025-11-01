'use client';

import { create } from 'zustand';
import { useEffect } from 'react';

type ToastType = 'info' | 'risk' | 'profit' | 'warning';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    
    // Auto-dismiss after 5 seconds
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
    }, 5000);
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
}));

export function useToast() {
  return useToastStore((state) => state.addToast);
}

export function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  const icons: Record<ToastType, string> = {
    info: 'ℹ️',
    risk: '⚠️',
    profit: '✅',
    warning: '⚠️',
  };

  const colors: Record<ToastType, { bg: string; border: string; text: string }> = {
    info: {
      bg: 'var(--surface-alt)',
      border: 'var(--info)',
      text: 'var(--info)',
    },
    risk: {
      bg: 'var(--surface-alt)',
      border: 'var(--risk)',
      text: 'var(--risk)',
    },
    profit: {
      bg: 'var(--surface-alt)',
      border: 'var(--profit)',
      text: 'var(--profit)',
    },
    warning: {
      bg: 'var(--surface-alt)',
      border: 'var(--warning)',
      text: 'var(--warning)',
    },
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-24 z-50 space-y-8">
      {toasts.map((toast) => {
        const color = colors[toast.type];
        return (
          <div
            key={toast.id}
            className="flex items-center gap-12 px-16 py-12 rounded-md border animate-in slide-in-from-right transition-all duration-fast"
            style={{
              backgroundColor: color.bg,
              borderColor: color.border,
              color: color.text,
              boxShadow: '0 4px 8px rgba(0,0,0,0.12)',
              minWidth: '280px',
            }}
          >
            <span className="text-lg">{icons[toast.type]}</span>
            <span className="flex-1 text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-text-secondary hover:text-text-primary transition-colors duration-fast"
              style={{ fontSize: '20px', lineHeight: '1' }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}

