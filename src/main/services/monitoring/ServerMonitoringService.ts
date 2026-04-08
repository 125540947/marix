/**
 * Server Monitoring Service
 * Real-time server metrics and monitoring dashboard
 */

interface ServerMetrics {
  serverId: string;
  timestamp: number;
  cpu: { usage: number; cores: number };
  memory: { used: number; total: number; percent: number };
  disk: { used: number; total: number; percent: number };
  network: { rx: number; tx: number };
  load: number[];
  uptime: number;
  processes: number;
}

interface MonitoringConfig {
  serverId: string;
  serverName: string;
  host: string;
  interval: number; // seconds
  enabled: boolean;
}

interface AlertRule {
  id: string;
  name: string;
  metric: 'cpu' | 'memory' | 'disk' | 'load';
  threshold: number;
  condition: 'gt' | 'lt' | 'eq';
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  serverIds?: string[]; // null = all servers
}

interface Alert {
  id: string;
  ruleId: string;
  ruleName: string;
  serverId: string;
  serverName: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  timestamp: number;
  acknowledged: boolean;
}

class ServerMonitoringService {
  private configs: Map<string, MonitoringConfig> = new Map();
  private metrics: Map<string, ServerMetrics[]> = new Map();
  private alerts: Alert[] = [];
  private alertRules: Map<string, AlertRule> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private maxMetricsPerServer = 360; // Keep last 1 hour (at 10s intervals)

  // Callbacks
  private onMetricsCallbacks: ((metrics: ServerMetrics) => void)[] = [];
  private onAlertCallbacks: ((alert: Alert) => void)[] = [];

  constructor() {
    this.initDefaultAlertRules();
  }

  private initDefaultAlertRules(): void {
    const defaultRules: AlertRule[] = [
      { id: 'rule_cpu_high', name: 'High CPU Usage', metric: 'cpu', threshold: 90, condition: 'gt', severity: 'warning', enabled: true },
      { id: 'rule_cpu_critical', name: 'Critical CPU', metric: 'cpu', threshold: 95, condition: 'gt', severity: 'critical', enabled: true },
      { id: 'rule_mem_high', name: 'High Memory', metric: 'memory', threshold: 90, condition: 'gt', severity: 'warning', enabled: true },
      { id: 'rule_disk_high', name: 'Disk Full', metric: 'disk', threshold: 95, condition: 'gt', severity: 'critical', enabled: true },
      { id: 'rule_load_high', name: 'High Load', metric: 'load', threshold: 4, condition: 'gt', severity: 'warning', enabled: true },
    ];

    for (const rule of defaultRules) {
      this.alertRules.set(rule.id, rule);
    }
  }

  /**
   * Add server to monitoring
   */
  addServer(config: MonitoringConfig): void {
    this.configs.set(config.serverId, config);
    this.metrics.set(config.serverId, []);

    if (config.enabled) {
      this.startMonitoring(config.serverId);
    }

    console.log(`[Monitoring] Added: ${config.serverName}`);
  }

  /**
   * Remove server from monitoring
   */
  removeServer(serverId: string): void {
    this.stopMonitoring(serverId);
    this.configs.delete(serverId);
    this.metrics.delete(serverId);
  }

  /**
   * Start monitoring
   */
  startMonitoring(serverId: string): void {
    const config = this.configs.get(serverId);
    if (!config || !config.enabled) return;

    this.stopMonitoring(serverId);

    // Collect metrics immediately
    this.collectMetrics(serverId);

    // Then periodically
    const timer = setInterval(() => {
      this.collectMetrics(serverId);
    }, config.interval * 1000);

    this.timers.set(serverId, timer);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(serverId: string): void {
    const timer = this.timers.get(serverId);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(serverId);
    }
  }

  /**
   * Collect metrics (simulated - in production would SSH and collect)
   */
  private async collectMetrics(serverId: string): Promise<void> {
    const config = this.configs.get(serverId);
    if (!config) return;

    // Simulated metrics - in production would SSH and run: top, df, free, etc.
    const metrics: ServerMetrics = {
      serverId,
      timestamp: Date.now(),
      cpu: { usage: Math.random() * 100, cores: 4 },
      memory: { used: Math.random() * 16, total: 16, percent: Math.random() * 100 },
      disk: { used: Math.random() * 500, total: 1000, percent: Math.random() * 100 },
      network: { rx: Math.random() * 1000, tx: Math.random() * 1000 },
      load: [Math.random() * 4, Math.random() * 4, Math.random() * 4],
      uptime: Date.now() / 1000,
      processes: Math.floor(Math.random() * 500),
    };

    // Store metrics
    const serverMetrics = this.metrics.get(serverId) || [];
    serverMetrics.push(metrics);
    
    // Keep only recent metrics
    while (serverMetrics.length > this.maxMetricsPerServer) {
      serverMetrics.shift();
    }
    this.metrics.set(serverId, serverMetrics);

    // Check alert rules
    this.checkAlertRules(metrics, config);

    // Notify callbacks
    this.onMetricsCallbacks.forEach(cb => cb(metrics));
  }

  /**
   * Check alert rules against metrics
   */
  private checkAlertRules(metrics: ServerMetrics, config: MonitoringConfig): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;
      if (rule.serverIds && !rule.serverIds.includes(config.serverId)) continue;

      let value: number = 0;
      switch (rule.metric) {
        case 'cpu': value = metrics.cpu.percent; break;
        case 'memory': value = metrics.memory.percent; break;
        case 'disk': value = metrics.disk.percent; break;
        case 'load': value = metrics.load[0]; break;
      }

      let triggered = false;
      switch (rule.condition) {
        case 'gt': triggered = value > rule.threshold; break;
        case 'lt': triggered = value < rule.threshold; break;
        case 'eq': triggered = value === rule.threshold; break;
      }

      if (triggered) {
        this.triggerAlert(rule, config, value);
      }
    }
  }

  /**
   * Trigger alert
   */
  private triggerAlert(rule: AlertRule, config: MonitoringConfig, value: number): void {
    // Check if recently alerted (prevent spam)
    const recentAlert = this.alerts.find(a => 
      a.ruleId === rule.id && 
      a.serverId === config.serverId &&
      Date.now() - a.timestamp < 300000 // 5 min cooldown
    );

    if (recentAlert) return;

    const alert: Alert = {
      id: `alert_${Date.now()}`,
      ruleId: rule.id,
      ruleName: rule.name,
      serverId: config.serverId,
      serverName: config.serverName,
      message: `${rule.name}: ${value.toFixed(1)}% (threshold: ${rule.threshold}%)`,
      severity: rule.severity,
      timestamp: Date.now(),
      acknowledged: false,
    };

    this.alerts.push(alert);
    this.onAlertCallbacks.forEach(cb => cb(alert));
  }

  /**
   * Get metrics history
   */
  getMetrics(serverId: string, limit: number = 60): ServerMetrics[] {
    const serverMetrics = this.metrics.get(serverId) || [];
    return serverMetrics.slice(-limit);
  }

  /**
   * Get latest metrics
   */
  getLatestMetrics(serverId: string): ServerMetrics | null {
    const serverMetrics = this.metrics.get(serverId) || [];
    return serverMetrics[serverMetrics.length - 1] || null;
  }

  /**
   * Get all alerts
   */
  getAlerts(unacknowledgedOnly: boolean = false): Alert[] {
    if (unacknowledgedOnly) {
      return this.alerts.filter(a => !a.acknowledged);
    }
    return this.alerts;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
    }
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
  }

  /**
   * Get alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Register metrics callback
   */
  onMetrics(callback: (metrics: ServerMetrics) => void): void {
    this.onMetricsCallbacks.push(callback);
  }

  /**
   * Register alert callback
   */
  onAlert(callback: (alert: Alert) => void): void {
    this.onAlertCallbacks.push(callback);
  }

  /**
   * Get monitoring status
   */
  getStatus(): { servers: number; metricsStored: number; alerts: number } {
    let totalMetrics = 0;
    for (const m of this.metrics.values()) {
      totalMetrics += m.length;
    }
    return {
      servers: this.configs.size,
      metricsStored: totalMetrics,
      alerts: this.alerts.filter(a => !a.acknowledged).length,
    };
  }
}

export const serverMonitoringService = new ServerMonitoringService();
export default ServerMonitoringService;
