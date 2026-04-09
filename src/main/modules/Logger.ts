/**
 * Logger
 * Centralized logging with levels and formatting
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  level: LogLevel;
  prefix: string;
  timestamp: boolean;
  colors: boolean;
}

const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  prefix: 'Marix',
  timestamp: true,
  colors: true,
};

class Logger {
  private config: LoggerConfig;
  private static instance: Logger;

  private constructor() {
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Get singleton instance
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * Configure logger
   */
  configure(config: Partial<LoggerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Set log level
   */
  setLevel(level: LogLevel): void {
    this.config.level = level;
  }

  /**
   * Get current level
   */
  getLevel(): LogLevel {
    return this.config.level;
  }

  /**
   * Check if should log
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevel = levels.indexOf(this.config.level);
    const messageLevel = levels.indexOf(level);
    return messageLevel >= currentLevel;
  }

  /**
   * Format message
   */
  private format(level: LogLevel, message: string, ...args: any[]): string {
    const parts: string[] = [];
    
    // Timestamp
    if (this.config.timestamp) {
      const time = new Date().toISOString();
      parts.push(this.config.colors ? `\x1b[90m${time}\x1b[0m` : time);
    }
    
    // Prefix
    if (this.config.prefix) {
      parts.push(`[${this.config.prefix}]`);
    }
    
    // Level
    const levelStr = level.toUpperCase().padEnd(5);
    const levelColor = this.getLevelColor(level);
    parts.push(this.config.colors ? `${levelColor}${levelStr}\x1b[0m` : levelStr);
    
    // Message
    parts.push(message);
    
    return parts.join(' ');
  }

  /**
   * Get color for level
   */
  private getLevelColor(level: LogLevel): string {
    const colors: Record<LogLevel, string> = {
      debug: '\x1b[36m',   // cyan
      info: '\x1b[32m',    // green
      warn: '\x1b[33m',    // yellow
      error: '\x1b[31m',   // red
    };
    return colors[level];
  }

  /**
   * Debug log
   */
  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.format('debug', message), ...args);
    }
  }

  /**
   * Info log
   */
  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.log(this.format('info', message), ...args);
    }
  }

  /**
   * Warning log
   */
  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.format('warn', message), ...args);
    }
  }

  /**
   * Error log
   */
  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.format('error', message), ...args);
    }
  }

  /**
   * Convenience: log with context
   */
  log(context: string, message: string, ...args: any[]): void {
    this.info(`[${context}] ${message}`, ...args);
  }
}

// Export singleton
export const logger = Logger.getInstance();
export default logger;

// Export for module use
export function createLogger(prefix: string): Pick<typeof logger, 'debug' | 'info' | 'warn' | 'error'> {
  return {
    debug: (msg: string, ...args: any[]) => logger.debug(`[${prefix}] ${msg}`, ...args),
    info: (msg: string, ...args: any[]) => logger.info(`[${prefix}] ${msg}`, ...args),
    warn: (msg: string, ...args: any[]) => logger.warn(`[${prefix}] ${msg}`, ...args),
    error: (msg: string, ...args: any[]) => logger.error(`[${prefix}] ${msg}`, ...args),
  };
}
