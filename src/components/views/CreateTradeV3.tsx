'use client';

import { useState, useEffect } from 'react';
import { Copy, Settings, ChevronDown, ChevronUp, Plus, Minus, X, Send, Activity, Clock, Check, AlertCircle, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useIsMobile } from '@/components/ui/use-mobile';
import { useTokens } from '@/hooks/useTokens';
import { useSettings } from '@/hooks/useSettings';
import { useThemeContext } from '@/components/providers/ThemeProvider';
import { useOrders } from '@/stores/useOrders';
import { useQuotes } from '@/stores/useQuotes';
import { useSchedule } from '@/stores/useSchedule';
import { TradeLeg, Underlying, RuleBundle } from '@/types';
import { PreviewStep } from './PreviewStep';
import { fetchOptionChain } from '@/lib/tastytrade/chains';
import type { OptionInstrument } from '@/lib/tastytrade/types';
import { useToast } from '@/components/ui';

type FlowStep = 'choose' | 'paste' | 'preset' | 'preview' | 'executing' | 'working';

interface ParsedTrade {
  underlying: Underlying;
  strategy: 'Vertical' | 'Butterfly';
  direction: 'CALL' | 'PUT';
  longStrike: number;
  shortStrike: number;
  wingStrike?: number;
  limitPrice: number;
  width: number;
  expiry?: string; // "2025-10-31" or undefined for 0DTE
  alertCredit?: number; // Original credit from alert, preserved separately
  greeks?: {
    longDelta?: number;
    shortDelta?: number;
    wingDelta?: number;
    spreadBid?: number;
    spreadAsk?: number;
    spreadMid?: number;
  };
}

interface Preset {
  id: string;
  name: string;
  underlying: Underlying;
  strategy: 'Vertical' | 'Butterfly';
  direction: 'CALL' | 'PUT';
  targetDelta: number;
  width: number;
  tpPct: number;
  slPct: number;
  timeExit?: string;
  description: string;
}

const MOCK_PRESETS: Preset[] = [
  {
    id: 'spx_50d_10w',
    name: 'SPX 50Δ 10-Wide',
    underlying: 'SPX',
    strategy: 'Vertical',
    direction: 'CALL',
    targetDelta: 50,
    width: 10,
    tpPct: 50,
    slPct: 100,
    timeExit: '13:00',
    description: 'Standard momentum scalp',
  },
  {
    id: 'qqq_50d_10w',
    name: 'QQQ 50Δ 10-Wide',
    underlying: 'QQQ',
    strategy: 'Vertical',
    direction: 'PUT',
    targetDelta: 50,
    width: 10,
    tpPct: 50,
    slPct: 100,
    timeExit: '13:00',
    description: 'Tech momentum play',
  },
];

function parseDiscordAlert(text: string): ParsedTrade | null {
  const underlyingMatch = text.match(/\b(SPX|QQQ)\b/i);
  if (!underlyingMatch) return null;
  
  const strikesMatch = text.match(/(\d+)\/(\d+)(?:\/(\d+))?/);
  if (!strikesMatch) return null;
  
  const priceMatch = text.match(/@(\d+\.?\d*)/);
  if (!priceMatch) return null;
  
  const directionMatch = text.match(/\b(CALL|PUT)S?\b/i);
  const isButterfly = /butterfly|fly/i.test(text);
  
  // Extract expiry date (e.g., "31 Oct 25" or "15 DEC 24")
  const expiryMatch = text.match(/(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{2,4})/i);
  let expiry: string | undefined;
  if (expiryMatch) {
    const day = parseInt(expiryMatch[1]);
    const monthNames: { [key: string]: number } = {
      jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
      jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11
    };
    const month = monthNames[expiryMatch[2].toLowerCase()];
    let year = parseInt(expiryMatch[3]);
    if (year < 100) year += 2000; // Convert 2-digit to 4-digit year
    const expiryDate = new Date(year, month, day);
    expiry = expiryDate.toISOString().split('T')[0];
  }
  // If no expiry specified, leave undefined (will default to 0DTE elsewhere)
  
  const longStrike = parseInt(strikesMatch[1]);
  const shortStrike = parseInt(strikesMatch[2]);
  const wingStrike = strikesMatch[3] ? parseInt(strikesMatch[3]) : undefined;
  
  const alertCredit = parseFloat(priceMatch[1]);
  
  return {
    underlying: underlyingMatch[1].toUpperCase() as Underlying,
    strategy: isButterfly ? 'Butterfly' : 'Vertical',
    direction: (directionMatch?.[1]?.toUpperCase() as 'CALL' | 'PUT') || 'CALL',
    longStrike,
    shortStrike,
    wingStrike,
    limitPrice: alertCredit, // Current market credit (will be updated with real quotes)
    width: shortStrike - longStrike,
    expiry,
    alertCredit, // Preserve original alert credit
  };
}

/**
 * Calculate suggested contract quantity based on risk tolerance
 * Returns the maximum number of contracts that fit within the account risk percentage
 */
function calculateSuggestedContracts(trade: ParsedTrade, accountSize: number, riskPercentage: number): number {
  const { width, limitPrice } = trade;
  const maxLossPerContract = (width - limitPrice) * 100; // Max loss per contract in dollars
  const accountRiskDollars = accountSize * (riskPercentage / 100); // Total dollars to risk
  
  if (maxLossPerContract <= 0) return 1; // Safety check
  
  const suggestedContracts = Math.floor(accountRiskDollars / maxLossPerContract);
  return Math.max(1, suggestedContracts); // Minimum 1 contract
}

function calculateRiskMetrics(trade: ParsedTrade, contracts: number, accountSize: number) {
  const { strategy, width, limitPrice } = trade;
  
  // For credit spreads: max loss = width - credit, max gain = credit
  const maxLossPerContract = width - limitPrice;
  const maxGainPerContract = limitPrice;
  
  if (strategy === 'Vertical') {
    const maxGain = maxGainPerContract * 100 * contracts;
    const maxLoss = maxLossPerContract * 100 * contracts;
    const breakeven = trade.longStrike + limitPrice;
    const ror = maxLoss > 0 ? (maxGain / maxLoss) * 100 : 0;
    const riskPct = (maxLoss / accountSize) * 100;
    
    return { maxGain, maxLoss, breakeven, ror, riskPct, contracts };
  } else {
    // Butterfly has similar structure to vertical for max loss/gain
    const maxGain = maxGainPerContract * 100 * contracts;
    const maxLoss = maxLossPerContract * 100 * contracts;
    const breakeven = trade.longStrike + limitPrice;
    const riskPct = (maxLoss / accountSize) * 100;
    
    return {
      maxGain,
      maxLoss,
      breakeven,
      ror: maxLoss > 0 ? (maxGain / maxLoss) * 100 : 0,
      riskPct,
      contracts,
    };
  }
}

function calculateBracketPrices(
  trade: ParsedTrade, 
  tpPct: number, 
  slPct: number,
  contracts: number
) {
  const credit = trade.limitPrice;
  const width = trade.width;
  
  // PT: X% of credit → buyback at (1 - X%) of credit
  const ptBuyback = credit * (1 - (tpPct / 100));
  
  // SL: credit + (slPct as fraction) × max loss
  const maxLossPerContract = width - credit;
  const slFraction = slPct / 100; // 100 → 1.0 = 100% of max loss
  const slBuyback = credit + (slFraction * maxLossPerContract);
  
  // Max loss/gain
  const maxLoss = maxLossPerContract * 100 * contracts;
  const maxGain = credit * 100 * contracts;
  
  // R:R ratio
  const riskRewardRatio = maxGain > 0 ? maxLoss / maxGain : 0;
  
  return {
    ptBuyback: parseFloat(ptBuyback.toFixed(2)),
    slBuyback: parseFloat(slBuyback.toFixed(2)),
    maxLoss: parseFloat(maxLoss.toFixed(0)),
    maxGain: parseFloat(maxGain.toFixed(0)),
    riskRewardRatio: parseFloat(riskRewardRatio.toFixed(1)),
  };
}

function generateRiskCurve(trade: ParsedTrade, currentPrice: number, contracts: number) {
  const data = [];
  const range = 30;
  
  for (let i = -range; i <= range; i++) {
    const price = currentPrice + i;
    let pl = 0;
    
    if (trade.strategy === 'Vertical') {
      if (price <= trade.longStrike) {
        pl = -trade.limitPrice * 100 * contracts;
      } else if (price >= trade.shortStrike) {
        pl = (trade.width - trade.limitPrice) * 100 * contracts;
      } else {
        pl = ((price - trade.longStrike) - trade.limitPrice) * 100 * contracts;
      }
    } else if (trade.wingStrike) {
      const wing1 = trade.longStrike;
      const body = trade.shortStrike;
      const wing2 = trade.wingStrike;
      
      if (price <= wing1 || price >= wing2) {
        pl = -trade.limitPrice * 100 * contracts;
      } else if (price === body) {
        pl = (trade.width - trade.limitPrice) * 100 * contracts;
      } else if (price < body) {
        const ratio = (price - wing1) / (body - wing1);
        pl = (ratio * trade.width - trade.limitPrice) * 100 * contracts;
      } else {
        const ratio = (wing2 - price) / (wing2 - body);
        pl = (ratio * trade.width - trade.limitPrice) * 100 * contracts;
      }
    }
    
    data.push({ price, pl });
  }
  
  return data;
}

// Step Components
function ChooseStep({ onChoose, isMobile }: { onChoose: (method: 'paste' | 'preset') => void; isMobile: boolean }) {
  const tokens = useTokens();
  const colors = tokens.colors;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xxxl}px`,
      }}
    >
      <h2 style={{
        fontSize: isMobile ? `${tokens.type.sizes.xl}px` : `${tokens.type.sizes.xxl}px`,
        color: colors.textPrimary,
        marginBottom: `${tokens.space.md}px`,
        textAlign: 'center',
      }}>
        Create Trade
      </h2>
      
      <p style={{
        fontSize: isMobile ? `${tokens.type.sizes.sm}px` : `${tokens.type.sizes.base}px`,
        color: colors.textSecondary,
        marginBottom: `${tokens.space.xxxl}px`,
        textAlign: 'center',
      }}>
        Choose your entry method
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
        gap: `${tokens.space.xl}px`,
        width: '100%',
        maxWidth: '700px',
      }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChoose('paste')}
          style={{
            padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xxxl}px`,
            backgroundColor: colors.surface,
            border: `2px solid ${colors.border}`,
            borderRadius: `${tokens.radius.lg}px`,
            cursor: 'pointer',
            textAlign: 'center',
            transition: tokens.motion.base,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = colors.semantic.info;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = colors.border;
          }}
        >
          <Copy size={isMobile ? 40 : 48} style={{ color: colors.semantic.info, margin: '0 auto', marginBottom: `${tokens.space.md}px`, display: 'block' }} />
          <h3 style={{ fontSize: `${tokens.type.sizes.lg}px`, color: colors.textPrimary, marginBottom: `${tokens.space.sm}px` }}>
            Discord Alert
          </h3>
          <p style={{ fontSize: `${tokens.type.sizes.sm}px`, color: colors.textSecondary, marginBottom: `${tokens.space.md}px` }}>
            Paste and execute signal
          </p>
          <kbd style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '4px',
            backgroundColor: colors.bg,
            border: `1px solid ${colors.border}`,
            fontFamily: 'monospace',
            fontSize: `${tokens.type.sizes.xs}px`,
            color: colors.textSecondary,
          }}>
            ⌘V
          </kbd>
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onChoose('preset')}
          style={{
            padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xxxl}px`,
            backgroundColor: colors.surface,
            border: `2px solid ${colors.border}`,
            borderRadius: `${tokens.radius.lg}px`,
            cursor: 'pointer',
            textAlign: 'center',
            transition: tokens.motion.base,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = colors.semantic.profit;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = colors.border;
          }}
        >
          <Zap size={isMobile ? 40 : 48} style={{ color: colors.semantic.profit, margin: '0 auto', marginBottom: `${tokens.space.md}px` }} />
          <h3 style={{ fontSize: `${tokens.type.sizes.lg}px`, color: colors.textPrimary, marginBottom: `${tokens.space.sm}px` }}>
            Saved Preset
          </h3>
          <p style={{ fontSize: `${tokens.type.sizes.sm}px`, color: colors.textSecondary }}>
            50Δ 10-wide template
          </p>
        </motion.button>
      </div>
    </motion.div>
  );
}

function PresetStep({ presets, onSelect, onBack, isMobile }: { presets: Preset[]; onSelect: (preset: Preset) => void; onBack: () => void; isMobile: boolean }) {
  const tokens = useTokens();
  const colors = tokens.colors;
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        width: '100%',
        maxWidth: '900px',
        margin: '0 auto',
        padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xxxl}px`,
      }}
    >
      <button
        onClick={onBack}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${tokens.space.sm}px`,
          marginBottom: `${tokens.space.xl}px`,
          padding: `${tokens.space.sm}px ${tokens.space.md}px`,
          borderRadius: `${tokens.radius.md}px`,
          border: `1px solid ${colors.border}`,
          backgroundColor: 'transparent',
          color: colors.textPrimary,
          cursor: 'pointer',
          fontSize: `${tokens.type.sizes.sm}px`,
        }}
      >
        <ChevronDown size={16} style={{ transform: 'rotate(90deg)' }} />
        Back
      </button>

      <h2 style={{
        fontSize: isMobile ? `${tokens.type.sizes.xl}px` : `${tokens.type.sizes.xxl}px`,
        color: colors.textPrimary,
        marginBottom: `${tokens.space.sm}px`,
      }}>
        Choose Preset
      </h2>
      
      <p style={{
        fontSize: isMobile ? `${tokens.type.sizes.sm}px` : `${tokens.type.sizes.base}px`,
        color: colors.textSecondary,
        marginBottom: `${tokens.space.xxl}px`,
      }}>
        Select a saved strategy template
      </p>

      {/* Preset Cards */}
      <div style={{
        display: 'grid',
        gap: `${tokens.space.md}px`,
        marginBottom: `${tokens.space.xxl}px`,
      }}>
        {presets.map((preset) => (
          <motion.div
            key={preset.id}
            whileHover={{ scale: 1.01 }}
            onClick={() => setSelectedPreset(preset)}
            style={{
              padding: isMobile ? `${tokens.space.md}px` : `${tokens.space.lg}px`,
              backgroundColor: selectedPreset?.id === preset.id ? colors.surface : colors.bg,
              border: `2px solid ${selectedPreset?.id === preset.id ? colors.semantic.info : colors.border}`,
              borderRadius: `${tokens.radius.lg}px`,
              cursor: 'pointer',
            }}
          >
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: `${tokens.space.md}px`,
            }}>
              <div>
                <h3 style={{
                  fontSize: isMobile ? `${tokens.type.sizes.base}px` : `${tokens.type.sizes.lg}px`,
                  color: colors.textPrimary,
                  marginBottom: `${tokens.space.sm}px`,
                }}>
                  {preset.name}
                </h3>
                <p style={{
                  fontSize: isMobile ? `${tokens.type.sizes.xs}px` : `${tokens.type.sizes.sm}px`,
                  color: colors.textSecondary,
                }}>
                  {preset.description}
                </p>
              </div>
              
              {selectedPreset?.id === preset.id && (
                <Check size={20} style={{ color: colors.semantic.info }} />
              )}
            </div>

            <div style={{
              display: 'flex',
              gap: `${tokens.space.sm}px`,
              flexWrap: 'wrap',
            }}>
              <span style={{
                display: 'flex',
                alignItems: 'center',
                gap: `${tokens.space.xs}px`,
                padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                borderRadius: `${tokens.space.sm}px`,
                fontSize: `${tokens.type.sizes.xs}px`,
                backgroundColor: preset.direction === 'CALL' ? colors.semantic.profit + '15' : colors.semantic.risk + '15',
                border: `1px solid ${preset.direction === 'CALL' ? colors.semantic.profit + '40' : colors.semantic.risk + '40'}`,
                color: preset.direction === 'CALL' ? colors.semantic.profit : colors.semantic.risk,
              }}>
                {preset.direction === 'CALL' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {preset.direction}
              </span>
              <span style={{
                padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                borderRadius: `${tokens.space.sm}px`,
                fontSize: `${tokens.type.sizes.xs}px`,
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.textPrimary,
              }}>
                {preset.targetDelta}Δ
              </span>
              <span style={{
                padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                borderRadius: `${tokens.space.sm}px`,
                fontSize: `${tokens.type.sizes.xs}px`,
                backgroundColor: colors.bg,
                border: `1px solid ${colors.border}`,
                color: colors.textPrimary,
              }}>
                {preset.width}pt wide
              </span>
              <span style={{
                padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                borderRadius: `${tokens.space.sm}px`,
                fontSize: `${tokens.type.sizes.xs}px`,
                backgroundColor: colors.semantic.profit + '15',
                border: `1px solid ${colors.semantic.profit}40`,
                color: colors.semantic.profit,
              }}>
                TP {preset.tpPct}%
              </span>
              <span style={{
                padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                borderRadius: `${tokens.space.sm}px`,
                fontSize: `${tokens.type.sizes.xs}px`,
                backgroundColor: colors.semantic.risk + '15',
                border: `1px solid ${colors.semantic.risk}40`,
                color: colors.semantic.risk,
              }}>
                SL {preset.slPct}%
              </span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Continue Button */}
      {selectedPreset && (
        <motion.button
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => onSelect(selectedPreset)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: `${tokens.space.md}px`,
            padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xl}px`,
            fontSize: `${tokens.type.sizes.lg}px`,
            borderRadius: `${tokens.radius.lg}px`,
            border: 'none',
            backgroundColor: colors.semantic.info,
            color: '#FFFFFF',
            cursor: 'pointer',
            boxShadow: `0 4px 12px ${colors.semantic.info}40`,
          }}
        >
          Continue to Preview
          <ChevronDown size={20} style={{ transform: 'rotate(-90deg)' }} />
        </motion.button>
      )}
    </motion.div>
  );
}

function PasteStep({ onParse, onBack, isMobile }: { onParse: (trade: ParsedTrade) => void; onBack: () => void; isMobile: boolean }) {
  const tokens = useTokens();
  const colors = tokens.colors;
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const handlePaste = (value: string) => {
    setText(value);
    setError('');
    
    const parsed = parseDiscordAlert(value);
    if (parsed) {
      setTimeout(() => onParse(parsed), 300);
    } else if (value.length > 10) {
      setError('Unable to parse alert. Check format: SELL -1 Vertical SPX 5900/5910 CALL @2.45 LMT');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '60vh',
        position: 'relative',
        padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xxxl}px`,
      }}
    >
      <button
        onClick={onBack}
        style={{
          position: 'absolute',
          top: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xl}px`,
          left: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xl}px`,
          display: 'flex',
          alignItems: 'center',
          gap: `${tokens.space.sm}px`,
          padding: `${tokens.space.sm}px ${tokens.space.md}px`,
          borderRadius: `${tokens.radius.md}px`,
          border: `1px solid ${colors.border}`,
          backgroundColor: 'transparent',
          color: colors.textPrimary,
          cursor: 'pointer',
          fontSize: `${tokens.type.sizes.sm}px`,
        }}
      >
        <ChevronDown size={16} style={{ transform: 'rotate(90deg)' }} />
        Back
      </button>

      <Copy size={isMobile ? 48 : 64} style={{ color: colors.subtle, marginBottom: `${tokens.space.xl}px`, strokeWidth: 1.5 }} />
      
      <h2 style={{
        fontSize: isMobile ? `${tokens.type.sizes.xl}px` : `${tokens.type.sizes.xxl}px`,
        color: colors.textPrimary,
        marginBottom: `${tokens.space.sm}px`,
        textAlign: 'center',
      }}>
        Paste Discord Alert
      </h2>
      
      <p style={{
        fontSize: isMobile ? `${tokens.type.sizes.sm}px` : `${tokens.type.sizes.base}px`,
        color: colors.textSecondary,
        marginBottom: `${tokens.space.xxl}px`,
        textAlign: 'center',
      }}>
        Press <kbd style={{
          padding: '2px 8px',
          borderRadius: '4px',
          backgroundColor: colors.surface,
          border: `1px solid ${colors.border}`,
          fontFamily: 'monospace',
        }}>⌘V</kbd> to paste
      </p>

      <textarea
        value={text}
        onChange={(e) => handlePaste(e.target.value)}
        placeholder="SELL -1 Vertical SPX 5900/5910 CALL @2.45 LMT"
        autoFocus
        style={{
          width: '100%',
          maxWidth: '600px',
          height: isMobile ? '120px' : '140px',
          padding: isMobile ? `${tokens.space.md}px` : `${tokens.space.lg}px`,
          backgroundColor: colors.surface,
          border: `2px solid ${error ? colors.semantic.risk : colors.border}`,
          borderRadius: `${tokens.radius.lg}px`,
          color: colors.textPrimary,
          fontSize: isMobile ? `${tokens.type.sizes.sm}px` : `${tokens.type.sizes.base}px`,
          fontFamily: 'monospace',
          resize: 'none',
          outline: 'none',
        }}
      />

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${tokens.space.sm}px`,
            marginTop: `${tokens.space.md}px`,
            width: '100%',
            maxWidth: '600px',
            padding: `${tokens.space.md}px ${tokens.space.lg}px`,
            backgroundColor: colors.semantic.risk + '15',
            border: `1px solid ${colors.semantic.risk}40`,
            borderRadius: `${tokens.radius.md}px`,
          }}
        >
          <AlertCircle size={16} style={{ color: colors.semantic.risk }} />
          <span style={{ fontSize: `${tokens.type.sizes.sm}px`, color: colors.semantic.risk }}>
            {error}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}

export function CreateTradeV3() {
  const isMobile = useIsMobile();
  const tokens = useTokens();
  const colors = tokens.colors;
  const { resolvedTheme } = useThemeContext();
  const { setPendingOrder } = useOrders();
  const { getQuote } = useQuotes();
  const { accountValue, riskPercentage } = useSettings();
  
  const [flowStep, setFlowStep] = useState<FlowStep>('choose');
  const [parsedTrade, setParsedTrade] = useState<ParsedTrade | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [contracts, setContracts] = useState(1);
  const [tpPct, setTpPct] = useState(50);
  const [slPct, setSlPct] = useState(100);
  const [adjustmentAttempts, setAdjustmentAttempts] = useState(0);
  const [originalAlertDelta, setOriginalAlertDelta] = useState<{
    shortDelta?: number;
    longDelta?: number;
  } | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const MAX_ATTEMPTS = 2;

  // Fetch account ID on mount
  useEffect(() => {
    async function fetchAccount() {
      try {
        const response = await fetch('/api/tastytrade/auth');
        if (!response.ok) {
          throw new Error(await response.text());
        }
        const data = await response.json();
        setAccountId(data.accountNumber);
      } catch (error) {
        console.error('Failed to fetch account:', error);
        setAuthError(error instanceof Error ? error.message : 'Unknown error');
      }
    }
    fetchAccount();
  }, []);

  const handleChoose = (method: 'paste' | 'preset') => {
    setFlowStep(method);
  };

  // Fetch Greeks from option chain
  const fetchAndUpdateGreeks = async (trade: ParsedTrade) => {
    try {
      const expiry = trade.expiry || new Date().toISOString().split('T')[0]; // Use parsed expiry or default to 0DTE
      const chain = await fetchOptionChain(trade.underlying, expiry);
      
      const longContract = chain.find(c => 
        c.strike === trade.longStrike && c.right === trade.direction
      );
      const shortContract = chain.find(c => 
        c.strike === trade.shortStrike && c.right === trade.direction
      );
      
      if (longContract && shortContract) {
        const spreadBid = (shortContract.ask || 0) - (longContract.bid || 0);
        const spreadAsk = (shortContract.bid || 0) - (longContract.ask || 0);
        const spreadMid = (spreadBid + spreadAsk) / 2;
        
        const greeks = {
          longDelta: longContract.delta,
          shortDelta: shortContract.delta,
          spreadBid,
          spreadAsk,
          spreadMid,
        };
        
        setParsedTrade({
          ...trade,
          limitPrice: spreadMid, // Update to live market price
          greeks,
        });
        
        // Store original alert delta on first fetch
        if (!originalAlertDelta && greeks.shortDelta) {
          setOriginalAlertDelta({
            shortDelta: greeks.shortDelta,
            longDelta: greeks.longDelta,
          });
        }
        
        return greeks;
      }
    } catch (err) {
      console.error('Failed to fetch Greeks:', err);
    }
    return null;
  };

  const handleParseTrade = async (trade: ParsedTrade) => {
    setParsedTrade(trade);
    setAdjustmentAttempts(0);
    setOriginalAlertDelta(null);
    
    // Auto-calculate suggested contract quantity based on risk settings
    const suggestedContracts = calculateSuggestedContracts(trade, accountValue, riskPercentage);
    setContracts(suggestedContracts);
    
    await fetchAndUpdateGreeks(trade);
    setFlowStep('preview');
  };

  const handlePresetSelect = async (preset: Preset) => {
    const quote = getQuote(preset.underlying);
    const currentPrice = quote?.last || 5900;
    const targetStrike = Math.round(currentPrice / 5) * 5;
    
    const mockTrade: ParsedTrade = {
      underlying: preset.underlying,
      strategy: preset.strategy,
      direction: preset.direction,
      longStrike: targetStrike,
      shortStrike: targetStrike + preset.width,
      limitPrice: 2.45,
      width: preset.width,
    };
    setParsedTrade(mockTrade);
    setSelectedPreset(preset);
    setTpPct(preset.tpPct);
    setSlPct(preset.slPct);
    setAdjustmentAttempts(0);
    setOriginalAlertDelta(null);
    
    // Auto-calculate suggested contract quantity based on risk settings
    const suggestedContracts = calculateSuggestedContracts(mockTrade, accountValue, riskPercentage);
    setContracts(suggestedContracts);
    
    await fetchAndUpdateGreeks(mockTrade);
    setFlowStep('preview');
  };

  const handleStrikeNudge = async (direction: number) => {
    if (!parsedTrade || adjustmentAttempts >= MAX_ATTEMPTS) return;
    
    try {
      // Fetch current option chain
      const expiry = parsedTrade.expiry || new Date().toISOString().split('T')[0]; // Use parsed expiry or default to 0DTE
      const chain = await fetchOptionChain(parsedTrade.underlying, expiry);
      
      // Filter by direction
      const relevantChain = chain.filter(c => c.right === parsedTrade.direction);
      
      // Target delta is from original alert
      const targetShortDelta = originalAlertDelta?.shortDelta || parsedTrade.greeks?.shortDelta;
      
      if (!targetShortDelta) {
        // Fallback to mechanical shift if no delta available
        const step = ['SPX', 'NDX', 'RUT'].includes(parsedTrade.underlying) ? 5 : 1;
        const adjustment = direction * step;
        const newLongStrike = parsedTrade.longStrike + adjustment;
        const newShortStrike = parsedTrade.shortStrike + adjustment;
        
        const updatedTrade = { ...parsedTrade, longStrike: newLongStrike, shortStrike: newShortStrike };
        setParsedTrade(updatedTrade);
        await fetchAndUpdateGreeks(updatedTrade);
        setAdjustmentAttempts(prev => prev + 1);
        return;
      }
      
      // Find strike closest to target short delta
      const shortStrikeMatch = relevantChain.reduce((closest, contract) => {
        const currentDiff = Math.abs((contract.delta || 0) - targetShortDelta);
        const closestDiff = Math.abs((closest.delta || 0) - targetShortDelta);
        return currentDiff < closestDiff ? contract : closest;
      });
      
      // Find long strike that maintains original width
      const targetWidth = parsedTrade.width;
      const newShortStrike = shortStrikeMatch.strike;
      const newLongStrike = parsedTrade.direction === 'CALL' 
        ? newShortStrike - targetWidth  // For calls, long is below short
        : newShortStrike + targetWidth; // For puts, long is above short
      
      // Verify long strike exists in chain
      const longStrikeMatch = relevantChain.find(c => c.strike === newLongStrike);
      
      if (!longStrikeMatch) {
        console.error('Could not find matching long strike');
        return;
      }
      
      // Update trade with delta-matched strikes
      const spreadBid = (shortStrikeMatch.ask || 0) - (longStrikeMatch.bid || 0);
      const spreadAsk = (shortStrikeMatch.bid || 0) - (longStrikeMatch.ask || 0);
      const spreadMid = (spreadBid + spreadAsk) / 2;
      
      const updatedTrade = {
        ...parsedTrade,
        longStrike: newLongStrike,
        shortStrike: newShortStrike,
        greeks: {
          shortDelta: shortStrikeMatch.delta,
          longDelta: longStrikeMatch.delta,
          spreadBid,
          spreadAsk,
          spreadMid,
        },
      };
      
      setParsedTrade(updatedTrade);
      setAdjustmentAttempts(prev => prev + 1);
      
      console.log(`Re-anchored: Target Δ ${(targetShortDelta * 100).toFixed(0)}, Found Δ ${((shortStrikeMatch.delta || 0) * 100).toFixed(0)}`);
      
    } catch (err) {
      console.error('Failed to re-anchor with delta matching:', err);
    }
  };

  const handleConfirm = async () => {
    if (!parsedTrade) return;
    
    if (!accountId) {
      alert('Account not loaded. Please refresh the page.');
      return;
    }
    
    setFlowStep('executing');
    
    try {
      const response = await fetch('/api/tastytrade/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: 'vertical',
          spec: {
            underlying: parsedTrade.underlying,
            expiration: parsedTrade.expiry || new Date().toISOString().split('T')[0],
            targetDelta: parsedTrade.greeks?.shortDelta || 0.50,
            right: parsedTrade.direction,
            width: parsedTrade.width,
            quantity: contracts,
          },
          entry: {
            limitPrice: parsedTrade.limitPrice,
            orderType: 'LIMIT',
            accountId,
          },
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }
      
      const result = await response.json();
      
      console.log('✅ Order submitted:', result);
      alert(`Order submitted! ID: ${result.orderId}`);
      setFlowStep('working');
    } catch (error) {
      console.error('❌ Order failed:', error);
      alert(`Order failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setFlowStep('preview');
    }
  };

  const handleCancel = () => {
    setFlowStep('choose');
    setParsedTrade(null);
    setSelectedPreset(null);
    setAdjustmentAttempts(0);
    setOriginalAlertDelta(null);
  };

  const currentPrice = parsedTrade ? (getQuote(parsedTrade.underlying)?.last || 5905) : 5905;
  const marketData = parsedTrade ? {
    bid: parsedTrade.limitPrice - 0.05,
    mid: parsedTrade.limitPrice,
    ask: parsedTrade.limitPrice + 0.05,
    last: parsedTrade.limitPrice,
    spread: 0.10,
    age: 0.3,
  } : { bid: 0, mid: 0, ask: 0, last: 0, spread: 0, age: 0 };
  
  const metrics = parsedTrade ? calculateRiskMetrics(parsedTrade, contracts, accountValue) : null;
  const riskCurve = parsedTrade ? generateRiskCurve(parsedTrade, currentPrice, contracts) : [];
  const bracketPrices = parsedTrade && contracts > 0
    ? calculateBracketPrices(parsedTrade, tpPct, slPct, contracts)
    : null;

  return (
    <div style={{ backgroundColor: colors.bg, color: colors.textPrimary, minHeight: '100vh' }}>
      {/* Auth Error Banner */}
      {authError && (
        <div style={{ 
          padding: isMobile ? `${tokens.space.md}px` : `${tokens.space.lg}px`, 
          backgroundColor: '#ff000020', 
          border: '1px solid #ff0000',
          borderRadius: '8px',
          margin: `${tokens.space.lg}px`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.sm}px` }}>
            <AlertCircle size={20} color="#ff0000" />
            <div>
              <strong style={{ color: '#ff0000' }}>⚠️ TastyTrade authentication failed:</strong>
              <br />
              <span style={{ fontSize: `${tokens.type.sizes.sm}px` }}>{authError}</span>
              <br />
              <span style={{ fontSize: `${tokens.type.sizes.xs}px`, opacity: 0.8 }}>
                Check your credentials in .env.local
              </span>
            </div>
          </div>
        </div>
      )}
      
      {/* Header */}
      <div style={{
        maxWidth: '1400px',
        margin: '0 auto',
        padding: isMobile ? `${tokens.space.xl}px ${tokens.space.lg}px` : `${tokens.space.xxxl}px ${tokens.space.xl}px ${tokens.space.xl}px`,
      }}>
        <div style={{ marginBottom: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xxl}px` }}>
          <h1 style={{
            fontSize: isMobile ? `${tokens.type.sizes.xl}px` : `${tokens.type.sizes.xxxl}px`,
            color: colors.textPrimary,
            marginBottom: `${tokens.space.sm}px`,
            fontWeight: tokens.type.weights.semibold,
            letterSpacing: '-0.02em',
          }}>
            Create Trade
          </h1>
          <p style={{
            fontSize: `${tokens.type.sizes.base}px`,
            color: colors.textSecondary,
          }}>
            Paste Discord alert or select saved preset
          </p>
        </div>
      </div>

      {/* Flow Container */}
      <div style={{
        width: '100%',
        maxWidth: '1200px',
        margin: '0 auto',
        padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xxl}px`,
      }}>
        <AnimatePresence mode="wait">
          {flowStep === 'choose' && (
            <ChooseStep key="choose" onChoose={handleChoose} isMobile={isMobile} />
          )}
          {flowStep === 'paste' && (
            <PasteStep key="paste" onParse={handleParseTrade} onBack={() => setFlowStep('choose')} isMobile={isMobile} />
          )}
          {flowStep === 'preview' && parsedTrade && metrics && (
            <PreviewStep
              key="preview"
              trade={parsedTrade}
              marketData={marketData}
              metrics={metrics}
              riskCurve={riskCurve}
              currentPrice={currentPrice}
              contracts={contracts}
              tpPct={tpPct}
              slPct={slPct}
              accountValue={accountValue}
              riskPercentage={riskPercentage}
              isMobile={isMobile}
              bracketPrices={bracketPrices}
              onContractsChange={setContracts}
              onTpChange={setTpPct}
              onSlChange={setSlPct}
              onPriceNudge={(dir) => {}}
              onStrikeNudge={handleStrikeNudge}
              adjustmentAttempts={adjustmentAttempts}
              maxAttempts={MAX_ATTEMPTS}
              onConfirm={handleConfirm}
              onCancel={handleCancel}
            />
          )}
          {flowStep === 'preset' && (
            <PresetStep
              key="preset"
              presets={MOCK_PRESETS}
              onSelect={handlePresetSelect}
              onBack={() => setFlowStep('choose')}
              isMobile={isMobile}
            />
          )}
          {flowStep === 'executing' && (
            <motion.div
              key="executing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '60vh',
              }}
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
              >
                <Send size={isMobile ? 64 : 80} style={{ color: colors.semantic.info }} />
              </motion.div>
              <h2 style={{
                marginTop: `${tokens.space.xl}px`,
                fontSize: isMobile ? `${tokens.type.sizes.xl}px` : `${tokens.type.sizes.xxl}px`,
                color: colors.textPrimary,
              }}>
                Sending to Market...
              </h2>
              <p style={{
                marginTop: `${tokens.space.sm}px`,
                fontSize: `${tokens.type.sizes.sm}px`,
                color: colors.textSecondary,
              }}>
                Placing limit order
              </p>
            </motion.div>
          )}
          {flowStep === 'working' && parsedTrade && (
            <motion.div
              key="working"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                maxWidth: '600px',
                margin: '0 auto',
                textAlign: 'center',
                padding: isMobile ? `${tokens.space.xl}px` : `${tokens.space.xxxl}px`,
              }}
            >
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: `${tokens.space.xl}px`,
                width: isMobile ? '80px' : '100px',
                height: isMobile ? '80px' : '100px',
                borderRadius: '50%',
                backgroundColor: colors.semantic.info + '20',
                border: `2px solid ${colors.semantic.info}`,
              }}>
                <Activity size={isMobile ? 40 : 48} style={{ color: colors.semantic.info }} />
              </div>

              <h2 style={{
                marginBottom: `${tokens.space.sm}px`,
                fontSize: isMobile ? `${tokens.type.sizes.xl}px` : `${tokens.type.sizes.xxl}px`,
                color: colors.textPrimary,
              }}>
                Order Working
              </h2>
              
              <p style={{
                marginBottom: `${tokens.space.xxl}px`,
                fontSize: `${tokens.type.sizes.sm}px`,
                color: colors.textSecondary,
              }}>
                Waiting for fill on {parsedTrade.underlying} {parsedTrade.strategy}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

