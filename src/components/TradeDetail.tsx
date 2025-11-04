'use client';

import { X, Clock, TrendingUp, TrendingDown, Target, StopCircle, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { TradeHistoryRecord } from '@/lib/tradeHistoryService';
import { TradeState } from '@/lib/tradeStateMachine';
import type { TradeHistory } from '@/types/tradeHistory';

interface TradeDetailProps {
  trade: TradeHistory;
  isOpen: boolean;
  onClose: () => void;
  colors: any;
  tokens: any;
}

export function TradeDetail({ trade, isOpen, onClose, colors, tokens }: TradeDetailProps) {
  const record = trade.originalRecord;

  const getStateColor = (state: TradeState): string => {
    switch(state) {
      case TradeState.CLOSED: return colors.semantic.profit;
      case TradeState.FILLED:
      case TradeState.OCO_ATTACHED: return colors.semantic.info;
      case TradeState.WORKING:
      case TradeState.SUBMITTED: return colors.semantic.warning;
      case TradeState.PENDING: return colors.textSecondary;
      case TradeState.CANCELLED:
      case TradeState.REJECTED:
      case TradeState.ERROR: return colors.semantic.risk;
      default: return colors.textSecondary;
    }
  };

  const getStateLabel = (state: TradeState): string => {
    switch(state) {
      case TradeState.PENDING: return 'Pending';
      case TradeState.SUBMITTED: return 'Submitted';
      case TradeState.WORKING: return 'Working';
      case TradeState.FILLED: return 'Filled';
      case TradeState.OCO_ATTACHED: return 'OCO Attached';
      case TradeState.CLOSED: return 'Closed';
      case TradeState.CANCELLED: return 'Cancelled';
      case TradeState.REJECTED: return 'Rejected';
      case TradeState.ERROR: return 'Error';
      default: return state;
    }
  };

  const formatCurrency = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}$${Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              zIndex: 9998,
            }}
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            style={{
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '90%',
              maxWidth: '800px',
              maxHeight: '90vh',
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: `${tokens.radius.lg}px`,
              zIndex: 9999,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{
              padding: `${tokens.space.lg}px`,
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              <div>
                <h2 style={{
                  fontSize: `${tokens.type.sizes.xl}px`,
                  fontWeight: tokens.type.weights.semibold,
                  color: colors.textPrimary,
                  marginBottom: `${tokens.space.xs}px`,
                }}>
                  Trade Details
                </h2>
                <div style={{
                  display: 'flex',
                  gap: `${tokens.space.sm}px`,
                  alignItems: 'center',
                  flexWrap: 'wrap',
                }}>
                  <div style={{
                    padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                    backgroundColor: getStateColor(trade.state) + '20',
                    border: `1px solid ${getStateColor(trade.state)}40`,
                    borderRadius: `${tokens.radius.sm}px`,
                    fontSize: `${tokens.type.sizes.xs}px`,
                    color: getStateColor(trade.state),
                    textTransform: 'uppercase',
                    letterSpacing: '0.03em',
                  }}>
                    {getStateLabel(trade.state)}
                  </div>
                  <span style={{ fontSize: `${tokens.type.sizes.sm}px`, color: colors.textSecondary }}>
                    {trade.date} {trade.time}
                  </span>
                  {trade.chaseInfo && (
                    <span style={{ fontSize: `${tokens.type.sizes.sm}px`, color: colors.semantic.info }}>
                      🚀 Chased ({trade.chaseInfo.attempts} attempts)
                    </span>
                  )}
                  {trade.hasBrackets && (
                    <span style={{ fontSize: `${tokens.type.sizes.sm}px`, color: colors.semantic.profit }}>
                      🎯 Brackets attached
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  padding: `${tokens.space.sm}px`,
                  borderRadius: `${tokens.radius.md}px`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{
              padding: `${tokens.space.lg}px`,
              overflowY: 'auto',
              flex: 1,
            }}>
              {/* Trade Summary */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: `${tokens.space.md}px`,
                marginBottom: `${tokens.space.xl}px`,
              }}>
                <div style={{
                  padding: `${tokens.space.md}px`,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: `${tokens.radius.md}px`,
                }}>
                  <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginBottom: `${tokens.space.xs}px` }}>
                    Underlying
                  </div>
                  <div style={{ fontSize: `${tokens.type.sizes.lg}px`, color: colors.textPrimary, fontWeight: tokens.type.weights.medium }}>
                    {trade.underlying}
                  </div>
                </div>
                <div style={{
                  padding: `${tokens.space.md}px`,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: `${tokens.radius.md}px`,
                }}>
                  <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginBottom: `${tokens.space.xs}px` }}>
                    Strategy
                  </div>
                  <div style={{ fontSize: `${tokens.type.sizes.lg}px`, color: colors.textPrimary, fontWeight: tokens.type.weights.medium }}>
                    {trade.strategy}
                  </div>
                </div>
                <div style={{
                  padding: `${tokens.space.md}px`,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: `${tokens.radius.md}px`,
                }}>
                  <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginBottom: `${tokens.space.xs}px` }}>
                    Quantity
                  </div>
                  <div style={{ fontSize: `${tokens.type.sizes.lg}px`, color: colors.textPrimary, fontWeight: tokens.type.weights.medium }}>
                    {record.quantity}
                  </div>
                </div>
                <div style={{
                  padding: `${tokens.space.md}px`,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: `${tokens.radius.md}px`,
                }}>
                  <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginBottom: `${tokens.space.xs}px` }}>
                    P/L
                  </div>
                  <div style={{
                    fontSize: `${tokens.type.sizes.lg}px`,
                    color: trade.plDollar >= 0 ? colors.semantic.profit : colors.semantic.risk,
                    fontWeight: tokens.type.weights.medium,
                  }}>
                    {formatCurrency(trade.plDollar)}
                  </div>
                </div>
              </div>

              {/* Order Information */}
              <div style={{ marginBottom: `${tokens.space.xl}px` }}>
                <h3 style={{
                  fontSize: `${tokens.type.sizes.base}px`,
                  fontWeight: tokens.type.weights.semibold,
                  color: colors.textPrimary,
                  marginBottom: `${tokens.space.md}px`,
                }}>
                  Order Information
                </h3>
                
                {record.entryOrder && (
                  <div style={{
                    padding: `${tokens.space.md}px`,
                    backgroundColor: colors.surfaceAlt,
                    borderRadius: `${tokens.radius.md}px`,
                    marginBottom: `${tokens.space.sm}px`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: `${tokens.space.xs}px` }}>
                      <span style={{ fontSize: `${tokens.type.sizes.sm}px`, fontWeight: tokens.type.weights.medium, color: colors.textPrimary }}>
                        Entry Order
                      </span>
                      <span style={{
                        padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                        backgroundColor: colors.semantic.info + '20',
                        borderRadius: `${tokens.radius.sm}px`,
                        fontSize: `${tokens.type.sizes.xs}px`,
                        color: colors.semantic.info,
                      }}>
                        {record.entryOrder.status}
                      </span>
                    </div>
                    <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary }}>
                      Order ID: {record.entryOrder.orderId}
                    </div>
                    {record.entryOrder.fillPrice && (
                      <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginTop: `${tokens.space.xs}px` }}>
                        Fill Price: {formatCurrency(record.entryOrder.fillPrice)}
                      </div>
                    )}
                  </div>
                )}

                {record.brackets && (
                  <div style={{
                    padding: `${tokens.space.md}px`,
                    backgroundColor: colors.surfaceAlt,
                    borderRadius: `${tokens.radius.md}px`,
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: `${tokens.space.sm}px`,
                  }}>
                    {record.brackets.takeProfit && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.xs}px`, marginBottom: `${tokens.space.xs}px` }}>
                          <Target size={14} style={{ color: colors.semantic.profit }} />
                          <span style={{ fontSize: `${tokens.type.sizes.sm}px`, fontWeight: tokens.type.weights.medium, color: colors.textPrimary }}>
                            Take Profit
                          </span>
                        </div>
                        <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary }}>
                          Price: {formatCurrency(record.brackets.takeProfit.price)}
                        </div>
                        <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary }}>
                          Status: {record.brackets.takeProfit.status}
                        </div>
                      </div>
                    )}
                    {record.brackets.stopLoss && (
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.xs}px`, marginBottom: `${tokens.space.xs}px` }}>
                          <StopCircle size={14} style={{ color: colors.semantic.risk }} />
                          <span style={{ fontSize: `${tokens.type.sizes.sm}px`, fontWeight: tokens.type.weights.medium, color: colors.textPrimary }}>
                            Stop Loss
                          </span>
                        </div>
                        <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary }}>
                          Price: {formatCurrency(record.brackets.stopLoss.price)}
                        </div>
                        <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary }}>
                          Status: {record.brackets.stopLoss.status}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {record.exitOrder && (
                  <div style={{
                    padding: `${tokens.space.md}px`,
                    backgroundColor: colors.surfaceAlt,
                    borderRadius: `${tokens.radius.md}px`,
                    marginTop: `${tokens.space.sm}px`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: `${tokens.space.xs}px` }}>
                      <span style={{ fontSize: `${tokens.type.sizes.sm}px`, fontWeight: tokens.type.weights.medium, color: colors.textPrimary }}>
                        Exit Order ({record.exitOrder.exitType.replace('_', ' ')})
                      </span>
                      <span style={{
                        padding: `${tokens.space.xs}px ${tokens.space.sm}px`,
                        backgroundColor: colors.semantic.profit + '20',
                        borderRadius: `${tokens.radius.sm}px`,
                        fontSize: `${tokens.type.sizes.xs}px`,
                        color: colors.semantic.profit,
                      }}>
                        {record.exitOrder.status}
                      </span>
                    </div>
                    <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary }}>
                      Order ID: {record.exitOrder.orderId}
                    </div>
                    {record.exitOrder.fillPrice && (
                      <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary, marginTop: `${tokens.space.xs}px` }}>
                        Fill Price: {formatCurrency(record.exitOrder.fillPrice)}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* State History */}
              <div style={{ marginBottom: `${tokens.space.xl}px` }}>
                <h3 style={{
                  fontSize: `${tokens.type.sizes.base}px`,
                  fontWeight: tokens.type.weights.semibold,
                  color: colors.textPrimary,
                  marginBottom: `${tokens.space.md}px`,
                }}>
                  State History
                </h3>
                <div style={{
                  padding: `${tokens.space.md}px`,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: `${tokens.radius.md}px`,
                }}>
                  {record.stateHistory.map((transition, index) => (
                    <div
                      key={index}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: `${tokens.space.md}px`,
                        padding: `${tokens.space.sm}px 0`,
                        borderBottom: index < record.stateHistory.length - 1 ? `1px solid ${colors.border}` : 'none',
                      }}
                    >
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        backgroundColor: getStateColor(transition.toState),
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: `${tokens.type.sizes.sm}px`, color: colors.textPrimary }}>
                          {getStateLabel(transition.fromState)} → {getStateLabel(transition.toState)}
                        </div>
                        <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary }}>
                          {new Date(transition.timestamp).toLocaleString()}
                        </div>
                        {transition.error && (
                          <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.semantic.risk, marginTop: `${tokens.space.xs}px` }}>
                            Error: {transition.error}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chase Information */}
              {record.chaseInfo && (
                <div style={{ marginBottom: `${tokens.space.xl}px` }}>
                  <h3 style={{
                    fontSize: `${tokens.type.sizes.base}px`,
                    fontWeight: tokens.type.weights.semibold,
                    color: colors.textPrimary,
                    marginBottom: `${tokens.space.md}px`,
                  }}>
                    Chase Information
                  </h3>
                  <div style={{
                    padding: `${tokens.space.md}px`,
                    backgroundColor: colors.surfaceAlt,
                    borderRadius: `${tokens.radius.md}px`,
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: `${tokens.space.md}px` }}>
                      <div>
                        <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary }}>Attempts</div>
                        <div style={{ fontSize: `${tokens.type.sizes.base}px`, color: colors.textPrimary, fontWeight: tokens.type.weights.medium }}>
                          {record.chaseInfo.attempts}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary }}>Initial Price</div>
                        <div style={{ fontSize: `${tokens.type.sizes.base}px`, color: colors.textPrimary, fontWeight: tokens.type.weights.medium }}>
                          {formatCurrency(record.chaseInfo.initialPrice)}
                        </div>
                      </div>
                      {record.chaseInfo.finalPrice && (
                        <div>
                          <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary }}>Final Price</div>
                          <div style={{ fontSize: `${tokens.type.sizes.base}px`, color: colors.textPrimary, fontWeight: tokens.type.weights.medium }}>
                            {formatCurrency(record.chaseInfo.finalPrice)}
                          </div>
                        </div>
                      )}
                      <div>
                        <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary }}>Total Time</div>
                        <div style={{ fontSize: `${tokens.type.sizes.base}px`, color: colors.textPrimary, fontWeight: tokens.type.weights.medium }}>
                          {(record.chaseInfo.totalTimeMs / 1000).toFixed(1)}s
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Trade Legs */}
              <div>
                <h3 style={{
                  fontSize: `${tokens.type.sizes.base}px`,
                  fontWeight: tokens.type.weights.semibold,
                  color: colors.textPrimary,
                  marginBottom: `${tokens.space.md}px`,
                }}>
                  Trade Legs
                </h3>
                <div style={{
                  padding: `${tokens.space.md}px`,
                  backgroundColor: colors.surfaceAlt,
                  borderRadius: `${tokens.radius.md}px`,
                }}>
                  {record.legs.map((leg, index) => (
                    <div
                      key={index}
                      style={{
                        padding: `${tokens.space.sm}px 0`,
                        borderBottom: index < record.legs.length - 1 ? `1px solid ${colors.border}` : 'none',
                      }}
                    >
                      <div style={{ fontSize: `${tokens.type.sizes.sm}px`, color: colors.textPrimary, marginBottom: `${tokens.space.xs}px` }}>
                        {leg.symbol}
                      </div>
                      <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.textSecondary }}>
                        {leg.action} • Qty: {leg.quantity} • Type: {leg.instrumentType}
                        {leg.price && ` • Price: ${formatCurrency(leg.price)}`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
