'use client';

import { useState, useEffect } from 'react';
import { AlertCircle, Plus, Minus } from 'lucide-react';
import { useOrders } from '@/stores/useOrders';
import { useQuotes } from '@/stores/useQuotes';
import { useTokens } from '@/hooks/useTokens';
import { RiskGraph } from './RiskGraph';
import { TradeLeg, RuleBundle } from '@/types';
import { Button } from '@/components/ui';
import { submitTriggerOrder, monitorOrderFill } from '@/lib/tastytrade/orders';
import { orderRegistry } from '@/lib/orderRegistry';
import { getAccount } from '@/lib/tastytrade/client';
import type { OrderLeg } from '@/lib/tastytrade/types';

/**
 * Converts TradeLeg to OrderLeg format.
 * Note: This is a simplified conversion - streamerSymbol may need to be constructed
 * from underlying, expiry, strike, and right in the actual implementation.
 */
function convertTradeLegToOrderLeg(tradeLeg: TradeLeg, underlying: string): OrderLeg {
  // Build streamer symbol format: "SPX   251219P06275000"
  // Format: UNDERLYING + EXPIRY(YYMMDD) + RIGHT(P|C) + STRIKE(8 digits padded)
  const expiryDate = new Date(tradeLeg.expiry);
  const year = expiryDate.getFullYear().toString().slice(-2);
  const month = (expiryDate.getMonth() + 1).toString().padStart(2, '0');
  const day = expiryDate.getDate().toString().padStart(2, '0');
  const rightChar = tradeLeg.right === 'PUT' ? 'P' : 'C';
  const strikeStr = Math.round(tradeLeg.strike * 1000).toString().padStart(8, '0');
  
  const streamerSymbol = `${underlying}   ${year}${month}${day}${rightChar}${strikeStr}`;
  
  // Convert TradeLeg.action ('BUY' | 'SELL') to OrderLeg.action with _TO_OPEN
  const action: OrderLeg['action'] = tradeLeg.action === 'BUY' 
    ? 'BUY_TO_OPEN' 
    : 'SELL_TO_OPEN';
  
  return {
    streamerSymbol,
    action,
    quantity: tradeLeg.quantity,
    price: tradeLeg.price,
  };
}

export function OrderPreview() {
  const { pendingOrder, setPendingOrder, addPosition } = useOrders();
  const { getQuote } = useQuotes();
  const tokens = useTokens();
  const [spreadPrice, setSpreadPrice] = useState<{ bid: number; mid: number; ask: number; last: number; age: number } | null>(null);
  const [maxLoss, setMaxLoss] = useState(0);
  const [maxGain, setMaxGain] = useState(0);
  const [tpPct, setTpPct] = useState(50);
  const [slPct, setSlPct] = useState(100);
  const [timeExit, setTimeExit] = useState('');
  const [useTimeExit, setUseTimeExit] = useState(false);

  useEffect(() => {
    if (!pendingOrder) return;

    // Calculate spread price from legs
    let totalBid = 0;
    let totalAsk = 0;
    let totalLast = 0;

    pendingOrder.legs.forEach((leg) => {
      const quote = getQuote(`${leg.right === 'CALL' ? 'C' : 'P'}_${leg.strike}`);
      if (quote) {
        const legPrice = quote.last || 0;
        const multiplier = leg.action === 'BUY' ? 1 : -1;
        totalBid += (quote.bid || legPrice) * multiplier;
        totalAsk += (quote.ask || legPrice) * multiplier;
        totalLast += legPrice * multiplier;
      }
    });

    const mid = Math.abs((totalBid + totalAsk) / 2);
    setSpreadPrice({
      bid: Math.abs(totalBid),
      mid,
      ask: Math.abs(totalAsk),
      last: Math.abs(totalLast),
      age: 0.5, // Mock age
    });

    // Calculate max loss/gain
    const entryPrice = Math.abs(totalLast);
    const strikes = pendingOrder.legs.map((l) => l.strike);
    const width = Math.max(...strikes) - Math.min(...strikes);
    const calculatedMaxLoss = entryPrice * 100;
    const calculatedMaxGain = (width - entryPrice) * 100;
    
    setMaxLoss(calculatedMaxLoss);
    setMaxGain(calculatedMaxGain);

    // Update pendingOrder with calculated values
    setPendingOrder({
      ...pendingOrder,
      spreadPrice: mid,
      maxLoss: calculatedMaxLoss,
      maxGain: calculatedMaxGain,
    });

    // Update rule bundle
    setTpPct(pendingOrder.ruleBundle.takeProfitPct);
    setSlPct(pendingOrder.ruleBundle.stopLossPct);
    setTimeExit(pendingOrder.ruleBundle.timeExit || '');
    setUseTimeExit(!!pendingOrder.ruleBundle.timeExit);
  }, [pendingOrder, getQuote, setPendingOrder]);

  const handleNudgePrice = (ticks: number) => {
    if (!pendingOrder || !spreadPrice) return;
    const tickSize = 0.05;
    const newMid = Math.max(0.05, spreadPrice.mid + ticks * tickSize);
    setSpreadPrice({ ...spreadPrice, mid: newMid });
  };

  const handleNudgeStrike = (legIndex: number, step: number) => {
    if (!pendingOrder) return;
    const legs = [...pendingOrder.legs];
    const strikeStep = pendingOrder.legs[0]?.strike < 1000 ? 5 : 1; // SPX uses 5, others use 1
    legs[legIndex] = {
      ...legs[legIndex],
      strike: legs[legIndex].strike + (step * strikeStep),
    };
    setPendingOrder({ ...pendingOrder, legs });
  };

  const handleExecute = async () => {
    if (!pendingOrder) return;

    const ruleBundle: RuleBundle = {
      takeProfitPct: tpPct,
      stopLossPct: slPct,
      timeExit: useTimeExit ? timeExit : undefined,
    };

    try {
      // Infer underlying from legs (assuming all legs have same underlying)
      // This is a simplified approach - in production, underlying should be explicit
      const underlying = 'SPX'; // TODO: Extract from pendingOrder or TradeLeg
      
      // Convert TradeLeg[] to OrderLeg[]
      const entryLegs = pendingOrder.legs.map(leg => 
        convertTradeLegToOrderLeg(leg, underlying)
      );
      
      const entryPrice = spreadPrice?.mid || 0;
      
      // Get account ID from Tastytrade
      let accountId: string;
      try {
        const account = await getAccount();
        accountId = account.accountNumber;
      } catch (error) {
        console.error('Failed to get account ID:', error);
        throw new Error('Failed to get account ID. Please check your Tastytrade configuration.');
      }
      
      // Determine price effect based on order type
      // For spreads, debit = buying the spread, credit = selling the spread
      // For now, default to Debit - this can be determined from strategy type later
      const priceEffect: 'Debit' | 'Credit' = 'Debit';
      
      // If TP/SL are configured, submit trigger order and set up monitoring
      if ((tpPct > 0 || slPct > 0) && entryPrice > 0) {
        try {
          // Submit trigger order first
          const triggerOrder = await submitTriggerOrder(
            entryLegs,
            entryPrice,
            accountId,
            priceEffect,
            'GTC'
          );
          
          // Store TP/SL percentages for later
          await orderRegistry.storeOTOCOGroup(triggerOrder.id, {
            triggerOrderId: triggerOrder.id,
            accountId,
            tpPct,
            slPct,
            entryPrice,
            entryLegs,
          });
          
          // Start monitoring for fill (non-blocking)
          // The monitoring function will handle errors internally
          monitorOrderFill(triggerOrder.id, accountId).catch((err) => {
            // Error handling: log and notify user
            console.error('Order monitoring failed:', err);
            // TODO: Show notification to user via toast/notification system
          });
          
          // Add position with pending status (will be updated when filled)
          addPosition({
            id: triggerOrder.id,
            underlying: underlying as any,
            strategy: pendingOrder.legs.length === 2 ? 'Vertical' : 'Butterfly',
            legs: pendingOrder.legs,
            qty: pendingOrder.legs[0]?.quantity || 1,
            avgPrice: entryPrice,
            pnl: 0,
            ruleBundle,
            state: 'PENDING',
            openedAt: new Date().toISOString(),
          });
          
          setPendingOrder(null);
          return;
        } catch (error) {
          // Error handling: log and show user-friendly message
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Trigger order submission failed:', error);
          // TODO: Show error notification to user via toast/notification system
          alert(`Failed to submit order: ${errorMessage}`);
          throw error;
        }
      } else {
        // No TP/SL configured, submit as regular order
        // For now, using placeholder - proper implementation needed
        const result = { id: `ORDER-${Date.now()}`, status: 'PENDING' as const };

        addPosition({
          id: result.id,
          underlying: underlying as any,
          strategy: pendingOrder.legs.length === 2 ? 'Vertical' : 'Butterfly',
          legs: pendingOrder.legs,
          qty: pendingOrder.legs[0]?.quantity || 1,
          avgPrice: entryPrice,
          pnl: 0,
          ruleBundle,
          state: 'FILLED',
          openedAt: new Date().toISOString(),
        });

        setPendingOrder(null);
      }
    } catch (err) {
      console.error('Order execution failed:', err);
      // TODO: Show error notification to user
    }
  };

  if (!pendingOrder) {
    return null;
  }

  const isStale = spreadPrice && spreadPrice.age >= 1.5;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: `${tokens.space.xl}px` }}>
      {/* Spread Panel */}
      <div style={{
        padding: `${tokens.space.lg}px`,
        backgroundColor: tokens.colors.surface,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: `${tokens.radius.md}px`,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: `${tokens.space.lg}px`,
        }}>
          <div style={{
            fontSize: `${tokens.type.sizes.xs}px`,
            color: tokens.colors.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            Spread Price
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.sm}px` }}>
            <span style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: tokens.colors.textSecondary,
            }}>
              Live
            </span>
            
            <span style={{
              padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
              borderRadius: `${tokens.radius.lg}px`,
              fontSize: `${tokens.type.sizes.xs}px`,
              backgroundColor: isStale ? tokens.colors.semantic.warning + '15' : tokens.colors.border,
              border: `1px solid ${isStale ? tokens.colors.semantic.warning + '40' : tokens.colors.border}`,
              color: isStale ? tokens.colors.semantic.warning : tokens.colors.textSecondary,
              fontVariantNumeric: 'tabular-nums lining-nums',
              display: 'flex',
              alignItems: 'center',
              gap: `${tokens.space.xs}px`,
            }}>
              {isStale && <AlertCircle size={12} />}
              {spreadPrice?.age.toFixed(1) || '0.0'}s
            </span>
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: `${tokens.space.lg}px`,
        }}>
          <div>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: tokens.colors.textSecondary,
              marginBottom: `${tokens.space.xs}px`,
            }}>
              Bid
            </div>
            <div style={{
              fontSize: `${tokens.type.sizes.xxl}px`,
              color: tokens.colors.semantic.risk,
              fontVariantNumeric: 'tabular-nums lining-nums',
            }}>
              {spreadPrice?.bid.toFixed(2) || '—'}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: tokens.colors.textSecondary,
              marginBottom: `${tokens.space.xs}px`,
            }}>
              Mid
            </div>
            <div style={{
              fontSize: `${tokens.type.sizes.xxl}px`,
              color: tokens.colors.textPrimary,
              fontVariantNumeric: 'tabular-nums lining-nums',
              fontWeight: tokens.type.weights.medium,
            }}>
              {spreadPrice?.mid.toFixed(2) || '—'}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: tokens.colors.textSecondary,
              marginBottom: `${tokens.space.xs}px`,
            }}>
              Ask
            </div>
            <div style={{
              fontSize: `${tokens.type.sizes.xxl}px`,
              color: tokens.colors.semantic.profit,
              fontVariantNumeric: 'tabular-nums lining-nums',
            }}>
              {spreadPrice?.ask.toFixed(2) || '—'}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: tokens.colors.textSecondary,
              marginBottom: `${tokens.space.xs}px`,
            }}>
              Last
            </div>
            <div style={{
              fontSize: `${tokens.type.sizes.xxl}px`,
              color: tokens.colors.textPrimary,
              fontVariantNumeric: 'tabular-nums lining-nums',
            }}>
              {spreadPrice?.last.toFixed(2) || '—'}
            </div>
          </div>
        </div>
      </div>

      {/* Exit Rules */}
      <div style={{
        padding: `${tokens.space.lg}px`,
        backgroundColor: tokens.colors.surface,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: `${tokens.radius.md}px`,
      }}>
        <div style={{
          fontSize: `${tokens.type.sizes.xs}px`,
          color: tokens.colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: `${tokens.space.lg}px`,
        }}>
          Exit Rules (Attached Pre-Send)
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: `${tokens.space.lg}px`,
        }}>
          {/* TP% */}
          <div>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: tokens.colors.textSecondary,
              marginBottom: `${tokens.space.sm}px`,
            }}>
              Take Profit %
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: tokens.colors.bg,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: `${tokens.radius.md}px`,
              overflow: 'hidden',
            }}>
              <button
                onClick={() => setTpPct(Math.max(0, tpPct - 5))}
                style={{
                  width: '36px',
                  height: '36px',
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
                value={tpPct}
                onChange={(e) => setTpPct(parseInt(e.target.value) || 0)}
                style={{
                  flex: 1,
                  height: '36px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: tokens.colors.textPrimary,
                  fontSize: `${tokens.type.sizes.base}px`,
                  fontVariantNumeric: 'tabular-nums lining-nums',
                  textAlign: 'center',
                  outline: 'none',
                }}
              />
              
              <button
                onClick={() => setTpPct(tpPct + 5)}
                style={{
                  width: '36px',
                  height: '36px',
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
          </div>

          {/* SL% */}
          <div>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: tokens.colors.textSecondary,
              marginBottom: `${tokens.space.sm}px`,
            }}>
              Stop Loss %
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: tokens.colors.bg,
              border: `1px solid ${tokens.colors.border}`,
              borderRadius: `${tokens.radius.md}px`,
              overflow: 'hidden',
            }}>
              <button
                onClick={() => setSlPct(Math.max(0, slPct - 5))}
                style={{
                  width: '36px',
                  height: '36px',
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
                value={slPct}
                onChange={(e) => setSlPct(parseInt(e.target.value) || 0)}
                style={{
                  flex: 1,
                  height: '36px',
                  backgroundColor: 'transparent',
                  border: 'none',
                  color: tokens.colors.textPrimary,
                  fontSize: `${tokens.type.sizes.base}px`,
                  fontVariantNumeric: 'tabular-nums lining-nums',
                  textAlign: 'center',
                  outline: 'none',
                }}
              />
              
              <button
                onClick={() => setSlPct(slPct + 5)}
                style={{
                  width: '36px',
                  height: '36px',
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
          </div>

          {/* Time Exit */}
          <div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${tokens.space.sm}px`,
              marginBottom: `${tokens.space.sm}px`,
            }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.sm}px`, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={useTimeExit}
                  onChange={(e) => setUseTimeExit(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{
                  fontSize: `${tokens.type.sizes.xs}px`,
                  color: tokens.colors.textSecondary,
                }}>
                  Time Exit
                </span>
              </label>
            </div>
            {useTimeExit && (
              <input
                type="text"
                value={timeExit}
                onChange={(e) => setTimeExit(e.target.value)}
                placeholder="13:00"
                style={{
                  width: '100%',
                  padding: `${tokens.space.md}px`,
                  backgroundColor: tokens.colors.bg,
                  border: `1px solid ${tokens.colors.border}`,
                  borderRadius: `${tokens.radius.md}px`,
                  color: tokens.colors.textPrimary,
                  fontSize: `${tokens.type.sizes.sm}px`,
                  outline: 'none',
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Position Summary */}
      <div style={{
        padding: `${tokens.space.lg}px`,
        backgroundColor: tokens.colors.bg,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: `${tokens.radius.md}px`,
      }}>
        <div style={{
          fontSize: `${tokens.type.sizes.xs}px`,
          color: tokens.colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: `${tokens.space.md}px`,
        }}>
          Position Summary
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: `${tokens.space.lg}px`,
        }}>
          <div>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: tokens.colors.textSecondary,
              marginBottom: `${tokens.space.xs}px`,
            }}>
              Max Gain
            </div>
            <div style={{
              fontSize: `${tokens.type.sizes.lg}px`,
              color: tokens.colors.semantic.profit,
              fontVariantNumeric: 'tabular-nums lining-nums',
            }}>
              +${maxGain.toFixed(0)}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: tokens.colors.textSecondary,
              marginBottom: `${tokens.space.xs}px`,
            }}>
              Max Loss
            </div>
            <div style={{
              fontSize: `${tokens.type.sizes.lg}px`,
              color: tokens.colors.semantic.risk,
              fontVariantNumeric: 'tabular-nums lining-nums',
            }}>
              -${maxLoss.toFixed(0)}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: tokens.colors.textSecondary,
              marginBottom: `${tokens.space.xs}px`,
            }}>
              Contracts
            </div>
            <div style={{
              fontSize: `${tokens.type.sizes.lg}px`,
              color: tokens.colors.textPrimary,
              fontVariantNumeric: 'tabular-nums lining-nums',
            }}>
              {pendingOrder.legs[0]?.quantity || 1}
            </div>
          </div>

          <div>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: tokens.colors.textSecondary,
              marginBottom: `${tokens.space.xs}px`,
            }}>
              R:R
            </div>
            <div style={{
              fontSize: `${tokens.type.sizes.lg}px`,
              color: tokens.colors.textPrimary,
              fontVariantNumeric: 'tabular-nums lining-nums',
            }}>
              {maxLoss > 0 ? ((maxGain / maxLoss) * 100).toFixed(1) : '0.0'}%
            </div>
          </div>
        </div>
      </div>

      {/* Nudge Controls */}
      <div style={{
        padding: `${tokens.space.lg}px`,
        backgroundColor: tokens.colors.surface,
        border: `1px solid ${tokens.colors.border}`,
        borderRadius: `${tokens.radius.md}px`,
      }}>
        <div style={{
          fontSize: `${tokens.type.sizes.xs}px`,
          color: tokens.colors.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: `${tokens.space.md}px`,
        }}>
          Nudge Controls
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: `${tokens.space.md}px`,
        }}>
          <div>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: tokens.colors.textSecondary,
              marginBottom: `${tokens.space.xs}px`,
            }}>
              Price Nudge <kbd style={{ opacity: 0.7 }}>↑/↓</kbd>
            </div>
            <div style={{ display: 'flex', gap: `${tokens.space.xs}px` }}>
              <button
                onClick={() => handleNudgePrice(-1)}
                style={{
                  flex: 1,
                  padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.sm}px`,
                  border: `1px solid ${tokens.colors.border}`,
                  backgroundColor: tokens.colors.bg,
                  color: tokens.colors.textPrimary,
                  cursor: 'pointer',
                  fontSize: `${tokens.type.sizes.xs}px`,
                }}
              >
                ↓ -0.05
              </button>
              <button
                onClick={() => handleNudgePrice(1)}
                style={{
                  flex: 1,
                  padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.sm}px`,
                  border: `1px solid ${tokens.colors.border}`,
                  backgroundColor: tokens.colors.bg,
                  color: tokens.colors.textPrimary,
                  cursor: 'pointer',
                  fontSize: `${tokens.type.sizes.xs}px`,
                }}
              >
                ↑ +0.05
              </button>
            </div>
          </div>

          <div>
            <div style={{
              fontSize: `${tokens.type.sizes.xs}px`,
              color: tokens.colors.textSecondary,
              marginBottom: `${tokens.space.xs}px`,
            }}>
              Strike Nudge <kbd style={{ opacity: 0.7 }}>⇧↑/⇧↓</kbd>
            </div>
            <div style={{ display: 'flex', gap: `${tokens.space.xs}px` }}>
              <button
                onClick={() => handleNudgeStrike(0, -5)}
                style={{
                  flex: 1,
                  padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.sm}px`,
                  border: `1px solid ${tokens.colors.border}`,
                  backgroundColor: tokens.colors.bg,
                  color: tokens.colors.textPrimary,
                  cursor: 'pointer',
                  fontSize: `${tokens.type.sizes.xs}px`,
                }}
              >
                ↓ -5
              </button>
              <button
                onClick={() => handleNudgeStrike(0, 5)}
                style={{
                  flex: 1,
                  padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.sm}px`,
                  border: `1px solid ${tokens.colors.border}`,
                  backgroundColor: tokens.colors.bg,
                  color: tokens.colors.textPrimary,
                  cursor: 'pointer',
                  fontSize: `${tokens.type.sizes.xs}px`,
                }}
              >
                ↑ +5
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Execute Button */}
      <Button
        variant="primary"
        onClick={handleExecute}
        style={{ width: '100%' }}
      >
        Execute Trade <kbd style={{ marginLeft: '8px', opacity: 0.7 }}>⌘↵</kbd>
      </Button>
    </div>
  );
}
