'use client';

import { useTokens } from '@/hooks/useTokens';

// LEGACY COMPONENT - Not currently used in main app flow
// This component has been disabled as it references old ScheduledBlock API
// The main app uses CreateTradeV3.tsx for preset-based trade entry
export function PresetEntry() {
  const tokens = useTokens();

  return (
    <div style={{
      padding: `${tokens.space.xl}px`,
      textAlign: 'center',
      color: tokens.colors.textSecondary,
      fontSize: `${tokens.type.sizes.base}px`,
    }}>
      Preset entry is managed through the main Create Trade flow.
      <br />
      <span style={{ fontSize: `${tokens.type.sizes.sm}px`, color: tokens.colors.subtle }}>
        Use the Saved Presets from the Library or define blocks in Settings.
      </span>
    </div>
  );
}
