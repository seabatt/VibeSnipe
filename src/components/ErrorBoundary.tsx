'use client';

import { Component, ReactNode, ErrorInfo } from 'react';
import { useTokens } from '@/hooks/useTokens';
import { Button } from './ui';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // In production, you would send this to an error reporting service
    // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return <ErrorFallback error={this.state.error} onReset={this.handleReset} />;
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error: Error | null;
  onReset: () => void;
}

function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  const tokens = useTokens();

  return (
    <div
      style={{
        padding: `${tokens.space.xl}px`,
        backgroundColor: tokens.colors.surface,
        border: `1px solid ${tokens.colors.semantic.risk}40`,
        borderRadius: `${tokens.radius.md}px`,
        color: tokens.colors.textPrimary,
      }}
    >
      <h2
        style={{
          fontSize: `${tokens.type.sizes.base}px`,
          fontWeight: tokens.type.weights.semibold,
          color: tokens.colors.semantic.risk,
          marginBottom: `${tokens.space.md}px`,
        }}
      >
        Something went wrong
      </h2>
      <p
        style={{
          fontSize: `${tokens.type.sizes.sm}px`,
          color: tokens.colors.textSecondary,
          marginBottom: `${tokens.space.lg}px`,
        }}
      >
        {error?.message || 'An unexpected error occurred'}
      </p>
      {process.env.NODE_ENV === 'development' && error?.stack && (
        <details
          style={{
            marginTop: `${tokens.space.md}px`,
            padding: `${tokens.space.md}px`,
            backgroundColor: tokens.colors.bg,
            borderRadius: `${tokens.radius.sm}px`,
            fontSize: `${tokens.type.sizes.xs}px`,
            fontFamily: 'monospace',
          }}
        >
          <summary style={{ cursor: 'pointer', color: tokens.colors.textSecondary }}>
            Error Stack (Development Only)
          </summary>
          <pre
            style={{
              marginTop: `${tokens.space.sm}px`,
              overflow: 'auto',
              color: tokens.colors.textPrimary,
            }}
          >
            {error.stack}
          </pre>
        </details>
      )}
      <Button
        onClick={onReset}
        variant="primary"
        style={{
          marginTop: `${tokens.space.lg}px`,
        }}
      >
        Try again
      </Button>
    </div>
  );
}

