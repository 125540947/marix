/**
 * SSH Tunnel Manager Service
 * Graphical management of SSH port forwarding tunnels
 */

import * as net from 'net';

interface TunnelConfig {
  id: string;
  name: string;
  localPort: number;
  remoteHost: string;
  remotePort: number;
  serverId: string; // Reference to SSH server
  autoReconnect: boolean;
  active: boolean;
}

interface TunnelStatus {
  id: string;
  active: boolean;
  bytesIn: number;
  bytesOut: number;
  connectedAt?: number;
  error?: string;
}

class SSHTunnelManager {
  private tunnels: Map<string, TunnelConfig> = new Map();
  private activeConnections: Map<string, net.Server> = new Map();
  private tunnelStatuses: Map<string, TunnelStatus> = new Map();

  /**
   * Create a new tunnel configuration
   */
  createTunnel(config: Omit<TunnelConfig, 'id' | 'active'>): TunnelConfig {
    const id = `tunnel_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const tunnel: TunnelConfig = {
      ...config,
      id,
      active: false,
    };

    this.tunnels.set(id, tunnel);
    this.tunnelStatuses.set(id, {
      id,
      active: false,
      bytesIn: 0,
      bytesOut: 0,
    });

    console.log(`[Tunnel] Created: ${tunnel.name} (${tunnel.localPort} -> ${tunnel.remoteHost}:${tunnel.remotePort})`);
    return tunnel;
  }

  /**
   * Update tunnel configuration
   */
  updateTunnel(id: string, updates: Partial<TunnelConfig>): TunnelConfig | null {
    const tunnel = this.tunnels.get(id);
    if (!tunnel) return null;

    const updated = { ...tunnel, ...updates };
    this.tunnels.set(id, updated);
    return updated;
  }

  /**
   * Delete tunnel configuration
   */
  deleteTunnel(id: string): boolean {
    // Stop if active
    this.stopTunnel(id);

    const deleted = this.tunnels.delete(id);
    this.tunnelStatuses.delete(id);

    if (deleted) {
      console.log(`[Tunnel] Deleted: ${id}`);
    }
    return deleted;
  }

  /**
   * Start a tunnel
   */
  startTunnel(id: string): { success: boolean; error?: string } {
    const tunnel = this.tunnels.get(id);
    if (!tunnel) {
      return { success: false, error: 'Tunnel not found' };
    }

    if (tunnel.active) {
      return { success: false, error: 'Tunnel already active' };
    }

    try {
      // Create local TCP server
      const server = net.createServer((socket) => {
        // Handle connection - in real implementation, would connect to SSH tunnel
        console.log(`[Tunnel] Client connected to localhost:${tunnel.localPort}`);

        socket.on('error', (err) => {
          console.error(`[Tunnel] Socket error:`, err.message);
          this.updateStatus(id, { error: err.message });
        });

        socket.on('close', () => {
          console.log(`[Tunnel] Client disconnected`);
        });

        // Track data
        socket.on('data', (data) => {
          this.updateStatus(id, { bytesIn: (this.tunnelStatuses.get(id)?.bytesIn || 0) + data.length });
        });
      });

      server.listen(tunnel.localPort, '127.0.0.1', () => {
        console.log(`[Tunnel] Started: ${tunnel.name} on localhost:${tunnel.localPort}`);
        tunnel.active = true;
        this.updateStatus(id, {
          active: true,
          connectedAt: Date.now(),
          error: undefined,
        });
      });

      server.on('error', (err) => {
        console.error(`[Tunnel] Server error:`, err.message);
        tunnel.active = false;
        this.updateStatus(id, {
          active: false,
          error: err.message,
        });
      });

      this.activeConnections.set(id, server);
      return { success: true };

    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Stop a tunnel
   */
  stopTunnel(id: string): boolean {
    const tunnel = this.tunnels.get(id);
    const server = this.activeConnections.get(id);

    if (server) {
      server.close();
      this.activeConnections.delete(id);
    }

    if (tunnel) {
      tunnel.active = false;
    }

    this.updateStatus(id, { active: false });
    console.log(`[Tunnel] Stopped: ${id}`);
    return true;
  }

  /**
   * Get all tunnels
   */
  getTunnels(): TunnelConfig[] {
    return Array.from(this.tunnels.values());
  }

  /**
   * Get tunnel by ID
   */
  getTunnel(id: string): TunnelConfig | null {
    return this.tunnels.get(id) || null;
  }

  /**
   * Get tunnel status
   */
  getTunnelStatus(id: string): TunnelStatus | null {
    return this.tunnelStatuses.get(id) || null;
  }

  /**
   * Get all statuses
   */
  getAllStatuses(): TunnelStatus[] {
    return Array.from(this.tunnelStatuses.values());
  }

  /**
   * Update tunnel status
   */
  private updateStatus(id: string, updates: Partial<TunnelStatus>): void {
    const current = this.tunnelStatuses.get(id);
    if (current) {
      this.tunnelStatuses.set(id, { ...current, ...updates });
    }
  }

  /**
   * Stop all tunnels
   */
  stopAllTunnels(): void {
    for (const id of this.tunnels.keys()) {
      this.stopTunnel(id);
    }
  }

  /**
   * Check if port is available
   */
  isPortAvailable(port: number): boolean {
    return !Array.from(this.tunnels.values()).some(t => t.localPort === port && t.active);
  }

  /**
   * Get next available port
   */
  getNextAvailablePort(startPort: number = 10000): number {
    let port = startPort;
    while (!this.isPortAvailable(port) && port < 65535) {
      port++;
    }
    return port;
  }
}

export const sshTunnelManager = new SSHTunnelManager();
export default SSHTunnelManager;
