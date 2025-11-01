'use client';

import { useState, HTMLAttributes } from 'react';

interface Tab {
  id: string;
  label: string;
}

interface SegmentedTabsProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  tabs: Tab[];
  defaultValue?: string;
  value?: string;
  onChange?: (value: string) => void;
}

export function SegmentedTabs({
  tabs,
  defaultValue,
  value: controlledValue,
  onChange,
  className = '',
  ...props
}: SegmentedTabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue || tabs[0]?.id);
  const activeValue = controlledValue ?? internalValue;
  const activeIndex = tabs.findIndex((tab) => tab.id === activeValue);

  const handleChange = (tabId: string) => {
    if (controlledValue === undefined) {
      setInternalValue(tabId);
    }
    onChange?.(tabId);
  };

  return (
    <div
      className={`relative flex gap-4 border rounded-md p-4 ${className}`}
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
      }}
      {...props}
    >
      {/* Active indicator */}
      <div
        className="absolute bottom-4 left-4 h-0.5 bg-profit transition-all duration-smooth"
        style={{
          width: `calc(${100 / tabs.length}% - 8px)`,
          transform: `translateX(${activeIndex * 100}%)`,
        }}
      />
      
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleChange(tab.id)}
          className="flex-1 px-12 py-8 text-sm font-medium transition-colors duration-fast relative z-10"
          style={{
            color: activeValue === tab.id ? 'var(--profit)' : 'var(--text-secondary)',
          }}
          onMouseEnter={(e) => {
            if (activeValue !== tab.id) {
              e.currentTarget.style.color = 'var(--text-primary)';
            }
          }}
          onMouseLeave={(e) => {
            if (activeValue !== tab.id) {
              e.currentTarget.style.color = 'var(--text-secondary)';
            }
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

