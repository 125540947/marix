/**
 * Service Locator
 * Central registry for all services
 */

import { SSHConnectionManager } from '../services/SSHConnectionManager';
import { SFTPManager } from '../services/SFTPManager';
import { FTPManager } from '../services/FTPManager';
import { RDPManager } from '../services/RDPManager';
import { WSSManager } from '../services/WSSManager';
import { ServerStore } from '../services/ServerStore';
import { BackupService } from '../services/BackupService';
import { GitHubAuthService } from '../services/GitHubAuthService';
import { getGoogleDriveService } from '../services/GoogleDriveService';
import { LANSharingService } from '../services/LANSharingService';

// Core services
const services = {
  // Connection managers
  ssh: new SSHConnectionManager(),
  sftp: new SFTPManager(),
  ftp: new FTPManager(),
  rdp: new RDPManager(),
  wss: new WSSManager(),
  
  // Storage
  serverStore: new ServerStore(),
  
  // Backup & Cloud
  backup: new BackupService(),
  githubAuth: new GitHubAuthService(),
  googleDrive: getGoogleDriveService(),
  lanSharing: new LANSharingService(),
};

/**
 * Get a service by name
 */
export function getService<K extends keyof typeof services>(name: K): typeof services[K] {
  return services[name];
}

/**
 * Get all service names
 */
export function getServiceNames(): (keyof typeof services)[] {
  return Object.keys(services) as (keyof typeof services)[];
}

/**
 * Initialize all services
 */
export function initializeServices(): void {
  console.log('[ServiceLocator] Initializing services...');
  for (const [name, service] of Object.entries(services)) {
    console.log(`[ServiceLocator] Registered: ${name}`);
  }
}

/**
 * Shutdown all services
 */
export function shutdownServices(): void {
  console.log('[ServiceLocator] Shutting down services...');
  // Add cleanup logic here if needed
}

export default {
  getService,
  getServiceNames,
  initializeServices,
  shutdownServices,
};
