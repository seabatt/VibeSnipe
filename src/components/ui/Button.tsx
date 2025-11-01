'use client';

import { ButtonHTMLAttributes, forwardRef } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'quiet';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', className = '', children, ...props }, ref) => {
    const baseClasses = 'px-12 py-8 rounded-md text-sm font-semibold transition-all duration-fast tabular-nums focus:outline-none focus-visible:outline-2 focus-visible:outline-info focus-visible:outline-offset-2';
    
    const variantStyles: Record<ButtonVariant, string> = {
      primary: '',
      secondary: '',
      destructive: '',
      quiet: '',
    };

    const variantInlineStyles: Record<ButtonVariant, React.CSSProperties> = {
      primary: {
        backgroundColor: 'var(--profit)',
        color: 'var(--text-primary)',
      },
      secondary: {
        backgroundColor: 'var(--surface-alt)',
        color: 'var(--text-primary)',
        border: '1px solid var(--border)',
      },
      destructive: {
        backgroundColor: 'var(--risk)',
        color: 'var(--text-primary)',
      },
      quiet: {
        backgroundColor: 'transparent',
        color: 'var(--text-secondary)',
      },
    };

    const hoverStyles: Record<ButtonVariant, Partial<React.CSSProperties>> = {
      primary: {
        filter: 'brightness(1.05)',
        transform: 'translateY(-1px)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
      },
      secondary: {
        backgroundColor: 'var(--surface-alt)',
        filter: 'brightness(1.05)',
        transform: 'translateY(-1px)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
      },
      destructive: {
        filter: 'brightness(1.05)',
        transform: 'translateY(-1px)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
      },
      quiet: {
        color: 'var(--text-primary)',
      },
    };

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantStyles[variant]} ${className}`}
        style={variantInlineStyles[variant]}
        onMouseEnter={(e) => {
          const styles = hoverStyles[variant];
          Object.keys(styles).forEach((key) => {
            e.currentTarget.style[key as any] = styles[key as keyof typeof styles] as string;
          });
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.filter = '';
          e.currentTarget.style.transform = '';
          e.currentTarget.style.boxShadow = '';
          if (variant === 'quiet') {
            e.currentTarget.style.color = 'var(--text-secondary)';
          } else if (variant === 'secondary') {
            e.currentTarget.style.backgroundColor = 'var(--surface-alt)';
          }
        }}
        onMouseDown={(e) => {
          e.currentTarget.style.transform = 'translateY(0px)';
        }}
        onMouseUp={(e) => {
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';

