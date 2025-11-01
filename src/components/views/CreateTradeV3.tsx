'use client';

import { useState, useEffect } from 'react';
import { Copy, Settings, ChevronDown, ChevronUp, Plus, Minus, X, Send, Activity, Clock, Check, AlertCircle, Zap, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useIsMobile } from '@/components/ui/use-mobile';
import { useTokens } from '@/hooks/useTokens';
import { useThemeContext } from '@/components/providers/ThemeProvider';
import { useOrders } from '@/stores/useOrders';
import { useQuotes } from '@/stores/useQuotes';
import { TradeLeg, Underlying, RuleBundle } from '@/types';
import { PreviewStep } from './PreviewStep';

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
  
  const longStrike = parseInt(strikesMatch[1]);
  const shortStrike = parseInt(strikesMatch[2]);
  const wingStrike = strikesMatch[3] ? parseInt(strikesMatch[3]) : undefined;
  
  return {
    underlying: underlyingMatch[1].toUpperCase() as Underlying,
    strategy: isButterfly ? 'Butterfly' : 'Vertical',
    direction: (directionMatch?.[1]?.toUpperCase() as 'CALL' | 'PUT') || 'CALL',
    longStrike,
    shortStrike,
    wingStrike,
    limitPrice: parseFloat(priceMatch[1]),
    width: shortStrike - longStrike,
  };
}

function calculateRiskMetrics(trade: ParsedTrade, contracts: number, accountSize: number) {
  const { strategy, width, limitPrice } = trade;
  
  if (strategy === 'Vertical') {
    const maxGain = ((width * 100) - (limitPrice * 100)) * contracts;
    const maxLoss = limitPrice * 100 * contracts;
    const breakeven = trade.longStrike + limitPrice;
    const ror = (maxGain / maxLoss) * 100;
    const riskPct = (maxLoss / accountSize) * 100;
    
    return { maxGain, maxLoss, breakeven, ror, riskPct, contracts };
  } else {
    const maxGain = ((width * 100) - (limitPrice * 100)) * contracts;
    const maxLoss = limitPrice * 100 * contracts;
    const breakeven = trade.longStrike + limitPrice;
    const riskPct = (maxLoss / accountSize) * 100;
    
    return {
      maxGain,
      maxLoss,
      breakeven,
      ror: (maxGain / maxLoss) * 100,
      riskPct,
      contracts,
    };
  }
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
  
  const [flowStep, setFlowStep] = useState<FlowStep>('choose');
  const [parsedTrade, setParsedTrade] = useState<ParsedTrade | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<Preset | null>(null);
  const [contracts, setContracts] = useState(1);
  const [tpPct, setTpPct] = useState(50);
  const [slPct, setSlPct] = useState(100);

  const handleChoose = (method: 'paste' | 'preset') => {
    setFlowStep(method);
  };

  const handleParseTrade = (trade: ParsedTrade) => {
    setParsedTrade(trade);
    setFlowStep('preview');
  };

  const handlePresetSelect = (preset: Preset) => {
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
    setFlowStep('preview');
  };

  const handleConfirm = () => {
    if (!parsedTrade) return;
    
    const legs: TradeLeg[] = [
      {
        action: 'BUY',
        right: parsedTrade.direction,
        strike: parsedTrade.longStrike,
        expiry: new Date().toISOString().split('T')[0],
        quantity: contracts,
        price: parsedTrade.limitPrice,
      },
      {
        action: 'SELL',
        right: parsedTrade.direction,
        strike: parsedTrade.shortStrike,
        expiry: new Date().toISOString().split('T')[0],
        quantity: contracts,
        price: parsedTrade.limitPrice,
      },
    ];

    const ruleBundle: RuleBundle = {
      takeProfitPct: tpPct,
      stopLossPct: slPct,
      timeExit: selectedPreset?.timeExit,
    };

    setPendingOrder({ legs, ruleBundle });
    setFlowStep('executing');
    setTimeout(() => setFlowStep('working'), 1500);
  };

  const handleCancel = () => {
    setFlowStep('choose');
    setParsedTrade(null);
    setSelectedPreset(null);
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
  
  const metrics = parsedTrade ? calculateRiskMetrics(parsedTrade, contracts, 25000) : null;
  const riskCurve = parsedTrade ? generateRiskCurve(parsedTrade, currentPrice, contracts) : [];

  return (
    <div style={{ backgroundColor: colors.bg, color: colors.textPrimary, minHeight: '100vh' }}>
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
              accountValue={25000}
              riskPercentage={2}
              isMobile={isMobile}
              onContractsChange={setContracts}
              onTpChange={setTpPct}
              onSlChange={setSlPct}
              onPriceNudge={(dir) => {}}
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

