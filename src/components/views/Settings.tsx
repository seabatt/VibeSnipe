'use client';

import { useState } from 'react';
import { DollarSign, Target, Shield, Calendar, Palette, Code, Plus, Trash2, X, RotateCcw, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useTokens } from '@/hooks/useTokens';
import { useIsMobile } from '@/components/ui/use-mobile';
import { useToast } from '@/components/ui';
import { ScheduledBlock, StrategyKind, Underlying } from '@/types';
import { useSchedule } from '@/stores/useSchedule';

type TabId = 'account' | 'strategies' | 'discipline' | 'schedule' | 'visuals' | 'advanced';

interface StrategyPreset {
  id: string;
  name: string;
  direction: 'CALL' | 'PUT';
  defaultTP: number;
  defaultSL: number;
  timeExit?: string;
  width: number;
  deltaTarget: number;
  autoArm: boolean;
  autoFire: boolean;
}

interface SettingsData {
  brokerEnv: 'sandbox' | 'live';
  username: string;
  password: string;
  accountId: string;
  defaultRiskPct: number;
  maxRiskCapUsd: number;
  dailyExposureCap: number;
  perUnderlyingCap: { SPX: number; QQQ: number; SPY: number };
  maxScalpsPerBlock: number;
  coolDownAfterStop: number;
  gracePeriodMin: number;
  overrideConfirmation: boolean;
  timezone: string;
  theme: 'dark' | 'light' | 'auto';
  motionSpeed: number;
  nudgeTicks: number;
  audibleCues: boolean;
  breakevenOverlays: boolean;
  hudTransparency: number;
  presets: StrategyPreset[];
  blocks: ScheduledBlock[];
}

const INITIAL_SETTINGS: SettingsData = {
  brokerEnv: 'sandbox',
  username: '',
  password: '',
  accountId: 'ACC-123456',
  defaultRiskPct: 2.5,
  maxRiskCapUsd: 5000,
  dailyExposureCap: 4000,
  perUnderlyingCap: { SPX: 3000, QQQ: 2000, SPY: 1500 },
  maxScalpsPerBlock: 3,
  coolDownAfterStop: 60,
  gracePeriodMin: 3,
  overrideConfirmation: true,
  timezone: 'America/New_York',
  theme: 'dark',
  motionSpeed: 150,
  nudgeTicks: 1,
  audibleCues: false,
  breakevenOverlays: true,
  hudTransparency: 0,
  presets: [
    { id: '1', name: 'SPX 50Δ 10-Wide', direction: 'CALL', defaultTP: 50, defaultSL: 100, timeExit: '13:00', width: 10, deltaTarget: 50, autoArm: true, autoFire: false },
    { id: '2', name: 'SPY 40Δ 5-Wide', direction: 'CALL', defaultTP: 50, defaultSL: 100, timeExit: '13:00', width: 5, deltaTarget: 40, autoArm: true, autoFire: false },
    { id: '3', name: 'QQQ 50Δ 10-Wide', direction: 'PUT', defaultTP: 50, defaultSL: 100, timeExit: '13:00', width: 10, deltaTarget: 50, autoArm: true, autoFire: false },
  ],
  blocks: [
    { 
      id: '1', 
      label: '8Ball Butterfly', 
      windowStart: '09:45', 
      windowEnd: '10:00', 
      underlying: 'QQQ', 
      strategy: '8Ball Butterfly',
      entryMech: 'copy_paste',
      rules: { tpPct: 50, slPct: 100 },
      limits: { maxTrades: 1, perBlockExposureUsd: 1000 },
      toggles: { autoArm: true, autoFire: false }
    },
    { 
      id: '2', 
      label: 'Vertical Spread (50Δ – 10 Wide)', 
      windowStart: '10:00', 
      windowEnd: '10:30', 
      underlying: 'SPX', 
      strategy: 'Vertical',
      entryMech: 'manual_preset',
      rules: { tpPct: 50, slPct: 100, timeExitEt: '13:00' },
      limits: { maxTrades: 1, perBlockExposureUsd: 1000 },
      toggles: { autoArm: true, autoFire: false }
    },
    { 
      id: '3', 
      label: '8Ball Vertical', 
      windowStart: '10:30', 
      windowEnd: '11:00', 
      underlying: 'SPX', 
      strategy: '8Ball Vertical',
      entryMech: 'copy_paste',
      rules: { tpPct: 50, slPct: 100 },
      limits: { maxTrades: 1, perBlockExposureUsd: 1000 },
      toggles: { autoArm: true, autoFire: false }
    },
    { 
      id: '4', 
      label: '8Ball Butterfly', 
      windowStart: '12:30', 
      windowEnd: '13:00', 
      underlying: 'SPX', 
      strategy: '8Ball Butterfly',
      entryMech: 'copy_paste',
      rules: { tpPct: 50, slPct: 100 },
      limits: { maxTrades: 1, perBlockExposureUsd: 1000 },
      toggles: { autoArm: true, autoFire: false }
    },
    { 
      id: '5', 
      label: '8Ball Butterfly', 
      windowStart: '13:05', 
      windowEnd: '13:25', 
      underlying: 'SPX', 
      strategy: '8Ball Butterfly',
      entryMech: 'copy_paste',
      rules: { tpPct: 50, slPct: 100 },
      limits: { maxTrades: 1, perBlockExposureUsd: 1000 },
      toggles: { autoArm: true, autoFire: false }
    },
    { 
      id: '6', 
      label: '8Ball Vertical or Fly', 
      windowStart: '13:30', 
      windowEnd: '13:45', 
      underlying: 'QQQ', 
      strategy: '8Ball Vertical',
      entryMech: 'copy_paste',
      rules: { tpPct: 50, slPct: 100 },
      limits: { maxTrades: 1, perBlockExposureUsd: 1000 },
      toggles: { autoArm: true, autoFire: false }
    },
    { 
      id: '7', 
      label: '8Ball Vertical', 
      windowStart: '13:30', 
      windowEnd: '13:45', 
      underlying: 'SPX', 
      strategy: '8Ball Vertical',
      entryMech: 'copy_paste',
      rules: { tpPct: 50, slPct: 100 },
      limits: { maxTrades: 1, perBlockExposureUsd: 1000 },
      toggles: { autoArm: true, autoFire: false }
    },
  ],
};

const FormField = ({ 
  label, 
  children, 
  hint 
}: { 
  label: string; 
  children: React.ReactNode; 
  hint?: string;
}) => {
  const tokens = useTokens();
  const colors = tokens.colors;
  
  return (
    <div style={{ marginBottom: `${tokens.space.xl}px` }}>
      <label style={{ 
        display: 'block',
        fontSize: `${tokens.type.sizes.sm}px`,
        color: colors.textSecondary,
        marginBottom: `${tokens.space.sm}px`,
        fontWeight: tokens.type.weights.medium,
      }}>
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ 
          fontSize: `${tokens.type.sizes.xs}px`,
          color: colors.subtle,
          marginTop: `${tokens.space.xs}px`,
        }}>
          {hint}
        </p>
      )}
    </div>
  );
};

const Input = ({ 
  value, 
  onChange, 
  type = 'text',
  disabled = false,
  placeholder = '',
  style = {}
}: { 
  value: string | number; 
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  disabled?: boolean;
  placeholder?: string;
  style?: React.CSSProperties;
}) => {
  const tokens = useTokens();
  const colors = tokens.colors;
  
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      disabled={disabled}
      placeholder={placeholder}
      style={{
        width: '100%',
        padding: `${tokens.space.md}px ${tokens.space.lg}px`,
        fontSize: `${tokens.type.sizes.base}px`,
        color: disabled ? colors.subtle : colors.textPrimary,
        backgroundColor: disabled ? colors.bg : colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: `${tokens.radius.md}px`,
        outline: 'none',
        transition: tokens.motion.base,
        fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
      onFocus={(e) => {
        if (!disabled) e.currentTarget.style.borderColor = colors.semantic.info;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = colors.border;
      }}
    />
  );
};

const Select = ({ 
  value, 
  onChange, 
  options 
}: { 
  value: string; 
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) => {
  const tokens = useTokens();
  const colors = tokens.colors;
  
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: `${tokens.space.md}px ${tokens.space.lg}px`,
        fontSize: `${tokens.type.sizes.base}px`,
        color: colors.textPrimary,
        backgroundColor: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: `${tokens.radius.md}px`,
        outline: 'none',
        cursor: 'pointer',
        transition: tokens.motion.base,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = colors.semantic.info;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = colors.border;
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
};

const Slider = ({ 
  value, 
  onChange, 
  min, 
  max, 
  step = 1,
  suffix = ''
}: { 
  value: number; 
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
}) => {
  const tokens = useTokens();
  const colors = tokens.colors;
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.lg}px` }}>
      <input
        type="range"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        min={min}
        max={max}
        step={step}
        style={{
          flex: 1,
          height: '4px',
          appearance: 'none',
          backgroundColor: colors.border,
          borderRadius: '2px',
          outline: 'none',
          cursor: 'pointer',
        }}
      />
      <span style={{ 
        minWidth: '100px',
        textAlign: 'right',
        fontSize: `${tokens.type.sizes.base}px`,
        color: colors.textPrimary,
        fontVariantNumeric: 'tabular-nums',
        fontWeight: tokens.type.weights.medium,
      }}>
        {value}{suffix}
      </span>
    </div>
  );
};

const Toggle = ({ 
  checked, 
  onChange 
}: { 
  checked: boolean; 
  onChange: (checked: boolean) => void;
}) => {
  const tokens = useTokens();
  const colors = tokens.colors;
  
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: '44px',
        height: '26px',
        borderRadius: '13px',
        border: 'none',
        backgroundColor: checked ? colors.semantic.info : colors.border,
        position: 'relative',
        cursor: 'pointer',
        transition: tokens.motion.base,
        outline: 'none',
      }}
    >
      <div style={{
        width: '22px',
        height: '22px',
        borderRadius: '11px',
        backgroundColor: '#FFFFFF',
        position: 'absolute',
        top: '2px',
        left: checked ? '20px' : '2px',
        transition: tokens.motion.base,
      }} />
    </button>
  );
};

export function Settings() {
  const isMobile = useIsMobile();
  const tokens = useTokens();
  const colors = tokens.colors;
  const toast = useToast();
  const { blocks: scheduleBlocks, setBlocks: setScheduleBlocks } = useSchedule();
  
  const [activeTab, setActiveTab] = useState<TabId>('account');
  const [settings, setSettings] = useState<SettingsData>(INITIAL_SETTINGS);
  const [editingBlock, setEditingBlock] = useState<ScheduledBlock | null>(null);

  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: 'account', label: 'Account', icon: <DollarSign className="w-4 h-4" /> },
    { id: 'strategies', label: 'Strategy Defaults', icon: <Target className="w-4 h-4" /> },
    { id: 'discipline', label: 'Discipline & Risk', icon: <Shield className="w-4 h-4" /> },
    { id: 'schedule', label: 'Schedule', icon: <Calendar className="w-4 h-4" /> },
    { id: 'visuals', label: 'Visuals & Behavior', icon: <Palette className="w-4 h-4" /> },
    { id: 'advanced', label: 'Advanced', icon: <Code className="w-4 h-4" /> },
  ];

  const handleSave = () => {
    // Save to localStorage
    localStorage.setItem('vibesnipe-settings', JSON.stringify(settings));
    // Also sync blocks to schedule store
    setScheduleBlocks(settings.blocks);
    toast('Settings saved successfully', 'profit');
  };

  const handleReset = () => {
    setSettings(INITIAL_SETTINGS);
    toast('Settings reset to defaults', 'info');
  };

  const updateSetting = <K extends keyof SettingsData>(key: K, value: SettingsData[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
    // If blocks changed, sync to schedule store
    if (key === 'blocks') {
      setScheduleBlocks(value as ScheduledBlock[]);
    }
  };

  const updatePreset = (id: string, updates: Partial<StrategyPreset>) => {
    setSettings(prev => ({
      ...prev,
      presets: prev.presets.map(p => p.id === id ? { ...p, ...updates } : p)
    }));
  };

  const addPreset = () => {
    const newPreset: StrategyPreset = {
      id: Date.now().toString(),
      name: 'New Preset',
      direction: 'CALL',
      defaultTP: 50,
      defaultSL: 100,
      width: 10,
      deltaTarget: 50,
      autoArm: true,
      autoFire: false,
    };
    setSettings(prev => ({ ...prev, presets: [...prev.presets, newPreset] }));
    toast('Preset added', 'profit');
  };

  const deletePreset = (id: string) => {
    setSettings(prev => ({ ...prev, presets: prev.presets.filter(p => p.id !== id) }));
    toast('Preset deleted', 'info');
  };

  const addBlock = () => {
    const newBlock: ScheduledBlock = {
      id: Date.now().toString(),
      label: 'New Block',
      windowStart: '14:00',
      windowEnd: '14:30',
      underlying: 'SPX' as Underlying,
      strategy: 'Vertical' as StrategyKind,
      entryMech: 'manual_preset',
      rules: { tpPct: 50, slPct: 100 },
      limits: { maxTrades: 3, perBlockExposureUsd: 1000 },
      toggles: { autoArm: true, autoFire: false }
    };
    setSettings(prev => ({ ...prev, blocks: [...prev.blocks, newBlock] }));
    setScheduleBlocks([...settings.blocks, newBlock]);
    setEditingBlock(newBlock);
    toast('Block added', 'profit');
  };

  const updateBlock = (id: string, updates: Partial<ScheduledBlock>) => {
    const updated = settings.blocks.map(b => b.id === id ? { ...b, ...updates } : b);
    setSettings(prev => ({
      ...prev,
      blocks: updated
    }));
    setScheduleBlocks(updated);
    // Update editingBlock if it's the block being edited - use the updated block from the array
    if (editingBlock?.id === id) {
      const updatedBlock = updated.find(b => b.id === id);
      if (updatedBlock) {
        setEditingBlock(updatedBlock);
      }
    }
  };

  const deleteBlock = (id: string) => {
    const updated = settings.blocks.filter(b => b.id !== id);
    setSettings(prev => ({ ...prev, blocks: updated }));
    setScheduleBlocks(updated);
    setEditingBlock(null);
    toast('Block deleted', 'info');
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
            Settings
          </h1>
          <p style={{ 
            fontSize: `${tokens.type.sizes.base}px`,
            color: colors.textSecondary,
          }}>
            Risk, discipline, and schedule control
          </p>
        </div>

        {/* Tabs */}
        <div style={{ 
          display: 'inline-flex',
          gap: `${tokens.space.xs}px`,
          padding: `${tokens.space.xs}px`,
          backgroundColor: colors.surface,
          borderRadius: `${tokens.radius.xl}px`,
          marginBottom: `${tokens.space.xxxl}px`,
          flexWrap: isMobile ? 'wrap' : 'nowrap',
          overflowX: isMobile ? 'auto' : 'visible',
          width: isMobile ? '100%' : 'auto',
        }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: `${tokens.space.sm}px`,
                padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
                fontSize: `${tokens.type.sizes.sm}px`,
                fontWeight: tokens.type.weights.medium,
                color: activeTab === tab.id ? colors.textPrimary : colors.textSecondary,
                backgroundColor: activeTab === tab.id ? colors.bg : 'transparent',
                border: 'none',
                borderRadius: `${tokens.radius.md}px`,
                cursor: 'pointer',
                transition: tokens.motion.base,
                whiteSpace: 'nowrap',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
          >
            {/* ACCOUNT TAB */}
            {activeTab === 'account' && (
              <div>
                <div style={{ 
                  backgroundColor: colors.surface,
                  borderRadius: `${tokens.radius.xl}px`,
                  border: `1px solid ${colors.border}`,
                  padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xxl}px`,
                  marginBottom: `${tokens.space.xl}px`,
                }}>
                  <h2 style={{ 
                    fontSize: `${tokens.type.sizes.lg}px`,
                    marginBottom: `${tokens.space.xxl}px`,
                    fontWeight: tokens.type.weights.semibold,
                  }}>
                    Account & Broker Connection
                  </h2>

                  <FormField label="Broker Environment">
                    <Select
                      value={settings.brokerEnv}
                      onChange={(v) => updateSetting('brokerEnv', v as 'sandbox' | 'live')}
                      options={[
                        { value: 'live', label: 'Tasty Trade - Live (Real Money)' },
                        { value: 'sandbox', label: 'Tasty Trade - Sandbox (Paper Trading)' },
                      ]}
                    />
                  </FormField>

                  <FormField label="Username">
                    <Input 
                      value={settings.username} 
                      onChange={(e) => updateSetting('username', e.target.value)}
                      placeholder="Enter your Tasty Trade username"
                    />
                  </FormField>

                  <FormField label="Password">
                    <Input 
                      type="password"
                      value={settings.password} 
                      onChange={(e) => updateSetting('password', e.target.value)}
                      placeholder="Enter your password"
                    />
                  </FormField>

                  <FormField label="Account ID (Read-only)">
                    <Input value={settings.accountId} disabled />
                  </FormField>

                  <FormField label="Default Risk % per Trade">
                    <Slider
                      value={settings.defaultRiskPct}
                      onChange={(v) => updateSetting('defaultRiskPct', v)}
                      min={0.5}
                      max={10}
                      step={0.5}
                      suffix="%"
                    />
                  </FormField>

                  <FormField label="Max Risk Cap ($)">
                    <Input
                      type="number"
                      value={settings.maxRiskCapUsd}
                      onChange={(e) => updateSetting('maxRiskCapUsd', Number(e.target.value))}
                    />
                  </FormField>
                </div>

                {/* Balance Card */}
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
                  gap: `${tokens.space.lg}px`,
                  padding: `${tokens.space.xl}px`,
                  backgroundColor: colors.surface,
                  borderRadius: `${tokens.radius.xl}px`,
                  border: `1px solid ${colors.border}`,
                }}>
                  <div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.xs}px`,
                      color: colors.subtle,
                      marginBottom: `${tokens.space.xs}px`,
                    }}>
                      Buying Power
                    </div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.xl}px`,
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: tokens.type.weights.semibold,
                    }}>
                      $25,000
                    </div>
                  </div>
                  <div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.xs}px`,
                      color: colors.subtle,
                      marginBottom: `${tokens.space.xs}px`,
                    }}>
                      Margin Used
                    </div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.xl}px`,
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: tokens.type.weights.semibold,
                    }}>
                      $3,240
                    </div>
                  </div>
                  <div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.xs}px`,
                      color: colors.subtle,
                      marginBottom: `${tokens.space.xs}px`,
                    }}>
                      Balance
                    </div>
                    <div style={{ 
                      fontSize: `${tokens.type.sizes.xl}px`,
                      color: colors.semantic.profit,
                      fontVariantNumeric: 'tabular-nums',
                      fontWeight: tokens.type.weights.semibold,
                    }}>
                      $28,450
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STRATEGY DEFAULTS TAB */}
            {activeTab === 'strategies' && (
              <div>
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: `${tokens.space.xl}px`,
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? `${tokens.space.md}px` : 0,
                }}>
                  <h2 style={{ 
                    fontSize: `${tokens.type.sizes.lg}px`,
                    fontWeight: tokens.type.weights.semibold,
                  }}>
                    Saved Presets
                  </h2>
                  <button
                    onClick={addPreset}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: `${tokens.space.sm}px`,
                      padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
                      fontSize: `${tokens.type.sizes.sm}px`,
                      fontWeight: tokens.type.weights.medium,
                      color: colors.textPrimary,
                      backgroundColor: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: `${tokens.radius.md}px`,
                      cursor: 'pointer',
                      transition: tokens.motion.base,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.surfaceAlt;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = colors.surface;
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Add Preset
                  </button>
                </div>

                <div style={{ display: 'grid', gap: `${tokens.space.lg}px` }}>
                  {settings.presets.map((preset) => (
                    <div
                      key={preset.id}
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: `${tokens.radius.xl}px`,
                        border: `1px solid ${colors.border}`,
                        padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xl}px`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: `${tokens.space.lg}px`, alignItems: 'center' }}>
                        <Input
                          value={preset.name}
                          onChange={(e) => updatePreset(preset.id, { name: e.target.value })}
                          style={{ 
                            fontSize: `${tokens.type.sizes.lg}px`,
                            fontWeight: tokens.type.weights.semibold,
                            maxWidth: '400px',
                          }}
                        />
                        <button
                          onClick={() => deletePreset(preset.id)}
                          style={{
                            padding: `${tokens.space.sm}px`,
                            color: colors.semantic.risk,
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: `${tokens.radius.sm}px`,
                            cursor: 'pointer',
                            transition: tokens.motion.base,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = colors.surfaceAlt;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: `${tokens.space.lg}px` }}>
                        <FormField label="Direction">
                          <Select
                            value={preset.direction}
                            onChange={(value) => updatePreset(preset.id, { direction: value as 'CALL' | 'PUT' })}
                            options={[
                              { value: 'CALL', label: 'CALL' },
                              { value: 'PUT', label: 'PUT' },
                            ]}
                          />
                        </FormField>
                        <FormField label="Target Profit %">
                          <Input
                            type="number"
                            value={preset.defaultTP}
                            onChange={(e) => updatePreset(preset.id, { defaultTP: Number(e.target.value) })}
                          />
                        </FormField>
                        <FormField label="Stop Loss %">
                          <Input
                            type="number"
                            value={preset.defaultSL}
                            onChange={(e) => updatePreset(preset.id, { defaultSL: Number(e.target.value) })}
                          />
                        </FormField>
                        <FormField label="Time Exit">
                          <Input
                            value={preset.timeExit || ''}
                            onChange={(e) => updatePreset(preset.id, { timeExit: e.target.value })}
                            placeholder="HH:MM"
                          />
                        </FormField>
                        <FormField label="Width">
                          <Input
                            type="number"
                            value={preset.width}
                            onChange={(e) => updatePreset(preset.id, { width: Number(e.target.value) })}
                          />
                        </FormField>
                        <FormField label="Delta Target">
                          <Input
                            type="number"
                            value={preset.deltaTarget}
                            onChange={(e) => updatePreset(preset.id, { deltaTarget: Number(e.target.value) })}
                          />
                        </FormField>
                      </div>

                      <div style={{ 
                        display: 'flex',
                        gap: `${tokens.space.xxl}px`,
                        marginTop: `${tokens.space.lg}px`,
                        flexWrap: isMobile ? 'wrap' : 'nowrap',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.md}px` }}>
                          <Toggle
                            checked={preset.autoArm}
                            onChange={(checked) => updatePreset(preset.id, { autoArm: checked })}
                          />
                          <span style={{ fontSize: `${tokens.type.sizes.sm}px`, color: colors.textSecondary }}>
                            Auto-Arm
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.md}px` }}>
                          <Toggle
                            checked={preset.autoFire}
                            onChange={(checked) => updatePreset(preset.id, { autoFire: checked })}
                          />
                          <span style={{ fontSize: `${tokens.type.sizes.sm}px`, color: colors.textSecondary }}>
                            Auto-Fire
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DISCIPLINE & RISK TAB */}
            {activeTab === 'discipline' && (
              <div style={{ 
                backgroundColor: colors.surface,
                borderRadius: `${tokens.radius.xl}px`,
                border: `1px solid ${colors.border}`,
                padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xxl}px`,
              }}>
                <h2 style={{ 
                  fontSize: `${tokens.type.sizes.lg}px`,
                  marginBottom: `${tokens.space.xxl}px`,
                  fontWeight: tokens.type.weights.semibold,
                }}>
                  Daily Guardrails
                </h2>

                <FormField 
                  label="Daily Exposure Cap ($)"
                  hint="Hard ceiling across all underlyings"
                >
                  <Input
                    type="number"
                    value={settings.dailyExposureCap}
                    onChange={(e) => updateSetting('dailyExposureCap', Number(e.target.value))}
                  />
                </FormField>

                <FormField label="Per-Underlying Exposure Caps">
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: `${tokens.space.lg}px` }}>
                    <div>
                      <label style={{ 
                        fontSize: `${tokens.type.sizes.xs}px`,
                        color: colors.subtle,
                        display: 'block',
                        marginBottom: `${tokens.space.xs}px`,
                      }}>
                        SPX
                      </label>
                      <Input
                        type="number"
                        value={settings.perUnderlyingCap.SPX}
                        onChange={(e) => updateSetting('perUnderlyingCap', {
                          ...settings.perUnderlyingCap,
                          SPX: Number(e.target.value)
                        })}
                      />
                    </div>
                    <div>
                      <label style={{ 
                        fontSize: `${tokens.type.sizes.xs}px`,
                        color: colors.subtle,
                        display: 'block',
                        marginBottom: `${tokens.space.xs}px`,
                      }}>
                        QQQ
                      </label>
                      <Input
                        type="number"
                        value={settings.perUnderlyingCap.QQQ}
                        onChange={(e) => updateSetting('perUnderlyingCap', {
                          ...settings.perUnderlyingCap,
                          QQQ: Number(e.target.value)
                        })}
                      />
                    </div>
                    <div>
                      <label style={{ 
                        fontSize: `${tokens.type.sizes.xs}px`,
                        color: colors.subtle,
                        display: 'block',
                        marginBottom: `${tokens.space.xs}px`,
                      }}>
                        SPY
                      </label>
                      <Input
                        type="number"
                        value={settings.perUnderlyingCap.SPY}
                        onChange={(e) => updateSetting('perUnderlyingCap', {
                          ...settings.perUnderlyingCap,
                          SPY: Number(e.target.value)
                        })}
                      />
                    </div>
                  </div>
                </FormField>

                <FormField label="Max Scalps per Block">
                  <Slider
                    value={settings.maxScalpsPerBlock}
                    onChange={(v) => updateSetting('maxScalpsPerBlock', v)}
                    min={1}
                    max={5}
                    step={1}
                  />
                </FormField>

                <FormField label="Cool-down After Stop (seconds)">
                  <Input
                    type="number"
                    value={settings.coolDownAfterStop}
                    onChange={(e) => updateSetting('coolDownAfterStop', Number(e.target.value))}
                  />
                </FormField>

                <FormField 
                  label="Grace Period After Window (minutes)"
                  hint="Allows late fills after window closes"
                >
                  <Input
                    type="number"
                    value={settings.gracePeriodMin}
                    onChange={(e) => updateSetting('gracePeriodMin', Number(e.target.value))}
                  />
                </FormField>

                <FormField label="Timezone">
                  <Select
                    value={settings.timezone}
                    onChange={(v) => updateSetting('timezone', v)}
                    options={[
                      { value: 'America/New_York', label: 'America/New_York (ET)' },
                      { value: 'America/Chicago', label: 'America/Chicago (CT)' },
                      { value: 'America/Denver', label: 'America/Denver (MT)' },
                      { value: 'America/Los_Angeles', label: 'America/Los_Angeles (PT)' },
                    ]}
                  />
                </FormField>

                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: `${tokens.space.lg}px`,
                  marginTop: `${tokens.space.lg}px`,
                  borderTop: `1px solid ${colors.border}`,
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? `${tokens.space.md}px` : 0,
                }}>
                  <div>
                    <div style={{ fontSize: `${tokens.type.sizes.base}px`, marginBottom: `${tokens.space.xs}px` }}>
                      Override Confirmation Required
                    </div>
                    <p style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.subtle }}>
                      Hold-to-confirm safety for override actions
                    </p>
                  </div>
                  <Toggle
                    checked={settings.overrideConfirmation}
                    onChange={(checked) => updateSetting('overrideConfirmation', checked)}
                  />
                </div>
              </div>
            )}

            {/* SCHEDULE TAB */}
            {activeTab === 'schedule' && (
              <div>
                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: `${tokens.space.xl}px`,
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? `${tokens.space.md}px` : 0,
                }}>
                  <h2 style={{ 
                    fontSize: `${tokens.type.sizes.lg}px`,
                    fontWeight: tokens.type.weights.semibold,
                  }}>
                    Trading Blocks
                  </h2>
                  <button
                    onClick={addBlock}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: `${tokens.space.sm}px`,
                      padding: `${tokens.space.sm}px ${tokens.space.lg}px`,
                      fontSize: `${tokens.type.sizes.sm}px`,
                      fontWeight: tokens.type.weights.medium,
                      color: colors.textPrimary,
                      backgroundColor: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: `${tokens.radius.md}px`,
                      cursor: 'pointer',
                      transition: tokens.motion.base,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = colors.surfaceAlt;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = colors.surface;
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Add Block
                  </button>
                </div>

                {/* Timeline Ribbon */}
                <div style={{ 
                  display: 'flex',
                  gap: `${tokens.space.md}px`,
                  flexWrap: 'wrap',
                  marginBottom: `${tokens.space.xxl}px`,
                  padding: `${tokens.space.lg}px`,
                  backgroundColor: colors.surface,
                  borderRadius: `${tokens.radius.xl}px`,
                  border: `1px solid ${colors.border}`,
                }}>
                  {settings.blocks.map((block) => (
                    <button
                      key={block.id}
                      onClick={() => setEditingBlock(block)}
                      style={{
                        padding: `${tokens.space.md}px ${tokens.space.lg}px`,
                        borderRadius: `${tokens.radius.md}px`,
                        backgroundColor: editingBlock?.id === block.id ? colors.semantic.info + '20' : colors.bg,
                        border: `1px solid ${editingBlock?.id === block.id ? colors.semantic.info : colors.border}`,
                        cursor: 'pointer',
                        transition: tokens.motion.base,
                      }}
                      onMouseEnter={(e) => {
                        if (editingBlock?.id !== block.id) {
                          e.currentTarget.style.backgroundColor = colors.surfaceAlt;
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (editingBlock?.id !== block.id) {
                          e.currentTarget.style.backgroundColor = colors.bg;
                        }
                      }}
                    >
                      <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.subtle, marginBottom: `${tokens.space.xs}px` }}>
                        {block.windowStart} - {block.windowEnd}
                      </div>
                      <div style={{ fontSize: `${tokens.type.sizes.sm}px`, color: colors.textPrimary, fontWeight: tokens.type.weights.medium }}>
                        {block.label}
                      </div>
                      <div style={{ fontSize: `${tokens.type.sizes.xs}px`, color: colors.semantic.info, marginTop: `${tokens.space.xs}px` }}>
                        {block.underlying}
                      </div>
                    </button>
                  ))}
                </div>

                {/* Block Editor */}
                {editingBlock && (
                  <div style={{ 
                    backgroundColor: colors.surface,
                    borderRadius: `${tokens.radius.xl}px`,
                    border: `1px solid ${colors.border}`,
                    padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xxl}px`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: `${tokens.space.xl}px`, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? `${tokens.space.md}px` : 0 }}>
                      <h3 style={{ fontSize: `${tokens.type.sizes.lg}px`, fontWeight: tokens.type.weights.semibold }}>
                        {editingBlock.label}
                      </h3>
                      <div style={{ display: 'flex', gap: `${tokens.space.sm}px` }}>
                        <button
                          onClick={() => deleteBlock(editingBlock.id)}
                          style={{
                            padding: `${tokens.space.sm}px`,
                            color: colors.semantic.risk,
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: `${tokens.radius.sm}px`,
                            cursor: 'pointer',
                            transition: tokens.motion.base,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = colors.surfaceAlt;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingBlock(null)}
                          style={{
                            padding: `${tokens.space.sm}px`,
                            color: colors.textSecondary,
                            backgroundColor: 'transparent',
                            border: 'none',
                            borderRadius: `${tokens.radius.sm}px`,
                            cursor: 'pointer',
                            transition: tokens.motion.base,
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = colors.surfaceAlt;
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: `${tokens.space.lg}px` }}>
                      <FormField label="Label">
                        <Input
                          value={editingBlock.label}
                          onChange={(e) => updateBlock(editingBlock.id, { label: e.target.value })}
                        />
                      </FormField>
                      <FormField label="Underlying">
                        <Select
                          value={editingBlock.underlying}
                          onChange={(v) => updateBlock(editingBlock.id, { underlying: v as Underlying })}
                          options={[
                            { value: 'SPX', label: 'SPX' },
                            { value: 'QQQ', label: 'QQQ' },
                            { value: 'NDX', label: 'NDX' },
                            { value: 'AAPL', label: 'AAPL' },
                            { value: 'TSLA', label: 'TSLA' },
                            { value: 'SPY', label: 'SPY' },
                            { value: 'RUT', label: 'RUT' },
                          ]}
                        />
                      </FormField>
                      <FormField label="Window Start">
                        <Input
                          value={editingBlock.windowStart}
                          onChange={(e) => updateBlock(editingBlock.id, { windowStart: e.target.value })}
                          placeholder="HH:MM"
                        />
                      </FormField>
                      <FormField label="Window End">
                        <Input
                          value={editingBlock.windowEnd}
                          onChange={(e) => updateBlock(editingBlock.id, { windowEnd: e.target.value })}
                          placeholder="HH:MM"
                        />
                      </FormField>
                      <FormField label="Entry Mechanism">
                        <Select
                          value={editingBlock.entryMech}
                          onChange={(v) => updateBlock(editingBlock.id, { entryMech: v as any })}
                          options={[
                            { value: 'manual_preset', label: 'Manual Preset' },
                            { value: 'copy_paste', label: 'Copy/Paste' },
                            { value: 'auto', label: 'Auto' },
                          ]}
                        />
                      </FormField>
                      <FormField label="Max Trades">
                        <Input
                          type="number"
                          value={editingBlock.limits.maxTrades}
                          onChange={(e) => updateBlock(editingBlock.id, {
                            limits: { ...editingBlock.limits, maxTrades: Number(e.target.value) }
                          })}
                        />
                      </FormField>
                    </div>

                    <div style={{ 
                      display: 'flex',
                      gap: `${tokens.space.xxl}px`,
                      marginTop: `${tokens.space.xl}px`,
                      paddingTop: `${tokens.space.xl}px`,
                      borderTop: `1px solid ${colors.border}`,
                      flexWrap: isMobile ? 'wrap' : 'nowrap',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.md}px` }}>
                        <Toggle
                          checked={editingBlock.toggles?.autoArm || false}
                          onChange={(checked) => updateBlock(editingBlock.id, {
                            toggles: { ...editingBlock.toggles, autoArm: checked, autoFire: editingBlock.toggles?.autoFire || false }
                          })}
                        />
                        <span style={{ fontSize: `${tokens.type.sizes.sm}px`, color: colors.textSecondary }}>
                          Auto-Arm
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: `${tokens.space.md}px` }}>
                        <Toggle
                          checked={editingBlock.toggles?.autoFire || false}
                          onChange={(checked) => updateBlock(editingBlock.id, {
                            toggles: { ...editingBlock.toggles, autoFire: checked, autoArm: editingBlock.toggles?.autoArm || false }
                          })}
                        />
                        <span style={{ fontSize: `${tokens.type.sizes.sm}px`, color: colors.textSecondary }}>
                          Auto-Fire
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* VISUALS TAB */}
            {activeTab === 'visuals' && (
              <div style={{ 
                backgroundColor: colors.surface,
                borderRadius: `${tokens.radius.xl}px`,
                border: `1px solid ${colors.border}`,
                padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xxl}px`,
              }}>
                <h2 style={{ 
                  fontSize: `${tokens.type.sizes.lg}px`,
                  marginBottom: `${tokens.space.xxl}px`,
                  fontWeight: tokens.type.weights.semibold,
                }}>
                  Visuals & Behavior
                </h2>

                <FormField label="Theme">
                  <Select
                    value={settings.theme}
                    onChange={(v) => updateSetting('theme', v as any)}
                    options={[
                      { value: 'dark', label: 'Dark' },
                      { value: 'light', label: 'Light' },
                      { value: 'auto', label: 'Auto (System)' },
                    ]}
                  />
                </FormField>

                <FormField label="Motion Speed (ms)">
                  <Slider
                    value={settings.motionSpeed}
                    onChange={(v) => updateSetting('motionSpeed', v)}
                    min={50}
                    max={300}
                    step={50}
                    suffix="ms"
                  />
                </FormField>

                <FormField label="Nudge Ticks">
                  <Slider
                    value={settings.nudgeTicks}
                    onChange={(v) => updateSetting('nudgeTicks', v)}
                    min={1}
                    max={5}
                    step={1}
                  />
                </FormField>

                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: `${tokens.space.lg}px`,
                  marginTop: `${tokens.space.lg}px`,
                  borderTop: `1px solid ${colors.border}`,
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? `${tokens.space.md}px` : 0,
                }}>
                  <div>
                    <div style={{ fontSize: `${tokens.type.sizes.base}px`, marginBottom: `${tokens.space.xs}px` }}>
                      Audible Cues
                    </div>
                  </div>
                  <Toggle
                    checked={settings.audibleCues}
                    onChange={(checked) => updateSetting('audibleCues', checked)}
                  />
                </div>

                <div style={{ 
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: `${tokens.space.lg}px`,
                  marginTop: `${tokens.space.lg}px`,
                  borderTop: `1px solid ${colors.border}`,
                  flexDirection: isMobile ? 'column' : 'row',
                  gap: isMobile ? `${tokens.space.md}px` : 0,
                }}>
                  <div>
                    <div style={{ fontSize: `${tokens.type.sizes.base}px`, marginBottom: `${tokens.space.xs}px` }}>
                      Breakeven Overlays
                    </div>
                  </div>
                  <Toggle
                    checked={settings.breakevenOverlays}
                    onChange={(checked) => updateSetting('breakevenOverlays', checked)}
                  />
                </div>
              </div>
            )}

            {/* ADVANCED TAB */}
            {activeTab === 'advanced' && (
              <div style={{ 
                backgroundColor: colors.surface,
                borderRadius: `${tokens.radius.xl}px`,
                border: `1px solid ${colors.border}`,
                padding: isMobile ? `${tokens.space.lg}px` : `${tokens.space.xxl}px`,
              }}>
                <h2 style={{ 
                  fontSize: `${tokens.type.sizes.lg}px`,
                  marginBottom: `${tokens.space.xxl}px`,
                  fontWeight: tokens.type.weights.semibold,
                }}>
                  Advanced Settings
                </h2>

                <FormField label="Debug Mode" hint="Enable detailed logging">
                  <Toggle
                    checked={false}
                    onChange={() => {}}
                  />
                </FormField>

                <FormField label="API Endpoint">
                  <Input
                    value="https://api.tastytrade.com"
                    disabled
                  />
                </FormField>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Footer Buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: `${tokens.space.xxxl}px`,
          paddingTop: `${tokens.space.xl}px`,
          borderTop: `1px solid ${colors.border}`,
          flexDirection: isMobile ? 'column' : 'row',
          gap: isMobile ? `${tokens.space.md}px` : 0,
        }}>
          <button
            onClick={handleReset}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${tokens.space.sm}px`,
              padding: `${tokens.space.md}px ${tokens.space.lg}px`,
              fontSize: `${tokens.type.sizes.base}px`,
              color: colors.textPrimary,
              backgroundColor: 'transparent',
              border: `1px solid ${colors.border}`,
              borderRadius: `${tokens.radius.md}px`,
              cursor: 'pointer',
              transition: tokens.motion.base,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = colors.surface;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Defaults
          </button>
          <button
            onClick={handleSave}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: `${tokens.space.sm}px`,
              padding: `${tokens.space.md}px ${tokens.space.lg}px`,
              fontSize: `${tokens.type.sizes.base}px`,
              fontWeight: tokens.type.weights.medium,
              color: '#FFFFFF',
              backgroundColor: colors.semantic.info,
              border: 'none',
              borderRadius: `${tokens.radius.md}px`,
              cursor: 'pointer',
              transition: tokens.motion.base,
              boxShadow: `0 4px 12px ${colors.semantic.info}40`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = `0 6px 16px ${colors.semantic.info}50`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = `0 4px 12px ${colors.semantic.info}40`;
            }}
          >
            <Save className="w-4 h-4" />
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
