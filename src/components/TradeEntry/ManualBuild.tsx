'use client';

import { useState } from 'react';
import { useOrders } from '@/stores/useOrders';
import { useQuotes } from '@/stores/useQuotes';
import { useTokens } from '@/hooks/useTokens';
import { TradeLeg, LegAction, LegRight, Underlying } from '@/types';
import { Input, Button } from '@/components/ui';

export function ManualBuild() {
  const { setPendingOrder } = useOrders();
  const { getQuote } = useQuotes();
  const tokens = useTokens();
  const [underlying, setUnderlying] = useState<Underlying>('SPX');
  const [delta, setDelta] = useState(50);
  const [width, setWidth] = useState(10);
  const [strategy, setStrategy] = useState<'Vertical' | 'Butterfly'>('Vertical');
  const [direction, setDirection] = useState<'CALL' | 'PUT'>('CALL');
  const [limitPrice, setLimitPrice] = useState(0);
  const [tif, setTif] = useState<'LMT' | 'MKT' | 'DAY' | 'GTC'>('LMT');

  const handleDeltaSnap = () => {
    const quote = getQuote(underlying);
    if (!quote) return;

    const underlyingPrice = quote.last;
    const today = new Date();
    const expiry = today.toISOString().split('T')[0];

    let legs: TradeLeg[] = [];

    if (strategy === 'Vertical') {
      const targetStrike = Math.round(underlyingPrice);
      
      legs = [
        {
          action: 'BUY',
          right: direction,
          strike: targetStrike,
          expiry,
          quantity: 1,
        },
        {
          action: 'SELL',
          right: direction,
          strike: targetStrike + width,
          expiry,
          quantity: 1,
        },
      ];
    } else {
      const center = Math.round(underlyingPrice / 5) * 5;
      
      legs = [
        { action: 'BUY', right: direction, strike: center - width, expiry, quantity: 1 },
        { action: 'SELL', right: direction, strike: center, expiry, quantity: 2 },
        { action: 'BUY', right: direction, strike: center + width, expiry, quantity: 1 },
      ];
    }

    setPendingOrder({
      legs,
      ruleBundle: { takeProfitPct: 50, stopLossPct: 100 },
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${tokens.space.lg}px` }}>
      {/* Underlying */}
      <div>
        <label style={{
          display: 'block',
          fontSize: `${tokens.type.sizes.xs}px`,
          color: tokens.colors.textSecondary,
          marginBottom: `${tokens.space.xs}px`,
        }}>
          Underlying
        </label>
        <select
          value={underlying}
          onChange={(e) => setUnderlying(e.target.value as Underlying)}
          style={{
            width: '100%',
            padding: `${tokens.space.md}px`,
            backgroundColor: tokens.colors.surface,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: `${tokens.radius.md}px`,
            color: tokens.colors.textPrimary,
            fontSize: `${tokens.type.sizes.sm}px`,
            outline: 'none',
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = tokens.colors.semantic.info;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = tokens.colors.border;
          }}
        >
          <option value="SPX">SPX</option>
          <option value="QQQ">QQQ</option>
        </select>
      </div>

      {/* Strategy */}
      <div>
        <label style={{
          display: 'block',
          fontSize: `${tokens.type.sizes.xs}px`,
          color: tokens.colors.textSecondary,
          marginBottom: `${tokens.space.xs}px`,
        }}>
          Strategy
        </label>
        <select
          value={strategy}
          onChange={(e) => setStrategy(e.target.value as 'Vertical' | 'Butterfly')}
          style={{
            width: '100%',
            padding: `${tokens.space.md}px`,
            backgroundColor: tokens.colors.surface,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: `${tokens.radius.md}px`,
            color: tokens.colors.textPrimary,
            fontSize: `${tokens.type.sizes.sm}px`,
            outline: 'none',
          }}
        >
          <option value="Vertical">Vertical</option>
          <option value="Butterfly">Butterfly</option>
        </select>
      </div>

      {/* Direction */}
      <div>
        <label style={{
          display: 'block',
          fontSize: `${tokens.type.sizes.xs}px`,
          color: tokens.colors.textSecondary,
          marginBottom: `${tokens.space.xs}px`,
        }}>
          Direction
        </label>
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
                fontSize: `${tokens.type.sizes.sm}px`,
              }}
            >
              {dir}
            </button>
          ))}
        </div>
      </div>

      {/* Delta */}
      <div>
        <label style={{
          display: 'block',
          fontSize: `${tokens.type.sizes.xs}px`,
          color: tokens.colors.textSecondary,
          marginBottom: `${tokens.space.xs}px`,
        }}>
          Target Δ: {delta}
        </label>
        <input
          type="range"
          min="-100"
          max="100"
          value={delta}
          onChange={(e) => setDelta(parseInt(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Width */}
      <div>
        <label style={{
          display: 'block',
          fontSize: `${tokens.type.sizes.xs}px`,
          color: tokens.colors.textSecondary,
          marginBottom: `${tokens.space.xs}px`,
        }}>
          Width: {width}
        </label>
        <input
          type="range"
          min="5"
          max="50"
          step="5"
          value={width}
          onChange={(e) => setWidth(parseInt(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      {/* Limit Price */}
      <div>
        <label style={{
          display: 'block',
          fontSize: `${tokens.type.sizes.xs}px`,
          color: tokens.colors.textSecondary,
          marginBottom: `${tokens.space.xs}px`,
        }}>
          Limit Price
        </label>
        <Input
          type="number"
          value={limitPrice || ''}
          onChange={(e) => setLimitPrice(parseFloat(e.target.value) || 0)}
          step="0.05"
          placeholder="0.00"
        />
      </div>

      {/* TIF */}
      <div>
        <label style={{
          display: 'block',
          fontSize: `${tokens.type.sizes.xs}px`,
          color: tokens.colors.textSecondary,
          marginBottom: `${tokens.space.xs}px`,
        }}>
          Time In Force
        </label>
        <select
          value={tif}
          onChange={(e) => setTif(e.target.value as typeof tif)}
          style={{
            width: '100%',
            padding: `${tokens.space.md}px`,
            backgroundColor: tokens.colors.surface,
            border: `1px solid ${tokens.colors.border}`,
            borderRadius: `${tokens.radius.md}px`,
            color: tokens.colors.textPrimary,
            fontSize: `${tokens.type.sizes.sm}px`,
            outline: 'none',
          }}
        >
          <option value="LMT">LMT</option>
          <option value="MKT">MKT</option>
          <option value="DAY">DAY</option>
          <option value="GTC">GTC</option>
        </select>
      </div>

      {/* Δ-Snap Button */}
      <Button variant="primary" onClick={handleDeltaSnap}>
        Δ-Snap
      </Button>
    </div>
  );
}
