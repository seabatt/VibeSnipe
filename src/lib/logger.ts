/**
 * Structured logging utility.
 * 
 * Replaces console.log/error with proper structured logging.
 * In production, this can be integrated with Sentry, Datadog, or other services.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: any;
}

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  private isTest = process.env.NODE_ENV === 'test';

  private formatLog(entry: LogEntry): string {
    return JSON.stringify(entry);
  }

  private log(level: LogLevel, message: string, context?: LogContext, error?: Error) {
    // Skip logs in test environment unless explicitly enabled
    if (this.isTest && !process.env.ENABLE_TEST_LOGS) {
      return;
    }

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      ...(context && { context }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    // In development, use colored console output
    if (this.isDevelopment) {
      const colors = {
        debug: '\x1b[36m', // cyan
        info: '\x1b[32m',  // green
        warn: '\x1b[33m',  // yellow
        error: '\x1b[31m', // red
      };
      const reset = '\x1b[0m';
      const color = colors[level];

      console[level === 'debug' ? 'log' : level](
        `${color}[${level.toUpperCase()}]${reset}`,
        message,
        context ? context : '',
        error ? error : ''
      );
    } else {
      // In production, use structured JSON logging
      console.log(this.formatLog(entry));
    }

    // Send to external logging service in production
    if (!this.isDevelopment && !this.isTest) {
      this.sendToExternalService(entry);
    }
  }

  private sendToExternalService(entry: LogEntry) {
    // TODO: Integrate with Sentry, Datadog, or other logging service
    // For now, this is a placeholder
    // Example: Sentry.captureMessage(entry.message, { level: entry.level, extra: entry.context });
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, contextOrError?: LogContext | Error, error?: Error) {
    if (contextOrError instanceof Error) {
      this.log('error', message, undefined, contextOrError);
    } else {
      this.log('error', message, contextOrError, error);
    }
  }
}

// Export singleton instance
export const logger = new Logger();

// Convenience exports for common patterns
export const logOrderSubmission = (orderId: string, accountId: string, strikes: string) => {
  logger.info('Order submitted', { orderId, accountId, strikes });
};

export const logOrderFill = (orderId: string, fillPrice: number) => {
  logger.info('Order filled', { orderId, fillPrice });
};

export const logChaseAttempt = (orderId: string, attemptNumber: number, price: number) => {
  logger.info('Chase attempt', { orderId, attemptNumber, price });
};

export const logApiError = (endpoint: string, error: Error) => {
  logger.error(`API error: ${endpoint}`, { endpoint }, error);
};

