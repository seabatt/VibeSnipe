'use client';

import { useState, useEffect } from 'react';
import { Home, Sparkles, History as HistoryIcon, Settings as SettingsIcon, BookOpen, Menu, X } from 'lucide-react';
import { useTokens } from '@/hooks/useTokens';

type ViewId = 'home' | 'create-trade' | 'history' | 'settings' | 'library';

interface NavigationProps {
  activeView: ViewId;
  onViewChange: (view: ViewId) => void;
}

export function Navigation({ activeView, onViewChange }: NavigationProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const tokens = useTokens();
  const colors = tokens.colors;
  
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const views = [
    { id: 'home' as ViewId, label: 'Home', icon: Home },
    { id: 'create-trade' as ViewId, label: 'Create Trade', icon: Sparkles },
    { id: 'history' as ViewId, label: 'History', icon: HistoryIcon },
    { id: 'settings' as ViewId, label: 'Settings', icon: SettingsIcon },
    { id: 'library' as ViewId, label: 'Library', icon: BookOpen },
  ];

  const handleViewChange = (viewId: ViewId) => {
    onViewChange(viewId);
    setMobileMenuOpen(false);
  };

  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        backgroundColor: `${colors.bg}cc`,
        backdropFilter: 'blur(12px)',
        borderBottom: `1px solid ${colors.border}`,
      }}
    >
      <div style={{ maxWidth: '1400px', margin: '0 auto', padding: isMobile ? `${tokens.space.md}px ${tokens.space.lg}px` : `${tokens.space.md}px ${tokens.space.xl}px` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          {/* Brand */}
          <div>
            <h1 style={{ fontSize: isMobile ? `${tokens.type.sizes.base}px` : `${tokens.type.sizes.lg}px`, color: colors.textPrimary, fontWeight: tokens.type.weights.medium, margin: 0 }}>
              VibeSnipe
            </h1>
            {!isMobile && (
              <p style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, margin: 0, marginTop: `${tokens.space.xs}px` }}>
                Industrial Calm · Options Trading
              </p>
            )}
          </div>

          {/* Desktop Navigation */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.sm}px` }}>
              {views.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => handleViewChange(id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: `${tokens.space.sm}px`,
                    padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
                    borderRadius: `${tokens.radius.md}px`,
                    border: `1px solid ${activeView === id ? colors.border : colors.border}`,
                    backgroundColor: activeView === id ? colors.surface : 'transparent',
                    color: activeView === id ? colors.textPrimary : colors.textSecondary,
                    cursor: 'pointer',
                    fontSize: `${tokens.type.sizes.sm}px`,
                    transition: tokens.motion.base,
                    minHeight: '40px',
                  }}
                  onMouseEnter={(e) => {
                    if (activeView !== id) {
                      e.currentTarget.style.backgroundColor = colors.surfaceAlt;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeView !== id) {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <Icon size={16} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Mobile Menu Button */}
          {isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.md}px` }}>
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                style={{
                  padding: `${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.md}px`,
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  color: colors.textPrimary,
                  cursor: 'pointer',
                }}
              >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          )}
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobile && mobileMenuOpen && (
          <div
            style={{
              marginTop: `${tokens.space.md}px`,
              paddingTop: `${tokens.space.md}px`,
              borderTop: `1px solid ${colors.border}`,
              display: 'grid',
              gap: `${tokens.space.sm}px`,
            }}
          >
            {views.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => handleViewChange(id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: `${tokens.space.md}px`,
                  padding: `${tokens.space.md}px ${tokens.space.lg}px`,
                  borderRadius: `${tokens.radius.md}px`,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: activeView === id ? colors.surface : colors.surfaceAlt,
                  color: activeView === id ? colors.textPrimary : colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: `${tokens.type.sizes.sm}px`,
                  transition: tokens.motion.base,
                }}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

