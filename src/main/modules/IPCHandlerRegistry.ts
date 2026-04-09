/**
 * IPC Handler Registry
 * Central registry for all IPC handlers
 */

import { ipcMain } from 'electron';

// Registry of registered handlers
const handlers = new Map<string, Function>();

/**
 * Register an IPC handler
 */
export function registerHandler(channel: string, handler: Function): void {
  if (handlers.has(channel)) {
    console.warn(`[IPC] Handler ${channel} already registered`);
    return;
  }
  
  handlers.set(channel, handler);
  console.log(`[IPC] Registered: ${channel}`);
}

/**
 * Register multiple handlers at once
 */
export function registerHandlers(handlers: Record<string, Function>): void {
  for (const [channel, handler] of Object.entries(handlers)) {
    registerHandler(channel, handler);
  }
}

/**
 * Get all registered channels
 */
export function getRegisteredChannels(): string[] {
  return Array.from(handlers.keys());
}

/**
 * Unregister a handler
 */
export function unregisterHandler(channel: string): boolean {
  try {
    ipcMain.removeHandler(channel);
    handlers.delete(channel);
    return true;
  } catch (error) {
    console.error(`[IPC] Failed to unregister ${channel}:`, error);
    return false;
  }
}

/**
 * Clear all handlers
 */
export function clearAllHandlers(): void {
  for (const channel of handlers.keys()) {
    unregisterHandler(channel);
  }
  console.log('[IPC] Cleared all handlers');
}

export default {
  registerHandler,
  registerHandlers,
  getRegisteredChannels,
  unregisterHandler,
  clearAllHandlers,
};
