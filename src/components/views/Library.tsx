'use client';

import { useState, useEffect } from 'react';
import { BookOpen, Plus, Trash2, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useTokens } from '@/hooks/useTokens';
import { useIsMobile } from '@/components/ui/use-mobile';
import { useToast } from '@/components/ui';
import type { PresetTemplate } from '@/types';

const MOCK_TEMPLATES: PresetTemplate[] = [
  {
    id: '1',
    name: 'SPX 50Δ 10-Wide Put Vertical (Max P&L)',
    description: 'Highest average P&L: 91% win rate, $73.83 avg P&L. Based on 2.5yr backtest. Close at noon if TP not hit.',
    underlying: 'SPX',
    strategy: 'Vertical',
    direction: 'PUT',
    targetDelta: 50,
    width: 10,
    ruleBundle: {
      takeProfitPct: 50,
      stopLossPct: 100,
      timeExit: '12:00',
    },
    exitStrategy: 'both',
    entryWindow: '09:00',
    source: 'user',
    autoArm: false,
    tags: ['0DTE', 'high-pnl', 'noon-exit'],
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    name: 'SPX 30Δ 10-Wide Put Vertical (Max Win Rate)',
    description: 'Highest win rate: 95% win rate, $57.92 avg P&L. Based on 2.5yr backtest. Close at noon if TP not hit.',
    underlying: 'SPX',
    strategy: 'Vertical',
    direction: 'PUT',
    targetDelta: 30,
    width: 10,
    ruleBundle: {
      takeProfitPct: 35,
      stopLossPct: 100,
      timeExit: '12:00',
    },
    exitStrategy: 'both',
    entryWindow: '09:00',
    source: 'user',
    autoArm: false,
    tags: ['0DTE', 'high-win-rate', 'noon-exit'],
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    name: 'SPX 50Δ 10-Wide Call Vertical',
    description: 'Standard momentum scalp for SPX',
    underlying: 'SPX',
    strategy: 'Vertical',
    direction: 'CALL',
    targetDelta: 50,
    width: 10,
    ruleBundle: {
      takeProfitPct: 50,
      stopLossPct: 100,
      timeExit: '13:00',
    },
    exitStrategy: 'both',
    source: 'user',
    autoArm: false,
    tags: ['0DTE'],
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    name: 'SPX 40Δ 5-Wide Call Vertical',
    description: 'Tighter risk, lower delta',
    underlying: 'SPX',
    strategy: 'Vertical',
    direction: 'CALL',
    targetDelta: 40,
    width: 5,
    ruleBundle: {
      takeProfitPct: 50,
      stopLossPct: 100,
      timeExit: '13:00',
    },
    exitStrategy: 'both',
    source: 'user',
    autoArm: false,
    tags: ['0DTE', 'low-risk'],
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    name: 'QQQ 50Δ 10-Wide Put Vertical',
    description: 'Tech momentum play',
    underlying: 'QQQ',
    strategy: 'Vertical',
    direction: 'PUT',
    targetDelta: 50,
    width: 10,
    ruleBundle: {
      takeProfitPct: 50,
      stopLossPct: 100,
      timeExit: '13:00',
    },
    exitStrategy: 'both',
    source: 'user',
    autoArm: false,
    tags: ['0DTE', 'tech'],
    createdAt: new Date().toISOString(),
  },
];

const STORAGE_KEY = 'vibesnipe_templates';

export function Library() {
  const isMobile = useIsMobile();
  const tokens = useTokens();
  const colors = tokens.colors;
  const toast = useToast();
  
  const [templates, setTemplates] = useState<PresetTemplate[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Load templates from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedTemplates = JSON.parse(stored);
        setTemplates(parsedTemplates);
      } else {
        // First time - use mock templates
        setTemplates(MOCK_TEMPLATES);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(MOCK_TEMPLATES));
      }
    } catch (err) {
      console.error('Failed to load templates:', err);
      setTemplates(MOCK_TEMPLATES);
    }
  }, []);

  // Save templates to localStorage whenever they change
  useEffect(() => {
    if (templates.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
      } catch (err) {
        console.error('Failed to save templates:', err);
      }
    }
  }, [templates]);

  const handleCopy = (template: PresetTemplate) => {
    // Copy template to clipboard
    const templateString = JSON.stringify(template, null, 2);
    navigator.clipboard.writeText(templateString);
    setCopiedId(template.id);
    toast('Template copied to clipboard', 'profit');
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div style={{ 
      minHeight: '100vh',
      backgroundColor: colors.bg,
      color: colors.textPrimary,
    }}>
      {/* Header */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: isMobile ? `${tokens.space.xl}px ${tokens.space.lg}px` : `${tokens.space.xxxl}px ${tokens.space.xl}px ${tokens.space.xl}px`,
      }}>
        <div style={{ marginBottom: `${tokens.space.xxl}px` }}>
          <h1 style={{ 
            fontSize: `${tokens.type.sizes.xxxl}px`,
            color: colors.textPrimary,
            marginBottom: `${tokens.space.sm}px`,
            fontWeight: tokens.type.weights.semibold,
            letterSpacing: '-0.02em',
          }}>
            Library
          </h1>
          <p style={{ 
            fontSize: `${tokens.type.sizes.base}px`,
            color: colors.textSecondary,
          }}>
            Saved templates and preset strategies
          </p>
        </div>

        {/* Templates Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(350px, 1fr))',
          gap: `${tokens.space.lg}px`,
        }}>
          {templates.map((template) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                padding: `${tokens.space.xl}px`,
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: `${tokens.radius.lg}px`,
                cursor: 'pointer',
                transition: tokens.motion.base,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = colors.semantic.info;
                e.currentTarget.style.boxShadow = `0 4px 12px ${colors.semantic.info}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = colors.border;
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: `${tokens.space.md}px` }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: `${tokens.type.sizes.lg}px`,
                    color: colors.textPrimary,
                    marginBottom: `${tokens.space.xs}px`,
                    fontWeight: tokens.type.weights.semibold,
                  }}>
                    {template.name}
                  </h3>
                  <p style={{
                    fontSize: `${tokens.type.sizes.sm}px`,
                    color: colors.textSecondary,
                    marginBottom: `${tokens.space.md}px`,
                  }}>
                    {template.description}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCopy(template);
                  }}
                  style={{
                    padding: `${tokens.space.sm}px`,
                    backgroundColor: 'transparent',
                    border: 'none',
                    borderRadius: `${tokens.radius.sm}px`,
                    cursor: 'pointer',
                    color: copiedId === template.id ? colors.semantic.profit : colors.textSecondary,
                    transition: tokens.motion.base,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = colors.surfaceAlt;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }}
                >
                  {copiedId === template.id ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>

              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: `${tokens.space.sm}px`,
                marginBottom: `${tokens.space.md}px`,
              }}>
                <span style={{
                  padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.sm}px`,
                  fontSize: `${tokens.type.sizes.xs}px`,
                  backgroundColor: template.direction === 'CALL' ? colors.semantic.profit + '15' : colors.semantic.risk + '15',
                  border: `1px solid ${template.direction === 'CALL' ? colors.semantic.profit + '40' : colors.semantic.risk + '40'}`,
                  color: template.direction === 'CALL' ? colors.semantic.profit : colors.semantic.risk,
                }}>
                  {template.direction}
                </span>
                <span style={{
                  padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.sm}px`,
                  fontSize: `${tokens.type.sizes.xs}px`,
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                  color: colors.textPrimary,
                }}>
                  {template.targetDelta}Δ
                </span>
                <span style={{
                  padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.sm}px`,
                  fontSize: `${tokens.type.sizes.xs}px`,
                  backgroundColor: colors.bg,
                  border: `1px solid ${colors.border}`,
                  color: colors.textPrimary,
                }}>
                  {template.width}pt wide
                </span>
                <span style={{
                  padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.sm}px`,
                  fontSize: `${tokens.type.sizes.xs}px`,
                  backgroundColor: colors.semantic.profit + '15',
                  border: `1px solid ${colors.semantic.profit}40`,
                  color: colors.semantic.profit,
                }}>
                  TP {template.ruleBundle.takeProfitPct ?? '—'}%
                </span>
                <span style={{
                  padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.sm}px`,
                  fontSize: `${tokens.type.sizes.xs}px`,
                  backgroundColor: colors.semantic.risk + '15',
                  border: `1px solid ${colors.semantic.risk}40`,
                  color: colors.semantic.risk,
                }}>
                  SL {template.ruleBundle.stopLossPct ?? '—'}%
                </span>
                {template.ruleBundle.timeExit && (
                  <span style={{
                    padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                    borderRadius: `${tokens.radius.sm}px`,
                    fontSize: `${tokens.type.sizes.xs}px`,
                    backgroundColor: colors.semantic.warning + '15',
                    border: `1px solid ${colors.semantic.warning}40`,
                    color: colors.semantic.warning,
                  }}>
                    Exit {template.ruleBundle.timeExit}
                  </span>
                )}
                {template.entryWindow && (
                  <span style={{
                    padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                    borderRadius: `${tokens.radius.sm}px`,
                    fontSize: `${tokens.type.sizes.xs}px`,
                    backgroundColor: colors.semantic.info + '15',
                    border: `1px solid ${colors.semantic.info}40`,
                    color: colors.semantic.info,
                  }}>
                    Entry {template.entryWindow}
                  </span>
                )}
              </div>

              <div style={{
                padding: `${tokens.space.md}px`,
                backgroundColor: colors.bg,
                borderRadius: `${tokens.radius.md}px`,
                fontSize: `${tokens.type.sizes.xs}px`,
                color: colors.textSecondary,
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: `${tokens.space.sm}px` }}>
                  <div>
                    <span style={{ color: colors.subtle }}>Underlying: </span>
                    <span style={{ color: colors.textPrimary }}>{template.underlying}</span>
                  </div>
                  <div>
                    <span style={{ color: colors.subtle }}>Strategy: </span>
                    <span style={{ color: colors.textPrimary }}>{template.strategy}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Empty State */}
        {templates.length === 0 && (
          <div style={{
            padding: `${tokens.space.xxxl}px`,
            textAlign: 'center',
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: `${tokens.radius.lg}px`,
          }}>
            <BookOpen className="w-16 h-16 mx-auto mb-4" style={{ color: colors.subtle }} />
            <h3 style={{
              fontSize: `${tokens.type.sizes.xl}px`,
              color: colors.textPrimary,
              marginBottom: `${tokens.space.sm}px`,
              fontWeight: tokens.type.weights.semibold,
            }}>
              No Templates Yet
            </h3>
            <p style={{
              fontSize: `${tokens.type.sizes.base}px`,
              color: colors.textSecondary,
            }}>
              Create and save your first trading template
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
