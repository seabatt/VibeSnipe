'use client';

import { useState } from 'react';
import { motion } from 'motion/react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, ResponsiveContainer, ReferenceLine, Tooltip as RechartsTooltip } from 'recharts';
import { ChevronUp, ChevronDown, Plus, Minus, X, Send } from 'lucide-react';
import { useTokens } from '@/hooks/useTokens';

interface ParsedTrade {
  underlying: 'SPX' | 'QQQ';
  strategy: 'Vertical' | 'Butterfly';
  direction: 'CALL' | 'PUT';
  longStrike: number;
  shortStrike: number;
  wingStrike?: number;
  limitPrice: number;
  width: number;
}

interface MarketData {
  bid: number;
  mid: number;
  ask: number;
  last: number;
  spread: number;
  age: number;
}

interface RiskMetrics {
  maxGain: number;
  maxLoss: number;
  breakeven: number;
  ror: number;
  riskPct: number;
  contracts: number;
}

interface PreviewStepProps {
  trade: ParsedTrade;
  marketData: MarketData;
  metrics: RiskMetrics;
  riskCurve: Array<{ price: number; pl: number }>;
  currentPrice: number;
  contracts: number;
  tpPct: number;
  slPct: number;
  accountValue: number;
  riskPercentage: number;
  isMobile: boolean;
  onContractsChange: (val: number) => void;
  onTpChange: (val: number) => void;
  onSlChange: (val: number) => void;
  onPriceNudge: (direction: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PreviewStep({
  trade,
  marketData,
  metrics,
  riskCurve,
  currentPrice,
  contracts,
  tpPct,
  slPct,
  accountValue,
  riskPercentage,
  isMobile,
  onContractsChange,
  onTpChange,
  onSlChange,
  onPriceNudge,
  onConfirm,
  onCancel,
}: PreviewStepProps) {
  const tokens = useTokens();
  const colors = tokens.colors;
  const [hoveredPoint, setHoveredPoint] = useState<{ price: number; pl: number } | null>(null);
  
  const riskPerTrade = accountValue * (riskPercentage / 100);
  const spreadCost = trade.limitPrice * 100;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.02 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr',
        width: '100%',
        maxWidth: '1100px',
        margin: '0 auto',
        gap: isMobile ? `${tokens.space.md}px` : `${tokens.space.lg}px`,
        padding: isMobile ? `${tokens.space.md}px` : `${tokens.space.lg}px`,
      }}
    >
      {/* Hero: Risk Graph */}
      <div style={{
        padding: isMobile ? `${tokens.space.md}px` : `${tokens.space.lg}px`,
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        borderRadius: `${tokens.radius.lg}px`,
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: `${tokens.space.md}px`,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? `${tokens.space.sm}px` : 0,
        }}>
          <div>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: colors.textSecondary,
              marginBottom: '2px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Risk Profile
            </div>
            <div style={{
              fontSize: isMobile ? `${tokens.type.sizes.base}px` : `${tokens.type.sizes.lg}px`,
              color: colors.textPrimary,
            }}>
              {trade.underlying} {trade.strategy} {trade.direction}
            </div>
          </div>
          
          {hoveredPoint && (
            <motion.div
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              style={{
                padding: `${tokens.space.sm}px ${tokens.space.md}px`,
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: `${tokens.radius.md}px`,
              }}
            >
              <span style={{
                fontSize: `${tokens.type.sizes.sm}px`,
                color: colors.textSecondary,
                marginRight: `${tokens.space.sm}px`,
              }}>
                @ ${hoveredPoint.price.toFixed(2)}
              </span>
              <span style={{
                fontSize: `${tokens.type.sizes.lg}px`,
                color: hoveredPoint.pl >= 0 ? colors.semantic.profit : colors.semantic.risk,
                fontVariantNumeric: 'tabular-nums',
              }}>
                {hoveredPoint.pl >= 0 ? '+' : ''}${hoveredPoint.pl.toFixed(0)}
              </span>
            </motion.div>
          )}
        </div>

        <div style={{ height: isMobile ? '180px' : '280px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={riskCurve}
              onMouseMove={(e: any) => {
                if (e.activePayload?.[0]) {
                  setHoveredPoint(e.activePayload[0].payload);
                }
              }}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <defs>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colors.semantic.profit} stopOpacity={0.2} />
                  <stop offset="100%" stopColor={colors.semantic.profit} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={colors.border} vertical={false} strokeOpacity={0.5} />
              <XAxis
                dataKey="price"
                stroke={colors.subtle}
                tick={{ fill: colors.textSecondary, fontSize: isMobile ? 10 : 11 }}
                tickFormatter={(val) => val.toFixed(0)}
                axisLine={{ stroke: colors.border }}
              />
              <YAxis
                stroke={colors.subtle}
                tick={{ fill: colors.textSecondary, fontSize: isMobile ? 10 : 11 }}
                tickFormatter={(val) => `$${val}`}
                axisLine={{ stroke: colors.border }}
              />
              <RechartsTooltip content={() => null} />
              <ReferenceLine y={0} stroke={colors.border} strokeWidth={2} />
              <ReferenceLine
                x={currentPrice}
                stroke={colors.semantic.info}
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{ value: 'Now', fill: colors.semantic.info, fontSize: 11, position: 'top', offset: 10 }}
              />
              <ReferenceLine
                x={metrics.breakeven}
                stroke={colors.semantic.warning}
                strokeDasharray="4 4"
                strokeWidth={2}
                label={{ value: 'BE', fill: colors.semantic.warning, fontSize: 11, position: 'top', offset: 10 }}
              />
              <Area
                type="monotone"
                dataKey="pl"
                stroke={colors.semantic.profit}
                strokeWidth={3}
                fill="url(#profitGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Context Grid - 2-column on desktop, stacks on mobile */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
        gap: isMobile ? `${tokens.space.md}px` : `${tokens.space.lg}px`,
      }}>
        {/* Left: Trade Structure */}
        <div style={{
          padding: isMobile ? `${tokens.space.md}px` : `${tokens.space.lg}px`,
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: `${tokens.radius.md}px`,
        }}>
          <div style={{
            fontSize: `${tokens.type.sizes.xs}px`,
            color: colors.textSecondary,
            marginBottom: `${tokens.space.md}px`,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Strikes
          </div>
          
          <div style={{
            fontSize: isMobile ? `${tokens.type.sizes.xl}px` : `${tokens.type.sizes.xxl}px`,
            color: colors.textPrimary,
            fontVariantNumeric: 'tabular-nums',
            marginBottom: `${tokens.space.xs}px`,
            letterSpacing: '-0.02em',
          }}>
            {trade.longStrike.toFixed(2)}/{trade.shortStrike.toFixed(2)}{trade.wingStrike && `/${trade.wingStrike.toFixed(2)}`}
          </div>
          <div style={{
            fontSize: `${tokens.type.sizes.sm}px`,
            color: colors.textSecondary,
            marginBottom: `${tokens.space.lg}px`,
          }}>
            {trade.width}pt {trade.direction} spread
          </div>

          <div style={{
            paddingTop: `${tokens.space.md}px`,
            borderTop: `1px solid ${colors.border}`,
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: `${tokens.space.md}px`,
            }}>
              <div style={{
                fontSize: `${tokens.type.sizes.xs}px`,
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>
                Spread Price
              </div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: `${tokens.space.xs}px`,
                padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                backgroundColor: colors.semantic.profit + '15',
                borderRadius: `${tokens.space.xs}px`,
              }}>
                <div style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  backgroundColor: colors.semantic.profit,
                }}></div>
                <span style={{
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.semantic.profit,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  Live {marketData.age.toFixed(1)}s
                </span>
              </div>
            </div>

            {/* Price Grid - 4 columns on desktop, 2 on mobile */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
              gap: isMobile ? `${tokens.space.sm}px` : `${tokens.space.md}px`,
              marginBottom: `${tokens.space.md}px`,
            }}>
              <div>
                <div style={{
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  marginBottom: `${tokens.space.xs}px`,
                }}>Bid</div>
                <div style={{
                  fontSize: isMobile ? `${tokens.type.sizes.base}px` : `${tokens.type.sizes.lg}px`,
                  color: colors.semantic.risk,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {marketData.bid.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  marginBottom: `${tokens.space.xs}px`,
                }}>Mid</div>
                <div style={{
                  fontSize: isMobile ? `${tokens.type.sizes.base}px` : `${tokens.type.sizes.lg}px`,
                  color: colors.textPrimary,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {marketData.mid.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  marginBottom: `${tokens.space.xs}px`,
                }}>Ask</div>
                <div style={{
                  fontSize: isMobile ? `${tokens.type.sizes.base}px` : `${tokens.type.sizes.lg}px`,
                  color: colors.semantic.profit,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {marketData.ask.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  marginBottom: `${tokens.space.xs}px`,
                }}>Last</div>
                <div style={{
                  fontSize: isMobile ? `${tokens.type.sizes.base}px` : `${tokens.type.sizes.lg}px`,
                  color: colors.textPrimary,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {marketData.last.toFixed(2)}
                </div>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              gap: `${tokens.space.sm}px`,
            }}>
              <button
                onClick={() => onPriceNudge(-1)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: `${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.sm}px`,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: 'transparent',
                  color: colors.textPrimary,
                  cursor: 'pointer',
                  fontSize: `${tokens.type.sizes.xs}px`,
                }}
              >
                <Minus size={12} />
              </button>
              <button
                onClick={() => onPriceNudge(1)}
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: `${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.sm}px`,
                  border: `1px solid ${colors.border}`,
                  backgroundColor: 'transparent',
                  color: colors.textPrimary,
                  cursor: 'pointer',
                  fontSize: `${tokens.type.sizes.xs}px`,
                }}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Position Sizing */}
        <div style={{
          padding: isMobile ? `${tokens.space.md}px` : `${tokens.space.lg}px`,
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: `${tokens.radius.md}px`,
        }}>
          <div style={{
            fontSize: `${tokens.type.sizes.xs}px`,
            color: colors.textSecondary,
            marginBottom: `${tokens.space.md}px`,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Contract Quantity
          </div>
          
          <div style={{
            fontSize: isMobile ? `${tokens.type.sizes.xl}px` : `${tokens.type.sizes.xxl}px`,
            color: colors.textPrimary,
            fontVariantNumeric: 'tabular-nums',
            marginBottom: `${tokens.space.xs}px`,
            letterSpacing: '-0.02em',
          }}>
            {contracts}
          </div>
          
          <div style={{
            fontSize: `${tokens.type.sizes.xs}px`,
            color: colors.textSecondary,
            marginBottom: `${tokens.space.lg}px`,
          }}>
            ${spreadCost.toFixed(2)} per contract
          </div>

          <div style={{
            display: 'flex',
            gap: `${tokens.space.sm}px`,
            marginBottom: `${tokens.space.xl}px`,
          }}>
            <button
              onClick={() => onContractsChange(Math.max(1, contracts - 1))}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: `${tokens.space.md}px`,
                borderRadius: `${tokens.radius.sm}px`,
                border: `1px solid ${colors.border}`,
                backgroundColor: 'transparent',
                color: colors.textPrimary,
                cursor: 'pointer',
              }}
            >
              <Minus size={16} />
            </button>
            <button
              onClick={() => onContractsChange(contracts + 1)}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: `${tokens.space.md}px`,
                borderRadius: `${tokens.radius.sm}px`,
                border: `1px solid ${colors.border}`,
                backgroundColor: 'transparent',
                color: colors.textPrimary,
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
            </button>
          </div>

          <div style={{
            paddingTop: `${tokens.space.md}px`,
            borderTop: `1px solid ${colors.border}`,
          }}>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: colors.textSecondary,
              marginBottom: `${tokens.space.md}px`,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Risk Metrics
            </div>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: `${tokens.space.md}px`,
              marginBottom: `${tokens.space.md}px`,
            }}>
              <div>
                <div style={{
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  marginBottom: `${tokens.space.xs}px`,
                }}>Max Gain</div>
                <div style={{
                  fontSize: isMobile ? `${tokens.type.sizes.base}px` : `${tokens.type.sizes.lg}px`,
                  color: colors.semantic.profit,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  ${metrics.maxGain.toFixed(0)}
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  marginBottom: `${tokens.space.xs}px`,
                }}>Max Loss</div>
                <div style={{
                  fontSize: isMobile ? `${tokens.type.sizes.base}px` : `${tokens.type.sizes.lg}px`,
                  color: colors.semantic.risk,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  ${metrics.maxLoss.toFixed(0)}
                </div>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: `${tokens.space.md}px`,
            }}>
              <div>
                <div style={{
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  marginBottom: `${tokens.space.xs}px`,
                }}>RoR</div>
                <div style={{
                  fontSize: isMobile ? `${tokens.type.sizes.base}px` : `${tokens.type.sizes.lg}px`,
                  color: colors.textPrimary,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {metrics.ror.toFixed(0)}%
                </div>
              </div>
              <div>
                <div style={{
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: colors.textSecondary,
                  marginBottom: `${tokens.space.xs}px`,
                }}>Risk</div>
                <div style={{
                  fontSize: isMobile ? `${tokens.type.sizes.base}px` : `${tokens.type.sizes.lg}px`,
                  color: metrics.riskPct > 2 ? colors.semantic.warning : colors.textPrimary,
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {metrics.riskPct.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Exit Rules */}
      <div style={{
        padding: isMobile ? `${tokens.space.md}px` : `${tokens.space.lg}px`,
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: `${tokens.radius.md}px`,
      }}>
        <div style={{
          fontSize: `${tokens.type.sizes.xs}px`,
          color: colors.textSecondary,
          marginBottom: `${tokens.space.md}px`,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Discipline (Attached Pre-Send)
        </div>
        
        <div style={{
          display: 'grid',
          gap: `${tokens.space.md}px`,
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        }}>
          {/* Take Profit */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: `${tokens.radius.md}px`,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: isMobile ? `0 ${tokens.space.sm}px` : `0 ${tokens.space.md}px`,
              fontSize: `${tokens.type.sizes.xs}px`,
              color: colors.textSecondary,
              minWidth: isMobile ? '50px' : '70px',
              whiteSpace: 'nowrap',
            }}>
              {isMobile ? 'TP' : 'Take Profit'}
            </div>
            <button
              onClick={() => onTpChange(Math.max(0, tpPct - 5))}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                borderLeft: `1px solid ${colors.border}`,
                color: colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              <ChevronDown size={16} />
            </button>
            <div style={{
              flex: 1,
              textAlign: 'center',
              padding: `${tokens.space.sm}px`,
              fontSize: `${tokens.type.sizes.lg}px`,
              color: colors.semantic.profit,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {tpPct}%
            </div>
            <button
              onClick={() => onTpChange(Math.min(100, tpPct + 5))}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                borderLeft: `1px solid ${colors.border}`,
                color: colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              <ChevronUp size={16} />
            </button>
          </div>

          {/* Stop Loss */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
            borderRadius: `${tokens.radius.md}px`,
            overflow: 'hidden',
          }}>
            <div style={{
              padding: isMobile ? `0 ${tokens.space.sm}px` : `0 ${tokens.space.md}px`,
              fontSize: `${tokens.type.sizes.xs}px`,
              color: colors.textSecondary,
              minWidth: isMobile ? '50px' : '70px',
              whiteSpace: 'nowrap',
            }}>
              {isMobile ? 'SL' : 'Stop Loss'}
            </div>
            <button
              onClick={() => onSlChange(Math.max(0, slPct - 5))}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                borderLeft: `1px solid ${colors.border}`,
                color: colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              <ChevronDown size={16} />
            </button>
            <div style={{
              flex: 1,
              textAlign: 'center',
              padding: `${tokens.space.sm}px`,
              fontSize: `${tokens.type.sizes.lg}px`,
              color: colors.semantic.risk,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {slPct}%
            </div>
            <button
              onClick={() => onSlChange(Math.min(200, slPct + 5))}
              style={{
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                borderLeft: `1px solid ${colors.border}`,
                color: colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              <ChevronUp size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{
        display: 'grid',
        gap: `${tokens.space.md}px`,
        gridTemplateColumns: isMobile ? '1fr' : 'auto 1fr',
      }}>
        <button
          onClick={onCancel}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: `${tokens.space.sm}px`,
            padding: isMobile ? `${tokens.space.md}px` : `${tokens.space.lg}px`,
            fontSize: `${tokens.type.sizes.base}px`,
            borderRadius: `${tokens.radius.lg}px`,
            border: `1px solid ${colors.border}`,
            backgroundColor: 'transparent',
            color: colors.textPrimary,
            cursor: 'pointer',
          }}
        >
          <X size={20} />
          {!isMobile && 'Cancel'}
        </button>
        <button
          onClick={onConfirm}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: `${tokens.space.sm}px`,
            padding: isMobile ? `${tokens.space.md}px` : `${tokens.space.lg}px`,
            fontSize: `${tokens.type.sizes.lg}px`,
            borderRadius: `${tokens.radius.lg}px`,
            border: 'none',
            backgroundColor: colors.semantic.info,
            color: '#FFFFFF',
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${colors.semantic.info}40`,
          }}
        >
          <Send size={20} />
          Send to Market
        </button>
      </div>
    </motion.div>
  );
}

