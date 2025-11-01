'use client';

import { useEffect, useState } from 'react';
import { Settings, ChevronUp, ChevronDown, Plus, Minus } from 'lucide-react';
import { useSchedule } from '@/stores/useSchedule';
import { useOrders } from '@/stores/useOrders';
import { useQuotes } from '@/stores/useQuotes';
import { useTokens } from '@/hooks/useTokens';
import { ScheduledBlock, TradeLeg, LegAction, LegRight } from '@/types';
import { Button } from '@/components/ui';

export function PresetEntry() {
  const { currentBlock, getCurrentBlock } = useSchedule();
  const { setPendingOrder } = useOrders();
  const { getQuote } = useQuotes();
  const tokens = useTokens();
  const [armed, setArmed] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [direction, setDirection] = useState<'CALL' | 'PUT'>('CALL');
  const [longStrike, setLongStrike] = useState(0);
  const [limitPrice, setLimitPrice] = useState(0);

  useEffect(() => {
    getCurrentBlock();
    const interval = setInterval(() => {
      getCurrentBlock();
      const block = getCurrentBlock();
      
      if (block) {
        const now = new Date();
        const [hour, min] = block.time.split(':').map(Number);
        const blockStart = new Date();
        blockStart.setHours(hour, min, 0, 0);
        const blockEnd = new Date(blockStart.getTime() + 10 * 60 * 1000);
        
        if (now >= blockStart && now < blockEnd) {
          const remaining = blockEnd.getTime() - now.getTime();
          setCountdown(Math.floor(remaining / 1000));
          
          if (!armed && remaining > 0 && remaining < 250) {
            setArmed(true);
            buildPresetOrder(block);
          }
        } else {
          setCountdown(null);
          setArmed(false);
        }
      }
    }, 100);

    return () => clearInterval(interval);
  }, [getCurrentBlock, armed]);

  useEffect(() => {
    if (currentBlock) {
      const quote = getQuote(currentBlock.underlying);
      if (quote) {
        const underlyingPrice = quote.last;
        const targetStrike = Math.round(underlyingPrice / 5) * 5;
        setLongStrike(targetStrike);
        setLimitPrice(2.45); // Mock price
      }
    }
  }, [currentBlock, getQuote]);

  const buildPresetOrder = (block: ScheduledBlock) => {
    const quote = getQuote(block.underlying);
    if (!quote) return;

    const underlyingPrice = quote.last;
    const today = new Date();
    const expiry = today.toISOString().split('T')[0];

    let legs: TradeLeg[] = [];

    if (block.strategy === 'Vertical' && block.delta && block.width) {
      const targetStrike = Math.round(underlyingPrice);
      const width = block.width;
      
      legs = [
        {
          action: 'BUY',
          right: block.delta > 0 ? 'CALL' : 'PUT',
          strike: targetStrike,
          expiry,
          quantity: 1,
        },
        {
          action: 'SELL',
          right: block.delta > 0 ? 'CALL' : 'PUT',
          strike: targetStrike + (block.delta > 0 ? width : -width),
          expiry,
          quantity: 1,
        },
      ];
    } else if (block.strategy.includes('Butterfly')) {
      const center = Math.round(underlyingPrice / 5) * 5;
      const width = block.width || 10;
      
      legs = [
        { action: 'BUY', right: 'CALL', strike: center - width, expiry, quantity: 1 },
        { action: 'SELL', right: 'CALL', strike: center, expiry, quantity: 2 },
        { action: 'BUY', right: 'CALL', strike: center + width, expiry, quantity: 1 },
      ];
    }

    if (legs.length > 0) {
      setPendingOrder({
        legs,
        ruleBundle: block.ruleBundle || { takeProfitPct: 50, stopLossPct: 100 },
      });
    }
  };

  const handleDeltaSnap = () => {
    const quote = currentBlock ? getQuote(currentBlock.underlying) : null;
    if (!quote || !currentBlock?.delta) return;
    
    const underlyingPrice = quote.last;
    const targetStrike = Math.round(underlyingPrice / 5) * 5;
    setLongStrike(targetStrike);
  };

  const handleNudgeStrike = (step: number) => {
    if (!currentBlock) return;
    const strikeStep = currentBlock.underlying === 'SPX' ? 5 : 1;
    setLongStrike(prev => prev + (step * strikeStep));
  };

  if (!currentBlock || !currentBlock.delta) {
    return (
      <div style={{
        padding: `${tokens.space.xl}px`,
        textAlign: 'center',
        color: tokens.colors.textSecondary,
        fontSize: `${tokens.type.sizes.sm}px`,
      }}>
        No preset available for current block
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${tokens.space.xl}px` }}>
      {/* Preset Info Card */}
      <div style={{
        padding: `${tokens.space.lg}px`,
        backgroundColor: tokens.colors.semantic.info + '15',
        border: `1px solid ${tokens.colors.semantic.info}40`,
        borderRadius: `${tokens.radius.md}px`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: `${tokens.space.sm}px`,
          marginBottom: `${tokens.space.md}px`,
        }}>
          <Settings size={20} style={{ color: tokens.colors.semantic.info }} />
          <span style={{
            fontSize: `${tokens.type.sizes.base}px`,
            color: tokens.colors.textPrimary,
            fontWeight: tokens.type.weights.medium,
          }}>
            Auto-Armed Preset
          </span>
          {armed && (
            <span style={{
              padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
              backgroundColor: tokens.colors.semantic.profit + '20',
              color: tokens.colors.semantic.profit,
              borderRadius: `${tokens.radius.sm}px`,
              fontSize: `${tokens.type.sizes.xs}px`,
              fontWeight: tokens.type.weights.medium,
              animation: 'pulse 2s infinite',
            }}>
              Ready
            </span>
          )}
        </div>
        <div style={{
          fontSize: `${tokens.type.sizes.sm}px`,
          color: tokens.colors.textSecondary,
        }}>
          {currentBlock.underlying} {currentBlock.strategy} at {(currentBlock.delta * 100).toFixed(0)}Δ, {currentBlock.width || 10}pt wide
        </div>
      </div>

      {/* Direction Toggle */}
      <div>
        <div style={{
          fontSize: `${tokens.type.sizes.xs}px`,
          color: tokens.colors.textSecondary,
          marginBottom: `${tokens.space.sm}px`,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Direction
        </div>
        <div style={{
          display: 'flex',
          gap: `${tokens.space.sm}px`,
        }}>
          {(['CALL', 'PUT'] as const).map((dir) => (
            <button
              key={dir}
              onClick={() => setDirection(dir)}
              style={{
                flex: 1,
                padding: `${tokens.space.md}px`,
                borderRadius: `${tokens.radius.md}px`,
                border: `1px solid ${direction === dir ? tokens.colors.semantic.info : tokens.colors.border}`,
                backgroundColor: direction === dir ? tokens.colors.semantic.info + '15' : tokens.colors.surface,
                color: direction === dir ? tokens.colors.semantic.info : tokens.colors.textPrimary,
                cursor: 'pointer',
                fontSize: `${tokens.type.sizes.base}px`,
                transition: `all ${tokens.motion.fast}`,
              }}
            >
              {dir}
            </button>
          ))}
        </div>
      </div>

      {/* Strike with Delta Snap */}
      <div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: `${tokens.space.sm}px`,
        }}>
          <div style={{
            fontSize: `${tokens.type.sizes.xs}px`,
            color: tokens.colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Short Strike <kbd style={{ marginLeft: '8px', opacity: 0.7 }}>⇧↑/⇧↓</kbd>
          </div>
          <button
            onClick={handleDeltaSnap}
            style={{
              padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
              borderRadius: `${tokens.radius.sm}px`,
              border: `1px solid ${tokens.colors.border}`,
              backgroundColor: tokens.colors.surface,
              color: tokens.colors.textPrimary,
              cursor: 'pointer',
              fontSize: `${tokens.type.sizes.xs}px`,
            }}
          >
            Snap to {(currentBlock.delta * 100).toFixed(0)}Δ
          </button>
        </div>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          backgroundColor: tokens.colors.surface,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: `${tokens.radius.md}px`,
          overflow: 'hidden',
        }}>
          <button
            onClick={() => handleNudgeStrike(-1)}
            style={{
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderRight: `1px solid ${tokens.colors.border}`,
              color: tokens.colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            <ChevronDown size={16} />
          </button>
          
          <div style={{
            flex: 1,
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: tokens.colors.textPrimary,
            fontSize: `${tokens.type.sizes.xl}px`,
            fontVariantNumeric: 'tabular-nums lining-nums',
          }}>
            {longStrike}
          </div>
          
          <button
            onClick={() => handleNudgeStrike(1)}
            style={{
              width: '44px',
              height: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'transparent',
              border: 'none',
              borderLeft: `1px solid ${tokens.colors.border}`,
              color: tokens.colors.textSecondary,
              cursor: 'pointer',
            }}
          >
            <ChevronUp size={16} />
          </button>
        </div>
        
        <div style={{
          marginTop: `${tokens.space.sm}px`,
          fontSize: `${tokens.type.sizes.xs}px`,
          color: tokens.colors.textSecondary,
        }}>
          Short Strike: {longStrike + (currentBlock.width || 10)} ({(currentBlock.width || 10)}pt spread)
        </div>
      </div>

      {/* Limit Price */}
      <div>
        <div style={{
          fontSize: `${tokens.type.sizes.xs}px`,
          color: tokens.colors.textSecondary,
          marginBottom: `${tokens.space.sm}px`,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          Limit Price <kbd style={{ marginLeft: '8px', opacity: 0.7 }}>↑/↓</kbd>
        </div>
        
        <div style={{
          display: 'flex',
          gap: `${tokens.space.md}px`,
          alignItems: 'center',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: tokens.colors.surface,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: `${tokens.radius.md}px`,
            overflow: 'hidden',
          }}>
            <button
              onClick={() => setLimitPrice(prev => Math.max(0, Math.round((prev - 0.05) * 100) / 100))}
              style={{
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                borderRight: `1px solid ${tokens.colors.border}`,
                color: tokens.colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              <Minus size={16} />
            </button>
            
            <input
              type="number"
              value={limitPrice.toFixed(2)}
              onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
              step="0.05"
              style={{
                width: '120px',
                height: '44px',
                backgroundColor: 'transparent',
                border: 'none',
                color: tokens.colors.textPrimary,
                fontSize: `${tokens.type.sizes.xl}px`,
                fontVariantNumeric: 'tabular-nums lining-nums',
                textAlign: 'center',
                outline: 'none',
              }}
            />
            
            <button
              onClick={() => setLimitPrice(prev => Math.round((prev + 0.05) * 100) / 100)}
              style={{
                width: '44px',
                height: '44px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'transparent',
                border: 'none',
                borderLeft: `1px solid ${tokens.colors.border}`,
                color: tokens.colors.textSecondary,
                cursor: 'pointer',
              }}
            >
              <Plus size={16} />
            </button>
          </div>
          
          <button
            onClick={() => setLimitPrice(2.50)} // Mock mid
            style={{
              padding: `${tokens.space.md}px`,
              borderRadius: `${tokens.radius.md}px`,
              border: `1px solid ${tokens.colors.border}`,
              backgroundColor: tokens.colors.surface,
              color: tokens.colors.textPrimary,
              cursor: 'pointer',
              fontSize: `${tokens.type.sizes.xs}px`,
            }}
          >
            Set to Mid
          </button>
        </div>
      </div>

      {/* Countdown */}
      {countdown !== null && (
        <div style={{
          padding: `${tokens.space.lg}px`,
          backgroundColor: tokens.colors.surface,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: `${tokens.radius.md}px`,
        }}>
          <div style={{
            fontSize: `${tokens.type.sizes.xs}px`,
            color: tokens.colors.textSecondary,
            marginBottom: `${tokens.space.sm}px`,
          }}>
            Block Countdown
          </div>
          <div style={{
            fontSize: `${tokens.type.sizes.xl}px`,
            color: tokens.colors.semantic.info,
            fontVariantNumeric: 'tabular-nums lining-nums',
          }}>
            {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
          </div>
        </div>
      )}
    </div>
  );
}
