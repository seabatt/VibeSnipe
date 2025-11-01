'use client';

import { useState, useEffect } from 'react';
import { useQuotes } from '@/stores/useQuotes';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Navigation } from '@/components/Navigation';
import { TradeEntry } from '@/components/TradeEntry';
import { OrderPreview } from '@/components/OrderPreview';
import { DayHUD } from '@/components/DayHUD';
import { Positions } from '@/components/Positions';
import { ToastContainer } from '@/components/ui';
import dynamic from 'next/dynamic';

// Dynamically import CreateTradeV3 to avoid SSR issues
const CreateTradeV3 = dynamic(() => import('@/components/views/CreateTradeV3').then(mod => ({ default: mod.CreateTradeV3 })), {
  ssr: false,
});

// Dynamically import Dashboard to avoid SSR issues
const Dashboard = dynamic(() => import('@/components/views/Dashboard').then(mod => ({ default: mod.Dashboard })), {
  ssr: false,
});

// Dynamically import History to avoid SSR issues
const History = dynamic(() => import('@/components/views/History').then(mod => ({ default: mod.History })), {
  ssr: false,
});

// Dynamically import Settings to avoid SSR issues
const Settings = dynamic(() => import('@/components/views/Settings').then(mod => ({ default: mod.Settings })), {
  ssr: false,
});

// Dynamically import Library to avoid SSR issues
const Library = dynamic(() => import('@/components/views/Library').then(mod => ({ default: mod.Library })), {
  ssr: false,
});

type ViewId = 'home' | 'create-trade' | 'history' | 'settings' | 'library';

export default function Home() {
  const [activeView, setActiveView] = useState<ViewId>('home');
  const { subscribe, unsubscribe } = useQuotes();

  useEffect(() => {
    subscribe(['SPX', 'QQQ']);
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ⌘V / Ctrl+V - handled by DiscordPaste component
      // Enter - confirm order (handled in OrderPreview)
      if (e.key === 'Escape') {
        // Close any modals/dialogs
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <main className="min-h-screen font-sans" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-primary)' }}>
      <Navigation activeView={activeView} onViewChange={setActiveView} />

      <div className="max-w-[1400px] mx-auto">
        <ErrorBoundary>
          {activeView === 'create-trade' && (
            <div>
              {typeof window !== 'undefined' && <CreateTradeV3 />}
            {typeof window === 'undefined' && (
              <div style={{ padding: '48px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
              </div>
            )}
            </div>
          )}
          {activeView === 'home' && (
            <div>
              {typeof window !== 'undefined' && <Dashboard />}
              {typeof window === 'undefined' && (
                <div style={{ padding: '48px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
                </div>
              )}
            </div>
          )}
          {activeView === 'history' && (
            <div>
              {typeof window !== 'undefined' && <History />}
              {typeof window === 'undefined' && (
                <div style={{ padding: '48px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
                </div>
              )}
            </div>
          )}
          {activeView === 'settings' && (
            <div>
              {typeof window !== 'undefined' && <Settings />}
              {typeof window === 'undefined' && (
                <div style={{ padding: '48px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
                </div>
              )}
            </div>
          )}
          {activeView === 'library' && (
            <div>
              {typeof window !== 'undefined' && <Library />}
              {typeof window === 'undefined' && (
                <div style={{ padding: '48px', textAlign: 'center' }}>
                  <p style={{ color: 'var(--text-secondary)' }}>Loading...</p>
                </div>
              )}
            </div>
          )}
        </ErrorBoundary>
      </div>
      <ToastContainer />
    </main>
  );
}
