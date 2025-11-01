'use client';

import { HTMLAttributes, forwardRef } from 'react';

type ChipVariant = 'rule' | 'status' | 'neutral';

interface ChipProps extends HTMLAttributes<HTMLDivElement> {
  variant?: ChipVariant;
}

export const Chip = forwardRef<HTMLDivElement, ChipProps>(
  ({ variant = 'neutral', className = '', children, ...props }, ref) => {
    const variantStyles: Record<ChipVariant, React.CSSProperties> = {
      rule: {
        backgroundColor: 'var(--profit)',
        color: 'var(--text-primary)',
        opacity: 0.2,
      },
      status: {
        backgroundColor: 'var(--info)',
        color: 'var(--text-primary)',
        opacity: 0.2,
      },
      neutral: {
        backgroundColor: 'var(--surface-alt)',
        color: 'var(--text-secondary)',
      },
    };

    const textColors: Record<ChipVariant, string> = {
      rule: 'var(--profit)',
      status: 'var(--info)',
      neutral: 'var(--text-secondary)',
    };

    return (
      <div
        ref={ref}
        className={`inline-flex items-center px-8 py-4 rounded-sm text-xs font-medium tabular-nums ${className}`}
        style={{
          ...variantStyles[variant],
          color: textColors[variant],
        }}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Chip.displayName = 'Chip';

