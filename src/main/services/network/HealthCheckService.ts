/**
 * Health Check Service
 * Monitor server health with configurable checks
 */

import * as net from 'net';

type HealthCheckType = 'tcp' | 'http' | 'https' | 'ssh' | 'ping';

interface HealthCheckConfig {
  serverId: string;
  serverName: string;
  host: string;
  port?: number;
  url?: string;
  type: HealthCheckType;
  interval: number; // ms
  timeout: number; // ms
  enabled: boolean;
}

interface HealthStatus {
  serverId: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  lastCheck: number;
  responseTime?: number;
  consecutiveFailures: number;
  lastSuccess?: number;
  lastFailure?: number;
  error?: string;
}

type HealthCheckCallback = (status: HealthStatus) => void;

class HealthCheckService {
  private checks: Map<string, HealthCheckConfig> = new Map();
  private statuses: Map<string, HealthStatus> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private callbacks: HealthCheckCallback[] = [];

  /**
   * Add health check
   */
  addCheck(config: HealthCheckConfig): void {
    this.checks.set(config.serverId, config);
    this.statuses.set(config.serverId, {
      serverId: config.serverId,
      status: 'healthy',
      lastCheck: 0,
      consecutiveFailures: 0,
    });

    if (config.enabled) {
      this.startCheck(config.serverId);
    }

    console.log(`[HealthCheck] Added: ${config.serverName} (${config.type})`);
  }

  /**
   * Remove health check
   */
  removeCheck(serverId: string): boolean {
    this.stopCheck(serverId);
    this.checks.delete(serverId);
    this.statuses.delete(serverId);
    return true;
  }

  /**
   * Start health check timer
   */
  startCheck(serverId: string): void {
    const config = this.checks.get(serverId);
    if (!config) return;

    // Stop existing timer
    this.stopCheck(serverId);

    // Run immediately
    this.runCheck(serverId);

    // Set interval
    const timer = setInterval(() => {
      this.runCheck(serverId);
    }, config.interval);

    this.timers.set(serverId, timer);
  }

  /**
   * Stop health check
   */
  stopCheck(serverId: string): void {
    const timer = this.timers.get(serverId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(serverId);
    }
  }

  /**
   * Run single health check
   */
  private async runCheck(serverId: string): Promise<void> {
    const config = this.checks.get(serverId);
    if (!config || !config.enabled) return;

    const startTime = Date.now();
    let success = false;
    let error: string | undefined;
    let responseTime: number | undefined;

    try {
      switch (config.type) {
        case 'tcp':
        case 'ssh':
          success = await this.tcpCheck(config.host, config.port || 22, config.timeout);
          break;
        case 'http':
        case 'https':
          success = await this.httpCheck(config.url || `http://${config.host}`, config.timeout);
          break;
        case 'ping':
          success = await this.pingCheck(config.host, config.timeout);
          break;
      }
      responseTime = Date.now() - startTime;
    } catch (e: any) {
      error = e.message;
    }

    // Update status
    const status = this.statuses.get(serverId)!;
    status.lastCheck = Date.now();
    status.responseTime = responseTime;

    if (success) {
      status.status = status.consecutiveFailures >= 3 ? 'degraded' : 'healthy';
      status.consecutiveFailures = 0;
      status.lastSuccess = Date.now();
      status.error = undefined;
    } else {
      status.consecutiveFailures++;
      status.lastFailure = Date.now();
      status.error = error;
      status.status = status.consecutiveFailures >= 3 ? 'unhealthy' : 'degraded';
    }

    // Notify callbacks
    this.notifyCallbacks(status);
  }

  /**
   * TCP health check
   */
  private tcpCheck(host: string, port: number, timeout: number): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(timeout);

      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });

      socket.on('timeout', () => {
        socket.destroy();
        resolve(false);
      });

      socket.on('error', () => {
        socket.destroy();
        resolve(false);
      });

      socket.connect(port, host);
    });
  }

  /**
   * HTTP health check
   */
  private httpCheck(url: string, timeout: number): Promise<boolean> {
    return fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(timeout) })
      .then(res => res.ok)
      .catch(() => false);
  }

  /**
   * Ping health check
   */
  private pingCheck(host: string, timeout: number): Promise<boolean> {
    // Simplified ping - in production use ping command
    return this.tcpCheck(host, 80, timeout);
  }

  /**
   * Register status callback
   */
  onStatusChange(callback: HealthCheckCallback): void {
    this.callbacks.push(callback);
  }

  /**
   * Notify all callbacks
   */
  private notifyCallbacks(status: HealthStatus): void {
    for (const callback of this.callbacks) {
      callback(status);
    }
  }

  /**
   * Get status for server
   */
  getStatus(serverId: string): HealthStatus | null {
    return this.statuses.get(serverId) || null;
  }

  /**
   * Get all statuses
   */
  getAllStatuses(): HealthStatus[] {
    return Array.from(this.statuses.values());
  }

  /**
   * Get check configuration
   */
  getCheck(serverId: string): HealthCheckConfig | null {
    return this.checks.get(serverId) || null;
  }

  /**
   * Get all checks
   */
  getAllChecks(): HealthCheckConfig[] {
    return Array.from(this.checks.values());
  }

  /**
   * Update check configuration
   */
  updateCheck(serverId: string, updates: Partial<HealthCheckConfig>): void {
    const config = this.checks.get(serverId);
    if (config) {
      const updated = { ...config, ...updates };
      this.checks.set(serverId, updated);
      
      if (updated.enabled && !config.enabled) {
        this.startCheck(serverId);
      } else if (!updated.enabled && config.enabled) {
        this.stopCheck(serverId);
      }
    }
  }

  /**
   * Stop all checks
   */
  stopAll(): void {
    for (const serverId of this.timers.keys()) {
      this.stopCheck(serverId);
    }
  }
}

export const healthCheckService = new HealthCheckService();
export default HealthCheckService;
