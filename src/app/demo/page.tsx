'use client';

import { ThemeProvider, ThemeToggle } from '@/components/providers/ThemeProvider';
import { Button, Input, Card, Chip, SegmentedTabs, Tooltip, ToastContainer, useToast } from '@/components/ui';
import { useState } from 'react';

function DemoContent() {
  const toast = useToast();
  const [inputValue, setInputValue] = useState('');
  const [activeTab, setActiveTab] = useState('discord');

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg)', color: 'var(--text-primary)' }}>
      <div className="max-w-[1320px] mx-auto px-24 py-32">
        <div className="mb-32">
          <h1 className="text-32 font-semibold mb-16">Design System Preview</h1>
          <p className="text-16 text-text-secondary mb-24">
            All components shown side-by-side with both themes
          </p>
        </div>

        {/* Theme Toggle */}
        <div className="mb-32">
          <h2 className="text-18 font-semibold mb-16">Theme Toggle</h2>
          <ThemeToggle />
        </div>

        {/* Buttons */}
        <div className="mb-32">
          <h2 className="text-18 font-semibold mb-16">Buttons</h2>
          <div className="flex flex-wrap gap-12">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="quiet">Quiet</Button>
          </div>
        </div>

        {/* Inputs */}
        <div className="mb-32">
          <h2 className="text-18 font-semibold mb-16">Inputs</h2>
          <div className="max-w-md space-y-12">
            <Input placeholder="Enter text..." />
            <Input type="number" placeholder="Number input" />
            <Input type="email" placeholder="Email input" />
          </div>
        </div>

        {/* Cards */}
        <div className="mb-32">
          <h2 className="text-18 font-semibold mb-16">Cards</h2>
          <div className="grid grid-cols-3 gap-16">
            <Card>
              <h3 className="text-16 font-semibold mb-8">Card Title</h3>
              <p className="text-14 text-text-secondary">
                This is a card component with default styling.
              </p>
            </Card>
            <Card>
              <h3 className="text-16 font-semibold mb-8">Another Card</h3>
              <p className="text-14 text-text-secondary">
                Cards support any content inside them.
              </p>
            </Card>
            <Card>
              <h3 className="text-16 font-semibold mb-8">Third Card</h3>
              <p className="text-14 text-text-secondary">
                All cards use elevation-sm shadow.
              </p>
            </Card>
          </div>
        </div>

        {/* Chips */}
        <div className="mb-32">
          <h2 className="text-18 font-semibold mb-16">Chips</h2>
          <div className="flex flex-wrap gap-8">
            <Chip variant="rule">TP: 50%</Chip>
            <Chip variant="rule">SL: 100%</Chip>
            <Chip variant="status">Open</Chip>
            <Chip variant="status">Closed</Chip>
            <Chip variant="neutral">Neutral Chip</Chip>
            <Chip variant="neutral">Another</Chip>
          </div>
        </div>

        {/* Segmented Tabs */}
        <div className="mb-32">
          <h2 className="text-18 font-semibold mb-16">Segmented Tabs</h2>
          <SegmentedTabs
            tabs={[
              { id: 'discord', label: 'Discord' },
              { id: 'preset', label: 'Preset' },
              { id: 'manual', label: 'Manual' },
            ]}
            value={activeTab}
            onChange={setActiveTab}
          />
        </div>

        {/* Tooltips */}
        <div className="mb-32">
          <h2 className="text-18 font-semibold mb-16">Tooltips</h2>
          <div className="flex gap-12">
            <Tooltip content="This is a tooltip on top" side="top">
              <Button variant="secondary">Hover for tooltip (top)</Button>
            </Tooltip>
            <Tooltip content="This is a tooltip on bottom" side="bottom">
              <Button variant="secondary">Hover for tooltip (bottom)</Button>
            </Tooltip>
            <Tooltip content="This is a tooltip on left" side="left">
              <Button variant="secondary">Hover for tooltip (left)</Button>
            </Tooltip>
            <Tooltip content="This is a tooltip on right" side="right">
              <Button variant="secondary">Hover for tooltip (right)</Button>
            </Tooltip>
          </div>
        </div>

        {/* Toasts */}
        <div className="mb-32">
          <h2 className="text-18 font-semibold mb-16">Toasts</h2>
          <div className="flex flex-wrap gap-12">
            <Button
              variant="primary"
              onClick={() => toast('This is an info toast', 'info')}
            >
              Show Info Toast
            </Button>
            <Button
              variant="primary"
              onClick={() => toast('This is a profit toast', 'profit')}
            >
              Show Profit Toast
            </Button>
            <Button
              variant="destructive"
              onClick={() => toast('This is a risk toast', 'risk')}
            >
              Show Risk Toast
            </Button>
            <Button
              variant="secondary"
              onClick={() => toast('This is a warning toast', 'warning')}
            >
              Show Warning Toast
            </Button>
          </div>
        </div>

        {/* Combined Example */}
        <div className="mb-32">
          <h2 className="text-18 font-semibold mb-16">Combined Example</h2>
          <Card>
            <div className="space-y-16">
              <div className="flex items-center justify-between">
                <h3 className="text-16 font-semibold">Trade Entry</h3>
                <Chip variant="status">Active</Chip>
              </div>
              <SegmentedTabs
                tabs={[
                  { id: 'discord', label: 'Discord' },
                  { id: 'preset', label: 'Preset' },
                  { id: 'manual', label: 'Manual' },
                ]}
                value={activeTab}
                onChange={setActiveTab}
              />
              <Input
                placeholder="Enter trade details..."
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <div className="flex gap-12 justify-end">
                <Tooltip content="Cancel this trade entry">
                  <Button variant="quiet">Cancel</Button>
                </Tooltip>
                <Tooltip content="Execute this trade">
                  <Button variant="primary">Execute</Button>
                </Tooltip>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <ToastContainer />
    </div>
  );
}

export default function DemoPage() {
  return (
    <ThemeProvider>
      <DemoContent />
    </ThemeProvider>
  );
}

