/**
 * Structured Logger for Frontend (Client-side)
 * Lightweight logger with level control and context support
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

// Log level priority
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// Get minimum log level (debug in dev, warn in prod)
function getMinLevel(): LogLevel {
  if (import.meta.env.DEV) return 'debug';
  return 'warn';
}

// Check if logging is enabled
function isEnabled(): boolean {
  // Allow disabling logs via localStorage for debugging
  if (typeof localStorage !== 'undefined') {
    if (localStorage.getItem('DEBUG_LOGS') === 'true') return true;
    if (localStorage.getItem('DISABLE_LOGS') === 'true') return false;
  }
  return true;
}

// Format message with context — 마지막 항목은 LogContext일 수 있어 unknown[] 반환
function formatMessage(scope: string, message: string, context?: LogContext): unknown[] {
  const prefix = `[${scope}]`;
  if (context && Object.keys(context).length > 0) {
    return [prefix, message, context];
  }
  return [prefix, message];
}

// Create a log function
function log(
  level: LogLevel,
  scope: string,
  message: string,
  context?: LogContext,
  error?: Error
): void {
  if (!isEnabled()) return;

  const minLevel = getMinLevel();
  if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) return;

  const args = formatMessage(scope, message, context);

  switch (level) {
    case 'error':
      if (error) {
        console.error(...args, error);
      } else {
        console.error(...args);
      }
      break;
    case 'warn':
      if (error) {
        console.warn(...args, error);
      } else {
        console.warn(...args);
      }
      break;
    case 'info':
      console.info(...args);
      break;
    case 'debug':
      console.debug(...args);
      break;
  }
}

/**
 * Logger instance with scoped context
 */
class Logger {
  private scope: string;
  private defaultContext: LogContext;

  constructor(scope: string, defaultContext: LogContext = {}) {
    this.scope = scope;
    this.defaultContext = defaultContext;
  }

  private mergeContext(context?: LogContext): LogContext | undefined {
    if (!context && Object.keys(this.defaultContext).length === 0) {
      return undefined;
    }
    return { ...this.defaultContext, ...context };
  }

  debug(message: string, context?: LogContext): void {
    log('debug', this.scope, message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    log('info', this.scope, message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext, error?: Error): void {
    log('warn', this.scope, message, this.mergeContext(context), error);
  }

  error(message: string, context?: LogContext, error?: Error): void {
    log('error', this.scope, message, this.mergeContext(context), error);
  }

  /**
   * Create a child logger with additional context
   */
  child(additionalContext: LogContext): Logger {
    return new Logger(this.scope, {
      ...this.defaultContext,
      ...additionalContext,
    });
  }
}

/**
 * Create a logger for a specific component/module
 */
export function createLogger(scope: string, defaultContext?: LogContext): Logger {
  return new Logger(scope, defaultContext);
}

// Default logger
export const logger = createLogger('App');

// Re-export types
export type { LogLevel, LogContext, Logger };
