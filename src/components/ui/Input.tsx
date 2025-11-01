'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = '', ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full px-12 py-8 rounded-md text-sm font-regular border transition-all duration-fast focus:outline-none focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-2 tabular-nums ${className}`}
        style={{
          backgroundColor: 'var(--bg)',
          borderColor: 'var(--border)',
          color: 'var(--text-primary)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--info)';
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--border)';
        }}
        {...props}
      />
    );
  }
);

Input.displayName = 'Input';

