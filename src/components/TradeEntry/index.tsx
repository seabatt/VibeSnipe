'use client';

import { useState } from 'react';
import { SegmentedTabs } from '@/components/ui';
import { DiscordPaste } from './DiscordPaste';
import { PresetEntry } from './PresetEntry';
import { ManualBuild } from './ManualBuild';

export function TradeEntry() {
  const [activeTab, setActiveTab] = useState('discord');

  const tabs = [
    { id: 'discord', label: 'Discord' },
    { id: 'preset', label: 'Preset' },
    { id: 'manual', label: 'Manual' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-24)' }}>
      <SegmentedTabs
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
      />

      <div>
        {activeTab === 'discord' && <DiscordPaste />}
        {activeTab === 'preset' && <PresetEntry />}
        {activeTab === 'manual' && <ManualBuild />}
      </div>
    </div>
  );
}
