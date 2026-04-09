/**
 * Config Manager
 * Centralized configuration management with validation
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface AppConfig {
  // Window settings
  window: {
    width: number;
    height: number;
    x?: number;
    y?: number;
    maximized: boolean;
  };
  
  // Security
  security: {
    autoLock: boolean;
    autoLockTimeout: number; // minutes
    rememberPassword: boolean;
  };
  
  // Network
  network: {
    connectionTimeout: number;
    retryAttempts: number;
    retryDelay: number;
  };
  
  // Terminal
  terminal: {
    fontSize: number;
    fontFamily: string;
    scrollback: number;
    cursorStyle: 'block' | 'underline' | 'bar';
  };
  
  // UI
  ui: {
    theme: string;
    language: string;
    showTabBar: boolean;
    showSidebar: boolean;
  };
  
  // Backup
  backup: {
    autoBackup: boolean;
    backupInterval: number; // hours
    lastBackup?: number;
  };
  
  // Advanced
  advanced: {
    devTools: boolean;
    hardwareAcceleration: boolean;
    gpuProcess: boolean;
  };
}

const DEFAULT_CONFIG: AppConfig = {
  window: {
    width: 1200,
    height: 800,
    maximized: false,
  },
  security: {
    autoLock: true,
    autoLockTimeout: 15,
    rememberPassword: false,
  },
  network: {
    connectionTimeout: 30000,
    retryAttempts: 3,
    retryDelay: 5000,
  },
  terminal: {
    fontSize: 14,
    fontFamily: 'monospace',
    scrollback: 3000,
    cursorStyle: 'block',
  },
  ui: {
    theme: 'dracula',
    language: 'en',
    showTabBar: true,
    showSidebar: true,
  },
  backup: {
    autoBackup: false,
    backupInterval: 24,
  },
  advanced: {
    devTools: false,
    hardwareAcceleration: true,
    gpuProcess: true,
  },
};

class ConfigManager {
  private config: AppConfig;
  private configPath: string;
  private listeners: Set<(config: AppConfig) => void> = new Set();

  constructor() {
    this.configPath = path.join(app.getPath('userData'), 'config.json');
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file
   */
  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const content = fs.readFileSync(this.configPath, 'utf-8');
        const saved = JSON.parse(content);
        // Merge with defaults (handles new config keys)
        return this.mergeConfig(DEFAULT_CONFIG, saved);
      }
    } catch (error) {
      console.error('[Config] Failed to load:', error);
    }
    return { ...DEFAULT_CONFIG };
  }

  /**
   * Merge saved config with defaults
   */
  private mergeConfig(defaults: any, saved: any): any {
    const result = { ...defaults };
    for (const key of Object.keys(saved)) {
      if (typeof saved[key] === 'object' && !Array.isArray(saved[key])) {
        result[key] = this.mergeConfig(defaults[key] || {}, saved[key]);
      } else {
        result[key] = saved[key];
      }
    }
    return result;
  }

  /**
   * Save configuration to file
   */
  save(): boolean {
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
      this.notifyListeners();
      return true;
    } catch (error) {
      console.error('[Config] Failed to save:', error);
      return false;
    }
  }

  /**
   * Get entire config
   */
  get(): AppConfig {
    return this.config;
  }

  /**
   * Get config value by path
   */
  getValue<K extends keyof AppConfig>(key: K): AppConfig[K];
  getValue(path: string): any;
  getValue(keyOrPath: string | any): any {
    if (keyOrPath in this.config) {
      return this.config[keyOrPath as keyof AppConfig];
    }
    // Support dot notation: 'window.width'
    const keys = keyOrPath.split('.');
    let value: any = this.config;
    for (const key of keys) {
      value = value?.[key];
      if (value === undefined) return undefined;
    }
    return value;
  }

  /**
   * Set config value
   */
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void;
  set(path: string, value: any): void;
  set(keyOrPath: string | any, value: any): void {
    if (typeof keyOrPath === 'object') {
      this.config = this.mergeConfig(DEFAULT_CONFIG, keyOrPath);
    } else if (keyOrPath.includes('.')) {
      const keys = keyOrPath.split('.');
      let obj: any = this.config;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = obj[keys[i]] || {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
    } else {
      this.config[keyOrPath as keyof AppConfig] = value;
    }
    this.save();
  }

  /**
   * Reset to defaults
   */
  reset(): void {
    this.config = { ...DEFAULT_CONFIG };
    this.save();
  }

  /**
   * Register change listener
   */
  onChange(callback: (config: AppConfig) => void): void {
    this.listeners.add(callback);
  }

  /**
   * Remove change listener
   */
  offChange(callback: (config: AppConfig) => void): void {
    this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.config);
    }
  }
}

export const configManager = new ConfigManager();
export default configManager;
