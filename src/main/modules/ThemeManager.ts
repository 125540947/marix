/**
 * Theme Manager
 * Centralized theme loading and caching
 */

import * as fs from 'fs';
import * as path from 'path';

interface ThemeColors {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

interface Theme {
  name: string;
  colors: ThemeColors;
  type: 'dark' | 'light';
}

// In-memory cache
const themeCache = new Map<string, Theme>();
let cacheEnabled = true;

/**
 * Load theme from file
 */
export function loadTheme(themeName: string): Theme | null {
  // Check cache first
  if (cacheEnabled && themeCache.has(themeName)) {
    return themeCache.get(themeName)!;
  }

  const themePath = path.join(__dirname, '../../theme', `${themeName}.json`);
  
  if (!fs.existsSync(themePath)) {
    console.warn(`[Theme] Not found: ${themeName}`);
    return null;
  }

  try {
    const content = fs.readFileSync(themePath, 'utf-8');
    const themeData = JSON.parse(content);
    
    // Convert VSCode format to xterm.js format
    const colors = themeData.workbench?.colorCustomizations || themeData;
    const theme: Theme = {
      name: themeName,
      colors: convertColors(colors),
      type: detectThemeType(colors),
    };

    // Cache it
    if (cacheEnabled) {
      themeCache.set(themeName, theme);
    }

    return theme;
  } catch (error) {
    console.error(`[Theme] Failed to load ${themeName}:`, error);
    return null;
  }
}

/**
 * Convert VSCode colors to xterm.js format
 */
function convertColors(colors: any): ThemeColors {
  return {
    background: colors['terminal.background'] || '#1a1d2e',
    foreground: colors['terminal.foreground'] || '#f8f8f2',
    cursor: colors['terminalCursor.foreground'] || colors['terminal.foreground'] || '#f8f8f2',
    cursorAccent: colors['terminalCursor.background'] || colors['terminal.background'] || '#000000',
    selectionBackground: colors['terminal.selectionBackground'] || '#44475a',
    black: colors['terminal.ansiBlack'] || '#000000',
    red: colors['terminal.ansiRed'] || '#ff5555',
    green: colors['terminal.ansiGreen'] || '#50fa7b',
    yellow: colors['terminal.ansiYellow'] || '#f1fa8c',
    blue: colors['terminal.ansiBlue'] || '#bd93f9',
    magenta: colors['terminal.ansiMagenta'] || '#ff79c6',
    cyan: colors['terminal.ansiCyan'] || '#8be9fd',
    white: colors['terminal.ansiWhite'] || '#f8f8f2',
    brightBlack: colors['terminal.ansiBrightBlack'] || '#6272a4',
    brightRed: colors['terminal.ansiBrightRed'] || '#ff6e67',
    brightGreen: colors['terminal.ansiBrightGreen'] || '#5af78e',
    brightYellow: colors['terminal.ansiBrightYellow'] || '#f4f99d',
    brightBlue: colors['terminal.ansiBrightBlue'] || '#caa9fa',
    brightMagenta: colors['terminal.ansiBrightMagenta'] || '#ff79c6',
    brightCyan: colors['terminal.ansiBrightCyan'] || '#9aedfe',
    brightWhite: colors['terminal.ansiBrightWhite'] || '#e6e6e6',
  };
}

/**
 * Detect theme type (dark/light)
 */
function detectThemeType(colors: any): 'dark' | 'light' {
  const bg = colors['terminal.background'] || '';
  // Simple heuristic: dark backgrounds are typically dark
  return bg.toLowerCase().startsWith('#') && parseInt(bg.slice(1), 16) > 0x888888 ? 'light' : 'dark';
}

/**
 * Get list of available themes
 */
export function getAvailableThemes(): string[] {
  const themeDir = path.join(__dirname, '../../theme');
  
  if (!fs.existsSync(themeDir)) {
    return [];
  }

  return fs.readdirSync(themeDir)
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''));
}

/**
 * Enable/disable cache
 */
export function setCacheEnabled(enabled: boolean): void {
  cacheEnabled = enabled;
  if (!enabled) {
    themeCache.clear();
  }
}

/**
 * Clear theme cache
 */
export function clearCache(): void {
  themeCache.clear();
}

/**
 * Get cache stats
 */
export function getCacheStats(): { size: number; enabled: boolean } {
  return {
    size: themeCache.size,
    enabled: cacheEnabled,
  };
}

export default {
  loadTheme,
  getAvailableThemes,
  setCacheEnabled,
  clearCache,
  getCacheStats,
};
