'use client';

import { useState, useRef, useEffect } from 'react';
import { AlertCircle, CheckCircle, Plus, Minus, ChevronUp, ChevronDown } from 'lucide-react';
import { useOrders } from '@/stores/useOrders';
import { useTokens } from '@/hooks/useTokens';
import { TradeLeg, LegAction, LegRight, RuleBundle } from '@/types';
import { Button, Chip } from '@/components/ui';

export function DiscordPaste() {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<any>(null);
  const [incomplete, setIncomplete] = useState<string[]>([]);
  const [editedLimitPrice, setEditedLimitPrice] = useState<number | null>(null);
  const [editedLongStrike, setEditedLongStrike] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { setPendingOrder } = useOrders();
  const tokens = useTokens();

  useEffect(() => {
    const handlePaste = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'v') {
        setTimeout(() => {
          if (textareaRef.current?.value) {
            handleParse(textareaRef.current.value);
          }
        }, 10);
      }
    };

    window.addEventListener('keydown', handlePaste);
    return () => window.removeEventListener('keydown', handlePaste);
  }, []);

  const handleParse = (input: string) => {
    setError(null);
    
    try {
      const incompleteTokens: string[] = [];
      const legs: TradeLeg[] = [];
      // Don't auto-apply TP/SL from alerts - user controls this in Preview step
      const ruleBundle: RuleBundle = { takeProfitPct: 50, stopLossPct: 100 };

      // Extract underlying (including NDX, AAPL, TSLA for 8Ball)
      const underlyingMatch = input.match(/\b(SPX|QQQ|SPY|RUT|NDX|AAPL|TSLA)\b/i);
      const underlying = underlyingMatch?.[1]?.toUpperCase() || null;
      if (!underlyingMatch) incompleteTokens.push('underlying');

      // Extract strategy
      const isVertical = /vertical/i.test(input);
      const isButterfly = /butterfly|fly/i.test(input);
      const isSonar = /sonar|iron.condor/i.test(input);
      if (!isVertical && !isButterfly && !isSonar) incompleteTokens.push('strategy');

      // Extract direction
      const directionMatch = input.match(/\b(CALL|PUT)S?\b/i);
      const direction = directionMatch?.[1]?.toUpperCase() || null;
      if (!directionMatch) incompleteTokens.push('direction');

      // Extract strikes (e.g., "6860/6865" or "6850/6860/6870")
      const strikesMatch = input.match(/(\d+)\/(\d+)(?:\/(\d+))?/);
      const longStrike = strikesMatch ? parseInt(strikesMatch[1]) : 0;
      const shortStrike = strikesMatch ? parseInt(strikesMatch[2]) : 0;
      const wingStrike = strikesMatch?.[3] ? parseInt(strikesMatch[3]) : undefined;
      if (!strikesMatch) incompleteTokens.push('strikes');

      // Extract price
      const priceMatch = input.match(/@(\d+\.?\d*)/);
      const limitPrice = priceMatch ? parseFloat(priceMatch[1]) : 0;
      if (!priceMatch) incompleteTokens.push('price');

      // Extract TIF
      const tifMatch = input.match(/\b(LMT|MKT|DAY|GTC)\b/i);
      if (!tifMatch) incompleteTokens.push('tif');

      if (underlying && direction && longStrike > 0 && limitPrice > 0) {
        const today = new Date();
        const expiry = today.toISOString().split('T')[0];

        if (isButterfly && wingStrike) {
          legs.push(
            { action: 'BUY', right: direction as LegRight, strike: longStrike, expiry, quantity: 1 },
            { action: 'SELL', right: direction as LegRight, strike: shortStrike, expiry, quantity: 2 },
            { action: 'BUY', right: direction as LegRight, strike: wingStrike, expiry, quantity: 1 },
          );
        } else {
          legs.push(
            { action: 'BUY', right: direction as LegRight, strike: longStrike, expiry, quantity: 1 },
            { action: 'SELL', right: direction as LegRight, strike: shortStrike, expiry, quantity: 1 },
          );
        }

        // Determine strategy type
        let strategy: string;
        if (isSonar) {
          strategy = 'Iron Condor';
        } else if (isButterfly) {
          strategy = 'Butterfly';
        } else {
          strategy = 'Vertical';
        }

        setParsed({
          underlying,
          strategy,
          direction,
          longStrike,
          shortStrike,
          wingStrike,
          width: shortStrike - longStrike,
          limitPrice,
          tif: tifMatch?.[1]?.toUpperCase() || 'LMT',
        });
        setIncomplete(incompleteTokens);
        setEditedLimitPrice(null);
        setEditedLongStrike(null);

        if (incompleteTokens.length === 0) {
          setPendingOrder({ legs, ruleBundle });
        }
      } else {
        throw new Error('Could not parse trade from text');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parse error');
      setParsed(null);
    }
  };

  const handlePriceNudge = (direction: number) => {
    if (!parsed) return;
    const currentPrice = editedLimitPrice ?? parsed.limitPrice;
    const newPrice = Math.round((currentPrice + (direction * 0.05)) * 100) / 100;
    setEditedLimitPrice(newPrice);
    if (editedLimitPrice === null) {
      // Update pending order
      setPendingOrder({
        legs: [], // Will be recalculated
        ruleBundle: { takeProfitPct: 50, stopLossPct: 100 },
      });
    }
  };

  const handleStrikeNudge = (direction: number) => {
    if (!parsed) return;
    const step = parsed.underlying === 'SPX' || parsed.underlying === 'RUT' ? 5 : 1;
    const currentStrike = editedLongStrike ?? parsed.longStrike;
    const newStrike = currentStrike + (direction * step);
    setEditedLongStrike(newStrike);
  };

  const activeLongStrike = editedLongStrike ?? parsed?.longStrike ?? 0;
  const activeLimitPrice = editedLimitPrice ?? parsed?.limitPrice ?? 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${tokens.space.xl}px` }}>
      {/* Label */}
      <div style={{
        fontSize: `${tokens.type.sizes.xs}px`,
        color: tokens.colors.textSecondary,
        marginBottom: `${tokens.space.sm}px`,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}>
        Paste Discord Alert <kbd style={{ marginLeft: '8px', opacity: 0.7 }}>⌘V</kbd>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={(e) => {
          setTimeout(() => {
            const value = e.currentTarget.value;
            if (value) handleParse(value);
          }, 10);
        }}
        placeholder="SELL -1 Vertical 30 Oct 25 6860/6865 CALL @0.70 LMT"
        style={{
          width: '100%',
          height: '100px',
          padding: `${tokens.space.md}px`,
          backgroundColor: tokens.colors.surface,
          border: `1px solid ${tokens.colors.border}`,
          borderRadius: `${tokens.radius.md}px`,
          color: tokens.colors.textPrimary,
          fontSize: `${tokens.type.sizes.sm}px`,
          fontFamily: 'monospace',
          resize: 'vertical',
          outline: 'none',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = tokens.colors.semantic.info;
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = tokens.colors.border;
        }}
      />

      {error && (
        <div style={{
          padding: `${tokens.space.md}px`,
          backgroundColor: tokens.colors.semantic.risk + '10',
          border: `1px solid ${tokens.colors.semantic.risk}40`,
          borderRadius: `${tokens.radius.md}px`,
          color: tokens.colors.semantic.risk,
          fontSize: `${tokens.type.sizes.sm}px`,
        }}>
          {error}
        </div>
      )}

      {/* Parsed Card */}
      {parsed && (
        <div style={{
          padding: `${tokens.space.lg}px`,
          backgroundColor: tokens.colors.surface,
          border: `1px solid ${incomplete.length > 0 ? tokens.colors.semantic.warning + '40' : tokens.colors.semantic.profit + '40'}`,
          borderRadius: `${tokens.radius.md}px`,
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: `${tokens.space.sm}px`,
            marginBottom: `${tokens.space.lg}px`,
          }}>
            {incomplete.length === 0 ? (
              <CheckCircle size={20} style={{ color: tokens.colors.semantic.profit }} />
            ) : (
              <AlertCircle size={20} style={{ color: tokens.colors.semantic.warning }} />
            )}
            <span style={{
              fontSize: `${tokens.type.sizes.base}px`,
              color: tokens.colors.textPrimary,
            }}>
              {incomplete.length === 0 ? 'Parsed Successfully' : 'Incomplete - Fix Required'}
            </span>
          </div>

          {/* Legs Display */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: `${tokens.space.lg}px`,
            marginBottom: `${tokens.space.lg}px`,
          }}>
            <div>
              <div style={{
                fontSize: `${tokens.type.sizes.xs}px`,
                color: tokens.colors.textSecondary,
                marginBottom: `${tokens.space.xs}px`,
              }}>
                Strategy
              </div>
              <div style={{
                fontSize: `${tokens.type.sizes.lg}px`,
                color: tokens.colors.textPrimary,
              }}>
                {parsed.underlying} {parsed.strategy} {parsed.direction}
              </div>
            </div>

            <div>
              <div style={{
                fontSize: `${tokens.type.sizes.xs}px`,
                color: tokens.colors.textSecondary,
                marginBottom: `${tokens.space.xs}px`,
              }}>
                Strikes <kbd style={{ opacity: 0.7 }}>⇧↑/⇧↓</kbd>
              </div>
              <div style={{
                fontSize: `${tokens.type.sizes.lg}px`,
                color: tokens.colors.textPrimary,
                fontVariantNumeric: 'tabular-nums lining-nums',
              }}>
                {activeLongStrike}/{activeLongStrike + parsed.width}{parsed.wingStrike ? `/${activeLongStrike + (parsed.width * 2)}` : ''}
              </div>
              {editedLongStrike !== null && (
                <div style={{
                  display: 'flex',
                  gap: `${tokens.space.xs}px`,
                  marginTop: `${tokens.space.xs}px`,
                }}>
                  <button
                    onClick={() => handleStrikeNudge(-1)}
                    style={{
                      padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                      borderRadius: `${tokens.radius.sm}px`,
                      border: `1px solid ${tokens.colors.border}`,
                      backgroundColor: 'transparent',
                      color: tokens.colors.textPrimary,
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronDown size={12} />
                  </button>
                  <button
                    onClick={() => handleStrikeNudge(1)}
                    style={{
                      padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                      borderRadius: `${tokens.radius.sm}px`,
                      border: `1px solid ${tokens.colors.border}`,
                      backgroundColor: 'transparent',
                      color: tokens.colors.textPrimary,
                      cursor: 'pointer',
                    }}
                  >
                    <ChevronUp size={12} />
                  </button>
                </div>
              )}
            </div>

            <div>
              <div style={{
                fontSize: `${tokens.type.sizes.xs}px`,
                color: tokens.colors.textSecondary,
                marginBottom: `${tokens.space.xs}px`,
              }}>
                Limit Price <kbd style={{ opacity: 0.7 }}>↑/↓</kbd>
              </div>
              <div style={{
                fontSize: `${tokens.type.sizes.lg}px`,
                color: tokens.colors.textPrimary,
                fontVariantNumeric: 'tabular-nums lining-nums',
              }}>
                ${activeLimitPrice.toFixed(2)} {parsed.tif}
              </div>
              <div style={{
                display: 'flex',
                gap: `${tokens.space.xs}px`,
                marginTop: `${tokens.space.xs}px`,
              }}>
                <button
                  onClick={() => handlePriceNudge(-1)}
                  style={{
                    padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                    borderRadius: `${tokens.radius.sm}px`,
                    border: `1px solid ${tokens.colors.border}`,
                    backgroundColor: 'transparent',
                    color: tokens.colors.textPrimary,
                    cursor: 'pointer',
                  }}
                >
                  <Minus size={12} />
                </button>
                <button
                  onClick={() => handlePriceNudge(1)}
                  style={{
                    padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                    borderRadius: `${tokens.radius.sm}px`,
                    border: `1px solid ${tokens.colors.border}`,
                    backgroundColor: 'transparent',
                    color: tokens.colors.textPrimary,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={12} />
                </button>
                <button
                  onClick={() => setEditedLimitPrice(2.50)} // Mock mid price
                  style={{
                    padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                    borderRadius: `${tokens.radius.sm}px`,
                    border: `1px solid ${tokens.colors.border}`,
                    backgroundColor: 'transparent',
                    color: tokens.colors.textPrimary,
                    cursor: 'pointer',
                    fontSize: `${tokens.type.sizes.xs}px`,
                  }}
                >
                  Set to Mid
                </button>
              </div>
            </div>
          </div>

          {/* Incomplete Tokens */}
          {incomplete.length > 0 && (
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: `${tokens.space.sm}px`,
              marginTop: `${tokens.space.lg}px`,
            }}>
              {incomplete.map((token) => (
                <Chip key={token} variant="rule">
                  Fix: {token}
                </Chip>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
