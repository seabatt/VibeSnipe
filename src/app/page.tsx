'use client';

import { useState, useEffect } from 'react';
import { useQuotes } from '@/stores/useQuotes';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Navigation } from '@/components/Navigation';
import { ToastContainer } from '@/components/ui';
import dynamic from 'next/dynamic';

// Dynamically import all views with no SSR to prevent hydration issues
const CreateTradeV3 = dynamic(() => import('@/components/views/CreateTradeV3').then(mod => ({ default: mod.CreateTradeV3 })), {
  ssr: false,
});

const Dashboard = dynamic(() => import('@/components/views/Dashboard').then(mod => ({ default: mod.Dashboard })), {
  ssr: false,
});

const History = dynamic(() => import('@/components/views/History').then(mod => ({ default: mod.History })), {
  ssr: false,
});

const Settings = dynamic(() => import('@/components/views/Settings').then(mod => ({ default: mod.Settings })), {
  ssr: false,
});

const Library = dynamic(() => import('@/components/views/Library').then(mod => ({ default: mod.Library })), {
  ssr: false,
});

type ViewId = 'home' | 'create-trade' | 'history' | 'settings' | 'library';

export default function Home() {
  const [activeView, setActiveView] = useState<ViewId>('home');
  const [mounted, setMounted] = useState(false);
  const { subscribe, unsubscribe } = useQuotes();

  useEffect(() => {
    setMounted(true);
    subscribe(['SPX', 'QQQ']);
    return () => unsubscribe();
  }, [subscribe, unsubscribe]);

  useEffect(() => {
    if (!mounted) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Close any modals/dialogs
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mounted]);

  if (!mounted) {
    return (
      <main className="min-h-screen font-sans">
        <div style={{ padding: '48px', textAlign: 'center' }}>
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen font-sans">
      <Navigation activeView={activeView} onViewChange={setActiveView} />
      <ErrorBoundary>
        {activeView === 'create-trade' && <CreateTradeV3 />}
        {activeView === 'home' && <Dashboard />}
        {activeView === 'history' && <History />}
        {activeView === 'settings' && <Settings />}
        {activeView === 'library' && <Library />}
      </ErrorBoundary>
      <ToastContainer />
    </main>
  );
}
