/**
 * Load Balancer Service
 * Simple round-robin and weighted load balancing for SSH connections
 */

interface ServerEndpoint {
  id: string;
  host: string;
  port: number;
  weight: number;
  active: boolean;
  connections: number;
  lastHealthCheck?: number;
}

interface LoadBalancerConfig {
  algorithm: 'round-robin' | 'weighted' | 'least-connections';
  healthCheckInterval: number;
  maxRetries: number;
}

class LoadBalancerService {
  private endpoints: Map<string, ServerEndpoint> = new Map();
  private config: LoadBalancerConfig = {
    algorithm: 'round-robin',
    healthCheckInterval: 30000,
    maxRetries: 3,
  };
  private roundRobinIndex: number = 0;

  /**
   * Add server endpoint
   */
  addEndpoint(id: string, host: string, port: number, weight: number = 1): void {
    const endpoint: ServerEndpoint = {
      id,
      host,
      port,
      weight,
      active: true,
      connections: 0,
    };
    
    this.endpoints.set(id, endpoint);
    console.log(`[LoadBalancer] Added: ${host}:${port} (weight: ${weight})`);
  }

  /**
   * Remove endpoint
   */
  removeEndpoint(id: string): boolean {
    const removed = this.endpoints.delete(id);
    if (removed) {
      console.log(`[LoadBalancer] Removed: ${id}`);
    }
    return removed;
  }

  /**
   * Get next server based on algorithm
   */
  getNextServer(): ServerEndpoint | null {
    const activeEndpoints = Array.from(this.endpoints.values()).filter(e => e.active);
    
    if (activeEndpoints.length === 0) {
      console.warn('[LoadBalancer] No active endpoints');
      return null;
    }

    let selected: ServerEndpoint;

    switch (this.config.algorithm) {
      case 'round-robin':
        selected = activeEndpoints[this.roundRobinIndex % activeEndpoints.length];
        this.roundRobinIndex++;
        break;
        
      case 'weighted':
        selected = this.weightedSelect(activeEndpoints);
        break;
        
      case 'least-connections':
        selected = activeEndpoints.sort((a, b) => a.connections - b.connections)[0];
        break;
        
      default:
        selected = activeEndpoints[0];
    }

    selected.connections++;
    console.log(`[LoadBalancer] Selected: ${selected.host}:${selected.port} (${selected.connections} active)`);
    return selected;
  }

  /**
   * Weighted server selection
   */
  private weightedSelect(endpoints: ServerEndpoint[]): ServerEndpoint {
    const totalWeight = endpoints.reduce((sum, e) => sum + e.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const endpoint of endpoints) {
      random -= endpoint.weight;
      if (random <= 0) {
        return endpoint;
      }
    }
    
    return endpoints[0];
  }

  /**
   * Release connection (decrement counter)
   */
  releaseConnection(endpointId: string): void {
    const endpoint = this.endpoints.get(endpointId);
    if (endpoint && endpoint.connections > 0) {
      endpoint.connections--;
    }
  }

  /**
   * Mark endpoint as unhealthy
   */
  markUnhealthy(id: string): void {
    const endpoint = this.endpoints.get(id);
    if (endpoint) {
      endpoint.active = false;
      console.log(`[LoadBalancer] Marked unhealthy: ${endpoint.host}:${endpoint.port}`);
    }
  }

  /**
   * Mark endpoint as healthy
   */
  markHealthy(id: string): void {
    const endpoint = this.endpoints.get(id);
    if (endpoint) {
      endpoint.active = true;
      endpoint.lastHealthCheck = Date.now();
    }
  }

  /**
   * Get all endpoints
   */
  getEndpoints(): ServerEndpoint[] {
    return Array.from(this.endpoints.values());
  }

  /**
   * Get active endpoints
   */
  getActiveEndpoints(): ServerEndpoint[] {
    return Array.from(this.endpoints.values()).filter(e => e.active);
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LoadBalancerConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get statistics
   */
  getStats(): { total: number; active: number; totalConnections: number } {
    const endpoints = Array.from(this.endpoints.values());
    return {
      total: endpoints.length,
      active: endpoints.filter(e => e.active).length,
      totalConnections: endpoints.reduce((sum, e) => sum + e.connections, 0),
    };
  }
}

export const loadBalancerService = new LoadBalancerService();
export default LoadBalancerService;
