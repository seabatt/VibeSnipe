'use client';

import { useState } from 'react';
import { BookOpen, Plus, Trash2, Copy, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { useTokens } from '@/hooks/useTokens';
import { useIsMobile } from '@/components/ui/use-mobile';
import { useToast } from '@/components/ui';

interface PresetTemplate {
  id: string;
  name: string;
  description: string;
  underlying: 'SPX' | 'QQQ' | 'SPY';
  strategy: 'Vertical' | 'Butterfly';
  direction: 'CALL' | 'PUT';
  targetDelta: number;
  width: number;
  tpPct: number;
  slPct: number;
  timeExit?: string;
}

const MOCK_TEMPLATES: PresetTemplate[] = [
  {
    id: '1',
    name: 'SPX 50Δ 10-Wide Call Vertical',
    description: 'Standard momentum scalp for SPX',
    underlying: 'SPX',
    strategy: 'Vertical',
    direction: 'CALL',
    targetDelta: 50,
    width: 10,
    tpPct: 50,
    slPct: 100,
    timeExit: '13:00',
  },
  {
    id: '2',
    name: 'SPX 40Δ 5-Wide Call Vertical',
    description: 'Tighter risk, lower delta',
    underlying: 'SPX',
    strategy: 'Vertical',
    direction: 'CALL',
    targetDelta: 40,
    width: 5,
    tpPct: 50,
    slPct: 100,
    timeExit: '13:00',
  },
  {
    id: '3',
    name: 'QQQ 50Δ 10-Wide Put Vertical',
    description: 'Tech momentum play',
    underlying: 'QQQ',
    strategy: 'Vertical',
    direction: 'PUT',
    targetDelta: 50,
    width: 10,
    tpPct: 50,
    slPct: 100,
    timeExit: '13:00',
  },
];

export function Library() {
  const isMobile = useIsMobile();
  const tokens = useTokens();
  const colors = tokens.colors;
  const toast = useToast();
  
  const [templates] = useState<PresetTemplate[]>(MOCK_TEMPLATES);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
                  TP {template.tpPct}%
                </span>
                <span style={{
                  padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.sm}px`,
                  fontSize: `${tokens.type.sizes.xs}px`,
                  backgroundColor: colors.semantic.risk + '15',
                  border: `1px solid ${colors.semantic.risk}40`,
                  color: colors.semantic.risk,
                }}>
                  SL {template.slPct}%
                </span>
                {template.timeExit && (
                  <span style={{
                    padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                    borderRadius: `${tokens.radius.sm}px`,
                    fontSize: `${tokens.type.sizes.xs}px`,
                    backgroundColor: colors.semantic.warning + '15',
                    border: `1px solid ${colors.semantic.warning}40`,
                    color: colors.semantic.warning,
                  }}>
                    Exit {template.timeExit}
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
