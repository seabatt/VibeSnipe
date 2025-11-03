import { useState, useEffect } from 'react';

const SETTINGS_KEY = 'vibesnipe-settings';

interface TradingSettings {
  defaultRiskPct: number;
  maxRiskCapUsd: number;
  brokerEnv: 'sandbox' | 'live';
  accountId: string;
}

const DEFAULT_SETTINGS: TradingSettings = {
  defaultRiskPct: 2.5,
  maxRiskCapUsd: 5000, // Default max $5k risk cap
  brokerEnv: 'sandbox',
  accountId: '',
};

/**
 * Hook to access and manage trading settings
 * Loads from localStorage with defaults
 * 
 * Note: Account value is calculated from maxRiskCapUsd and defaultRiskPct
 * Example: $5k max risk / 2.5% = $200k account value
 */
export function useSettings() {
  const [settings, setSettings] = useState<TradingSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    // Load settings from localStorage on mount
    try {
      const stored = localStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Merge with defaults to handle missing fields
        setSettings({ ...DEFAULT_SETTINGS, ...parsed });
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }, []);

  const updateSettings = (updates: Partial<TradingSettings>) => {
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    
    // Persist to localStorage
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  // Calculate implied account value from risk settings
  // Account value = maxRiskCapUsd / (defaultRiskPct / 100)
  const accountValue = settings.maxRiskCapUsd / (settings.defaultRiskPct / 100);

  return {
    settings,
    updateSettings,
    accountValue,
    riskPercentage: settings.defaultRiskPct,
  };
}

