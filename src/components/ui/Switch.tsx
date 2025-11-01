'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ checked = false, onCheckedChange, className = '', ...props }, ref) => {
    return (
      <label
        className={`relative inline-flex items-center cursor-pointer ${className}`}
        style={{ width: '44px', height: '24px' }}
      >
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="sr-only"
          {...props}
        />
        <div
          className="absolute inset-0 rounded-full transition-colors duration-fast"
          style={{
            backgroundColor: checked ? 'var(--profit)' : 'var(--border)',
          }}
        />
        <div
          className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-fast bg-white"
          style={{
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
          }}
        />
      </label>
    );
  }
);

Switch.displayName = 'Switch';

