'use client';

import { useEffect, useState, useCallback } from 'react';
import { Position } from '@/types';
import { X, Target, StopCircle } from 'lucide-react';
import { updateTPOrder, updateSLOrder, cancelTPOrder, cancelSLOrder, calculateTPPrice, calculateSLPrice, submitNewTPOrder, submitNewSLOrder, buildExitLegs } from '@/lib/tastytrade/orders';
import { orderRegistry } from '@/lib/orderRegistry';
import type { OrderLeg } from '@/lib/tastytrade/types';

// Design tokens matching Figma
const TOKENS = {
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { md: 12, lg: 16 },
  type: { xs: 12, sm: 14, base: 16, lg: 18, xl: 24, xxl: 32 },
  color: {
    semantic: {
      profit: '#82D895',
      risk: '#EC612B',
    }
  }
};

// Helper function to extract symbol and strategy separately
function getSymbolAndStrategy(position: Position): { symbol: string; strategy: string } {
  if (position.strategy === 'SPOT') {
    return { symbol: position.underlying, strategy: '' };
  }
  
  // For spreads, extract strikes
  const strikes = position.legs
    .filter(leg => leg.strike > 0)
    .map(leg => leg.strike)
    .sort((a, b) => a - b);
  
  if (strikes.length === 0) {
    return { symbol: position.underlying, strategy: position.strategy };
  }
  
  // For butterfly, show all strikes
  if (position.strategy === 'Butterfly' && strikes.length === 3) {
    const callOrPut = position.legs[0]?.right === 'CALL' ? 'Call' : 'Put';
    return {
      symbol: position.underlying,
      strategy: `${strikes[0]}/${strikes[1]}/${strikes[2]} ${callOrPut} ${position.strategy}`
    };
  }
  
  // For vertical, show two strikes
  if (position.strategy === 'Vertical' && strikes.length >= 2) {
    const uniqueStrikes = [...new Set(strikes)];
    const callOrPut = position.legs[0]?.right === 'CALL' ? 'Call' : 'Put';
    if (uniqueStrikes.length === 2) {
      return {
        symbol: position.underlying,
        strategy: `${uniqueStrikes[0]}/${uniqueStrikes[1]} ${callOrPut} ${position.strategy}`
      };
    }
    return {
      symbol: position.underlying,
      strategy: `${uniqueStrikes[0]}/${uniqueStrikes[uniqueStrikes.length - 1]} ${callOrPut} ${position.strategy}`
    };
  }
  
  return { symbol: position.underlying, strategy: position.strategy };
}

// Helper function to determine state (Profit, Risk, Neutral)
function getPositionState(position: Position): 'profit' | 'risk' | 'neutral' {
  if (position.pnl > 0) return 'profit';
  if (position.pnl < 0) return 'risk';
  return 'neutral';
}

// P/L Ring component matching Figma (28x28px, 10px radius)
function PLRing({ percent }: { percent: number }) {
  const isProfit = percent >= 0;
  const absPercent = Math.min(Math.abs(percent), 100);
  const circumference = 2 * Math.PI * 10;
  const offset = circumference - (absPercent / 100) * circumference;

  return (
    <svg width="28" height="28">
      <circle
        cx="14"
        cy="14"
        r="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="text-border-dark dark:text-border-dark"
      />
      <circle
        cx="14"
        cy="14"
        r="10"
        fill="none"
        stroke={isProfit ? TOKENS.color.semantic.profit : TOKENS.color.semantic.risk}
        strokeWidth="2"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        transform="rotate(-90 14 14)"
      />
    </svg>
  );
}

// MiniCurve component matching Figma (40x16px polyline)
function MiniCurve({ data }: { data: number[] }) {
  if (!data || data.length === 0) {
    // Generate simple curve from P/L direction
    const isProfit = data && data.length > 0 ? data[data.length - 1] > data[0] : false;
    return (
      <svg width="40" height="16" style={{ display: 'block' }}>
        <polyline
          points={isProfit ? "0,12 8,8 16,6 24,4 32,4 40,4" : "0,4 8,6 16,8 24,10 32,12 40,12"}
          fill="none"
          stroke={isProfit ? TOKENS.color.semantic.profit : TOKENS.color.semantic.risk}
          strokeWidth="1.5"
        />
      </svg>
    );
  }
  
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * 40;
    const y = 16 - ((value - min) / range) * 12;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="40" height="16" style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={data[data.length - 1] > data[0] ? TOKENS.color.semantic.profit : TOKENS.color.semantic.risk}
        strokeWidth="1.5"
      />
    </svg>
  );
}

function PositionRow({ position, index, total }: { position: Position; index: number; total: number }) {
  const pnlPercent = position.avgPrice > 0 && position.qty > 0 
    ? (position.pnl / (position.avgPrice * position.qty * (position.strategy === 'SPOT' ? 1 : 100))) * 100 
    : 0;
  
  const state = getPositionState(position);
  const { symbol, strategy } = getSymbolAndStrategy(position);

  const handleClose = () => {
    // TODO: Implement position closing via API
    console.log('Close position:', position.id);
  };

  const handleTP = async () => {
    try {
      // Get OTOCO group for this position
      const otocoGroup = await orderRegistry.getOTOCOGroup(position.id);
      
      if (!otocoGroup || !otocoGroup.tpOrderId) {
        // No TP order exists yet - would need to create one
        // This could happen if:
        // 1. Position was created before OTOCO feature
        // 2. Trigger order hasn't filled yet
        // 3. TP order wasn't created for some reason
        const message = otocoGroup 
          ? 'Take profit order not yet created. The order will be created automatically when the entry order fills.'
          : 'Take profit order not found for this position.';
        alert(message);
        // TODO: Show modal to create new TP order or show status
        return;
      }
      
      // Get current TP price from ruleBundle
      const currentTPPrice = calculateTPPrice(position.avgPrice, position.ruleBundle.takeProfitPct || 0);
      
      // Show modal/dropdown to modify TP order
      // For now, simple prompt with action selection - would be replaced with proper UI
      const action = prompt(
        `Take Profit Order\n\n` +
        `Current TP Price: $${currentTPPrice.toFixed(2)}\n` +
        `Current TP %: ${position.ruleBundle.takeProfitPct || 0}%\n` +
        `Order ID: ${otocoGroup.tpOrderId}\n\n` +
        `Choose action:\n` +
        `1 - Update price\n` +
        `2 - Cancel order\n` +
        `3 - Set new order\n\n` +
        `Enter 1, 2, or 3:`
      );
      
      if (!action) return;
      
      if (action === '1') {
        // Update existing order
        const newTPPriceStr = prompt(`Enter new TP price:`);
        if (newTPPriceStr) {
          const newTPPrice = parseFloat(newTPPriceStr);
          if (!isNaN(newTPPrice) && newTPPrice > 0) {
            try {
              await updateTPOrder(otocoGroup.tpOrderId, newTPPrice, otocoGroup.accountId);
              console.log('TP order updated:', newTPPrice);
              alert(`Take profit order updated to $${newTPPrice.toFixed(2)}`);
              // TODO: Show success notification via toast
              // TODO: Refresh positions list
            } catch (updateError) {
              const errorMessage = updateError instanceof Error ? updateError.message : 'Unknown error';
              console.error('Failed to update TP order:', updateError);
              alert(`Failed to update take profit order: ${errorMessage}`);
              // TODO: Show error notification via toast
            }
          } else {
            alert('Invalid price. Please enter a positive number.');
          }
        }
      } else if (action === '2') {
        // Cancel existing order
        if (confirm('Are you sure you want to cancel the take profit order?')) {
          try {
            await cancelTPOrder(otocoGroup.tpOrderId, otocoGroup.accountId);
            console.log('TP order cancelled');
            alert('Take profit order cancelled');
            // TODO: Show success notification via toast
            // TODO: Refresh positions list
          } catch (cancelError) {
            const errorMessage = cancelError instanceof Error ? cancelError.message : 'Unknown error';
            console.error('Failed to cancel TP order:', cancelError);
            alert(`Failed to cancel take profit order: ${errorMessage}`);
            // TODO: Show error notification via toast
          }
        }
      } else if (action === '3') {
        // Set new order (cancel old and create new)
        const newTPPriceStr = prompt(`Enter new TP price:`);
        if (newTPPriceStr) {
          const newTPPrice = parseFloat(newTPPriceStr);
          if (!isNaN(newTPPrice) && newTPPrice > 0) {
            try {
              // Build exit legs from entry legs
              const exitLegs = buildExitLegs(otocoGroup.entryLegs as OrderLeg[]);
              const newTPOrder = await submitNewTPOrder(exitLegs, newTPPrice, otocoGroup.accountId, otocoGroup.tpOrderId);
              console.log('New TP order submitted:', newTPPrice);
              
              // Update registry with new TP order ID
              await orderRegistry.updateOTOCOGroup(position.id, {
                tpOrderId: newTPOrder.id,
              });
              
              alert(`New take profit order set at $${newTPPrice.toFixed(2)}`);
              // TODO: Show success notification via toast
              // TODO: Refresh positions list
            } catch (newOrderError) {
              const errorMessage = newOrderError instanceof Error ? newOrderError.message : 'Unknown error';
              console.error('Failed to set new TP order:', newOrderError);
              alert(`Failed to set new take profit order: ${errorMessage}`);
              // TODO: Show error notification via toast
            }
          } else {
            alert('Invalid price. Please enter a positive number.');
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to handle TP order:', error);
      alert(`Error: ${errorMessage}`);
      // TODO: Show error notification via toast
    }
  };

  const handleSL = async () => {
    try {
      // Get OTOCO group for this position
      const otocoGroup = await orderRegistry.getOTOCOGroup(position.id);
      
      if (!otocoGroup || !otocoGroup.slOrderId) {
        // No SL order exists yet - would need to create one
        // This could happen if:
        // 1. Position was created before OTOCO feature
        // 2. Trigger order hasn't filled yet
        // 3. SL order wasn't created for some reason
        const message = otocoGroup 
          ? 'Stop loss order not yet created. The order will be created automatically when the entry order fills.'
          : 'Stop loss order not found for this position.';
        alert(message);
        // TODO: Show modal to create new SL order or show status
        return;
      }
      
      // Get current SL price from ruleBundle
      const currentSLPrice = calculateSLPrice(position.avgPrice, position.ruleBundle.stopLossPct || 0);
      
      // Show modal/dropdown to modify SL order
      // For now, simple prompt with action selection - would be replaced with proper UI
      const action = prompt(
        `Stop Loss Order\n\n` +
        `Current SL Price: $${currentSLPrice.toFixed(2)}\n` +
        `Current SL %: ${position.ruleBundle.stopLossPct || 0}%\n` +
        `Order ID: ${otocoGroup.slOrderId}\n\n` +
        `Choose action:\n` +
        `1 - Update price\n` +
        `2 - Cancel order\n` +
        `3 - Set new order\n\n` +
        `Enter 1, 2, or 3:`
      );
      
      if (!action) return;
      
      if (action === '1') {
        // Update existing order
        const newSLPriceStr = prompt(`Enter new SL price:`);
        if (newSLPriceStr) {
          const newSLPrice = parseFloat(newSLPriceStr);
          if (!isNaN(newSLPrice) && newSLPrice > 0) {
            try {
              await updateSLOrder(otocoGroup.slOrderId, newSLPrice, otocoGroup.accountId);
              console.log('SL order updated:', newSLPrice);
              alert(`Stop loss order updated to $${newSLPrice.toFixed(2)}`);
              // TODO: Show success notification via toast
              // TODO: Refresh positions list
            } catch (updateError) {
              const errorMessage = updateError instanceof Error ? updateError.message : 'Unknown error';
              console.error('Failed to update SL order:', updateError);
              alert(`Failed to update stop loss order: ${errorMessage}`);
              // TODO: Show error notification via toast
            }
          } else {
            alert('Invalid price. Please enter a positive number.');
          }
        }
      } else if (action === '2') {
        // Cancel existing order
        if (confirm('Are you sure you want to cancel the stop loss order?')) {
          try {
            await cancelSLOrder(otocoGroup.slOrderId, otocoGroup.accountId);
            console.log('SL order cancelled');
            alert('Stop loss order cancelled');
            // TODO: Show success notification via toast
            // TODO: Refresh positions list
          } catch (cancelError) {
            const errorMessage = cancelError instanceof Error ? cancelError.message : 'Unknown error';
            console.error('Failed to cancel SL order:', cancelError);
            alert(`Failed to cancel stop loss order: ${errorMessage}`);
            // TODO: Show error notification via toast
          }
        }
      } else if (action === '3') {
        // Set new order (cancel old and create new)
        const newSLPriceStr = prompt(`Enter new SL price:`);
        if (newSLPriceStr) {
          const newSLPrice = parseFloat(newSLPriceStr);
          if (!isNaN(newSLPrice) && newSLPrice > 0) {
            try {
              // Build exit legs from entry legs
              const exitLegs = buildExitLegs(otocoGroup.entryLegs as OrderLeg[]);
              const newSLOrder = await submitNewSLOrder(exitLegs, newSLPrice, otocoGroup.accountId, otocoGroup.slOrderId);
              console.log('New SL order submitted:', newSLPrice);
              
              // Update registry with new SL order ID
              await orderRegistry.updateOTOCOGroup(position.id, {
                slOrderId: newSLOrder.id,
              });
              
              alert(`New stop loss order set at $${newSLPrice.toFixed(2)}`);
              // TODO: Show success notification via toast
              // TODO: Refresh positions list
            } catch (newOrderError) {
              const errorMessage = newOrderError instanceof Error ? newOrderError.message : 'Unknown error';
              console.error('Failed to set new SL order:', newOrderError);
              alert(`Failed to set new stop loss order: ${errorMessage}`);
              // TODO: Show error notification via toast
            }
          } else {
            alert('Invalid price. Please enter a positive number.');
          }
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Failed to handle SL order:', error);
      alert(`Error: ${errorMessage}`);
      // TODO: Show error notification via toast
    }
  };

  // Calculate TP/SL progress using exact Figma formula
  // TP: ((current - entry) / (target - entry)) * 100
  // SL: ((entry - current) / (entry - stop)) * 100
  //
  // IMPORTANT: TP/SL targets are calculated from the ACTUAL entry price (position.avgPrice),
  // NOT from the Discord alert price. This ensures that last-minute price adjustments at
  // trade entry (to get better pricing or to get in quickly) are properly accounted for.
  //
  // Example:
  // - Discord alert: "Enter at $450, TP 50%"
  // - Actual entry: $448 (better price) or $452 (fast entry)
  // - TP target: $448 * 1.5 = $672 (or $452 * 1.5 = $678)
  // - The TP percentage stays the same, but targets are relative to actual entry price
  //
  // The avgPrice comes from Tastytrade API (average-open-price) which reflects the
  // actual average entry price of the position, accounting for any price adjustments.
  
  // Check if TP/SL is actually set (not null)
  const hasTP = position.ruleBundle.takeProfitPct != null;
  const hasSL = position.ruleBundle.stopLossPct != null;
  
  // Validate avgPrice before calculations
  if (!position.avgPrice || position.avgPrice <= 0) {
    console.warn(`Invalid avgPrice for position ${position.id}: ${position.avgPrice}`);
  }
  
  // Calculate current price from P/L
  // Use actual entry price (avgPrice) from Tastytrade, not alert price
  const multiplier = position.strategy === 'SPOT' ? 1 : 100;
  const actualEntryPrice = position.avgPrice; // Explicitly use actual entry price
  const currentPrice = actualEntryPrice + (position.pnl / (position.qty * multiplier));
  
  // Only calculate progress if TP/SL is set and entry price is valid
  let tpProgress = 0;
  let slProgress = 0;
  
  if (hasTP && actualEntryPrice > 0) {
    // Calculate target price from actual entry price and ruleBundle percentage
    // targetPrice = actualEntryPrice * (1 + takeProfitPct / 100)
    const targetPrice = actualEntryPrice * (1 + position.ruleBundle.takeProfitPct! / 100);
    // TP progress: how far towards target (using actual entry price)
    tpProgress = targetPrice > actualEntryPrice
      ? Math.max(0, Math.min(100, ((currentPrice - actualEntryPrice) / (targetPrice - actualEntryPrice)) * 100))
      : 0;
  }
  
  if (hasSL && actualEntryPrice > 0) {
    // Calculate stop price from actual entry price and ruleBundle percentage
    // stopPrice = actualEntryPrice * (1 - stopLossPct / 100)
    const stopPrice = actualEntryPrice * (1 - position.ruleBundle.stopLossPct! / 100);
    // SL progress: how far towards stop (using actual entry price)
    slProgress = stopPrice < actualEntryPrice
      ? Math.max(0, Math.min(100, ((actualEntryPrice - currentPrice) / (actualEntryPrice - stopPrice)) * 100))
      : 0;
  }

  // Generate curve data (simplified - would need actual historical data)
  // Use actualEntryPrice for consistency (accounts for price adjustments)
  const curveData = position.pnl >= 0 
    ? [actualEntryPrice * 0.9, actualEntryPrice * 0.92, actualEntryPrice * 0.95, actualEntryPrice * 0.97, actualEntryPrice * 0.99, currentPrice, currentPrice]
    : [actualEntryPrice * 1.1, actualEntryPrice * 1.08, actualEntryPrice * 1.05, actualEntryPrice * 1.03, actualEntryPrice * 1.01, currentPrice, currentPrice];

  return (
    <div
      style={{ 
        display: 'grid',
        gridTemplateColumns: '2fr 0.6fr 1fr 0.8fr 1.2fr 0.8fr 0.6fr 2fr',
        gap: `${TOKENS.space.lg}px`,
        padding: `${TOKENS.space.md}px ${TOKENS.space.lg}px`,
        borderBottom: index < total - 1 ? '1px solid rgba(35, 39, 52, 1)' : 'none',
        alignItems: 'center',
        transition: 'background-color 0.15s ease',
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(35, 39, 52, 0.4)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {/* Symbol/Strategy */}
      <div>
        <div style={{ 
          fontSize: `${TOKENS.type.sm}px`,
          color: 'rgb(255, 255, 255)', // textPrimary
          marginBottom: '2px',
        }}>
          {symbol}
        </div>
        {strategy && (
          <div style={{ 
            fontSize: `${TOKENS.type.xs}px`,
            color: 'rgb(169, 175, 195)', // textSecondary
          }}>
            {strategy}
          </div>
        )}
      </div>

      {/* Qty */}
      <div style={{ 
        fontSize: `${TOKENS.type.sm}px`,
        color: 'rgb(255, 255, 255)', // textPrimary
        fontVariantNumeric: 'tabular-nums lining-nums',
      }}>
        {position.qty}
      </div>

      {/* Entry */}
      <div style={{ 
        fontSize: `${TOKENS.type.sm}px`,
        color: 'rgb(255, 255, 255)', // textPrimary
        fontVariantNumeric: 'tabular-nums lining-nums',
      }}>
        ${position.avgPrice.toFixed(2)}
      </div>

      {/* P/L */}
      <div style={{ display: 'flex', alignItems: 'center', gap: `${TOKENS.space.sm}px` }}>
        <PLRing percent={pnlPercent} />
        <div>
          <div 
            style={{ 
              fontSize: `${TOKENS.type.sm}px`,
              color: position.pnl >= 0 ? TOKENS.color.semantic.profit : TOKENS.color.semantic.risk,
              fontVariantNumeric: 'tabular-nums lining-nums',
            }}
          >
            {position.pnl >= 0 ? '+' : ''}${position.pnl.toFixed(2)}
          </div>
          <div 
            style={{ 
              fontSize: `${TOKENS.type.xs}px`,
              color: 'rgb(169, 175, 195)', // textSecondary
              fontVariantNumeric: 'tabular-nums lining-nums',
            }}
          >
            {pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* TP/SL Bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: `${TOKENS.space.xs}px` }}>
        {/* TP Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: `${TOKENS.space.xs}px` }}>
          <span style={{ 
            fontSize: `${TOKENS.type.xs}px`,
            color: 'rgb(169, 175, 195)', // textSecondary
            width: '20px',
          }}>
            TP
          </span>
          <div style={{ 
            flex: 1,
            height: '4px',
            backgroundColor: 'rgba(35, 39, 52, 1)', // border
            borderRadius: '2px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {hasTP && (
              <div style={{ 
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${Math.max(0, Math.min(100, tpProgress))}%`,
                backgroundColor: TOKENS.color.semantic.profit,
                borderRadius: '2px',
              }} />
            )}
          </div>
        </div>
        {/* SL Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: `${TOKENS.space.xs}px` }}>
          <span style={{ 
            fontSize: `${TOKENS.type.xs}px`,
            color: 'rgb(169, 175, 195)', // textSecondary
            width: '20px',
          }}>
            SL
          </span>
          <div style={{ 
            flex: 1,
            height: '4px',
            backgroundColor: 'rgba(35, 39, 52, 1)', // border
            borderRadius: '2px',
            position: 'relative',
            overflow: 'hidden',
          }}>
            {hasSL && (
              <div style={{ 
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: `${Math.max(0, Math.min(100, slProgress))}%`,
                backgroundColor: TOKENS.color.semantic.risk,
                borderRadius: '2px',
              }} />
            )}
          </div>
        </div>
      </div>

      {/* State Chip */}
      <div>
        <span 
          className="inline-block text-center tabular-nums"
          style={{ 
            padding: `${TOKENS.space.xs}px ${TOKENS.space.sm}px`,
            borderRadius: `${TOKENS.space.lg}px`,
            fontSize: `${TOKENS.type.xs}px`,
            backgroundColor: state === 'profit' 
              ? TOKENS.color.semantic.profit + '15'
              : state === 'risk'
                ? TOKENS.color.semantic.risk + '15'
                : 'rgba(35, 39, 52, 1)', // border color
            border: `1px solid ${state === 'profit' 
              ? TOKENS.color.semantic.profit + '40'
              : state === 'risk'
                ? TOKENS.color.semantic.risk + '40'
                : 'rgba(35, 39, 52, 1)'}`,
            color: state === 'profit' 
              ? TOKENS.color.semantic.profit
              : state === 'risk'
                ? TOKENS.color.semantic.risk
                : 'rgb(169, 175, 195)', // textSecondary
          }}
        >
          {state === 'profit' ? 'Profit' : state === 'risk' ? 'Risk' : 'Neutral'}
        </span>
      </div>

      {/* Mini Curve */}
      <div>
        <MiniCurve data={curveData} />
      </div>

      {/* Actions */}
      <div style={{ 
        display: 'flex', 
        gap: `${TOKENS.space.xs}px`,
        justifyContent: 'flex-end',
      }}>
        <button
          onClick={handleClose}
          style={{ 
            padding: `${TOKENS.space.xs}px ${TOKENS.space.sm}px`,
            fontSize: `${TOKENS.type.xs}px`,
            borderRadius: `${TOKENS.space.sm}px`,
            border: '1px solid rgba(35, 39, 52, 1)', // border
            backgroundColor: 'transparent',
            color: 'rgb(255, 255, 255)', // textPrimary
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: `${TOKENS.space.xs}px`,
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(35, 39, 52, 0.4)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <X size={12} />
          Close
        </button>
        <button
          onClick={handleTP}
          style={{ 
            padding: `${TOKENS.space.xs}px ${TOKENS.space.sm}px`,
            fontSize: `${TOKENS.type.xs}px`,
            borderRadius: `${TOKENS.space.sm}px`,
            border: '1px solid rgba(35, 39, 52, 1)', // border
            backgroundColor: 'transparent',
            color: 'rgb(255, 255, 255)', // textPrimary
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: `${TOKENS.space.xs}px`,
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(35, 39, 52, 0.4)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Target size={12} />
          TP
        </button>
        <button
          onClick={handleSL}
          style={{ 
            padding: `${TOKENS.space.xs}px ${TOKENS.space.sm}px`,
            fontSize: `${TOKENS.type.xs}px`,
            borderRadius: `${TOKENS.space.sm}px`,
            border: '1px solid rgba(35, 39, 52, 1)', // border
            backgroundColor: 'transparent',
            color: 'rgb(255, 255, 255)', // textPrimary
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: `${TOKENS.space.xs}px`,
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(35, 39, 52, 0.4)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <StopCircle size={12} />
          SL
        </button>
      </div>
    </div>
  );
}

export function Positions() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPositions = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch('/api/tastytrade/positions');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }));
        throw new Error(errorData.error || errorData.details || `Failed to fetch positions: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('Positions API response:', data);
      
      if (data.error) {
        throw new Error(data.details || data.error || 'Failed to fetch positions');
      }
      
      setPositions(data.positions || []);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Failed to fetch positions:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPositions();
    
    // Refresh positions every 30 seconds
    const interval = setInterval(fetchPositions, 30000);
    
    return () => clearInterval(interval);
  }, [fetchPositions]);

  if (loading && positions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-16">
        <p className="text-text-secondary-dark dark:text-text-secondary-dark text-sm">
          Loading positions...
        </p>
      </div>
    );
  }

  if (error) {
    // Check if this is a configuration error
    const isConfigError = error.toLowerCase().includes('not configured') || 
                         error.toLowerCase().includes('tastytrade api not configured') ||
                         error.toLowerCase().includes('set tastytrde') ||
                         error.toLowerCase().includes('tastytrde_env') ||
                         error.toLowerCase().includes('tastytrde_username') ||
                         error.toLowerCase().includes('tastytrde_password') ||
                         error.toLowerCase().includes('missing required environment');

    return (
      <div className="h-full flex items-center justify-center bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-16">
        <div className="text-center max-w-md px-6">
          <p className="text-risk text-sm mb-4 font-medium">
            {isConfigError ? 'Tastytrade API Not Configured' : 'Failed to load positions'}
          </p>
          
          {isConfigError ? (
            <div className="space-y-3">
              <p className="text-text-secondary-dark dark:text-text-secondary-dark text-xs">
                The Tastytrade API credentials are not configured. To view your positions, please set the following environment variables in Vercel:
              </p>
              <div className="text-left bg-surface dark:bg-surface border border-border-dark dark:border-border-dark rounded-8 p-3 text-xs space-y-1 font-mono">
                <div className="text-text-primary-dark dark:text-text-primary-dark">
                  <span className="text-text-secondary-dark dark:text-text-secondary-dark">Required (OAuth2):</span>
                  <div className="mt-2 ml-2 space-y-1">
                    <div>TASTYTRADE_ENV=prod</div>
                    <div>TASTYTRADE_CLIENT_SECRET=your_client_secret</div>
                    <div>TASTYTRADE_REFRESH_TOKEN=your_refresh_token</div>
                  </div>
                  <span className="text-text-secondary-dark dark:text-text-secondary-dark block mt-2">Optional:</span>
                  <div className="mt-2 ml-2">
                    <div>TASTYTRADE_CLIENT_ID=your_client_id</div>
                    <div>TASTYTRADE_ACCOUNT_NUMBER=5WZ54420</div>
                  </div>
                </div>
              </div>
              <p className="text-text-secondary-dark dark:text-text-secondary-dark text-xs mt-3">
                After setting these variables, redeploy your application in Vercel.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-text-secondary-dark dark:text-text-secondary-dark text-xs mb-4">
                {error}
              </p>
              <p className="text-text-secondary-dark dark:text-text-secondary-dark text-xs opacity-75">
                Check the browser console (F12) for more details, or check Vercel logs for server-side errors.
              </p>
            </div>
          )}
          
          <button
            onClick={fetchPositions}
            className="px-4 py-2 bg-surface dark:bg-surface border border-border-dark dark:border-border-dark text-text-primary-dark dark:text-text-primary-dark text-xs rounded-12 hover:bg-border-dark dark:hover:bg-border-dark transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="h-full flex items-center justify-center bg-surface-dark dark:bg-surface-dark border border-border-dark dark:border-border-dark rounded-16">
        <p className="text-text-secondary-dark dark:text-text-secondary-dark text-sm">
          No open positions
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: `${TOKENS.space.lg}px`,
      }}>
        <h2 style={{ 
          fontSize: `${TOKENS.type.lg}px`,
          color: 'rgb(255, 255, 255)', // textPrimary
        }}>
          Open Positions
        </h2>
        <span style={{ 
          fontSize: `${TOKENS.type.xs}px`,
          color: 'rgb(169, 175, 195)', // textSecondary
        }}>
          {positions.length} active
        </span>
      </div>

      {/* Desktop Table View - CSS Grid */}
      <div style={{ 
        backgroundColor: 'rgb(28, 31, 41)', // surface
        border: '1px solid rgba(35, 39, 52, 1)', // border
        borderRadius: `${TOKENS.radius.md}px`,
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '2fr 0.6fr 1fr 0.8fr 1.2fr 0.8fr 0.6fr 2fr',
          gap: `${TOKENS.space.lg}px`,
          padding: `${TOKENS.space.md}px ${TOKENS.space.lg}px`,
          borderBottom: '1px solid rgba(35, 39, 52, 1)', // border
          backgroundColor: 'rgba(28, 31, 41, 0.5)', // surface + 50 opacity
          fontSize: `${TOKENS.type.xs}px`,
          color: 'rgb(169, 175, 195)', // textSecondary
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          <div>Symbol / Strategy</div>
          <div>Qty</div>
          <div>Entry</div>
          <div>P/L</div>
          <div>TP / SL</div>
          <div>State</div>
          <div>Curve</div>
          <div style={{ textAlign: 'right' }}>Actions</div>
        </div>

        {/* Rows */}
        {positions.map((position, index) => (
          <PositionRow 
            key={position.id} 
            position={position} 
            index={index}
            total={positions.length}
          />
        ))}
      </div>
    </div>
  );
}
