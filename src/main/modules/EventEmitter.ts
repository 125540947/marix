/**
 * Event Emitter
 * Simple event emitter for inter-module communication
 */

type EventHandler = (...args: any[]) => void;

interface EventMap {
  [event: string]: EventHandler[];
}

class EventEmitter {
  private events: EventMap = {};
  private onceHandlers: Map<string, EventHandler> = new Map();

  /**
   * Register event handler
   */
  on(event: string, handler: EventHandler): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(handler);
  }

  /**
   * Register one-time handler
   */
  once(event: string, handler: EventHandler): void {
    this.onceHandlers.set(event, handler);
  }

  /**
   * Emit event
   */
  emit(event: string, ...args: any[]): void {
    // Call regular handlers
    const handlers = this.events[event] || [];
    for (const handler of handlers) {
      try {
        handler(...args);
      } catch (error) {
        console.error(`[EventEmitter] Handler error for "${event}":`, error);
      }
    }

    // Call once handler
    const onceHandler = this.onceHandlers.get(event);
    if (onceHandler) {
      try {
        onceHandler(...args);
      } catch (error) {
        console.error(`[EventEmitter] Once handler error for "${event}":`, error);
      }
      this.onceHandlers.delete(event);
    }
  }

  /**
   * Remove event handler
   */
  off(event: string, handler?: EventHandler): void {
    if (!handler) {
      // Remove all handlers for event
      delete this.events[event];
    } else {
      // Remove specific handler
      const handlers = this.events[event] || [];
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  /**
   * Remove all handlers
   */
  removeAllListeners(event?: string): void {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }

  /**
   * Get listener count
   */
  listenerCount(event: string): number {
    return (this.events[event] || []).length;
  }

  /**
   * Get all events
   */
  eventNames(): string[] {
    return Object.keys(this.events);
  }
}

// Global event bus
export const eventBus = new EventEmitter();

// Application events
export const AppEvents = {
  READY: 'app:ready',
  QUIT: 'app:quit',
  WINDOW_READY: 'window:ready',
  WINDOW_CLOSE: 'window:close',
} as const;

export const ServerEvents = {
  CONNECTED: 'server:connected',
  DISCONNECTED: 'server:disconnected',
  ERROR: 'server:error',
} as const;

export const BackupEvents = {
  STARTED: 'backup:started',
  COMPLETED: 'backup:completed',
  FAILED: 'backup:failed',
} as const;

export default EventEmitter;
