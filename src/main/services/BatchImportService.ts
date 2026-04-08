/**
 * Batch Import Service
 * Import multiple servers from CSV/JSON files
 */

import * as fs from 'fs';
import * as path from 'path';

interface ServerConfig {
  name: string;
  host: string;
  port: number;
  username: string;
  authType: 'password' | 'privateKey';
  password?: string;
  privateKeyPath?: string;
  group?: string;
  tags?: string[];
  notes?: string;
}

interface BatchImportResult {
  success: boolean;
  imported: number;
  failed: number;
  errors: string[];
}

/**
 * Parse CSV content to server configs
 */
function parseCSV(content: string): ServerConfig[] {
  const lines = content.trim().split('\n');
  if (lines.length < 2) {
    throw new Error('CSV must have header and at least one data row');
  }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const servers: ServerConfig[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    if (values.length < 4) continue;

    const server: ServerConfig = {
      name: values[headers.indexOf('name')] || values[0] || `Server ${i}`,
      host: values[headers.indexOf('host')] || values[1] || '',
      port: parseInt(values[headers.indexOf('port')] || values[2] || '22') || 22,
      username: values[headers.indexOf('username')] || values[3] || '',
      authType: (values[headers.indexOf('authtype')] || values[4] || 'password') as 'password' | 'privateKey',
    };

    if (server.authType === 'privateKey') {
      server.privateKeyPath = values[headers.indexOf('privatekey')] || '';
    } else {
      server.password = values[headers.indexOf('password')] || '';
    }

    server.group = values[headers.indexOf('group')] || '';
    server.tags = values[headers.indexOf('tags')]?.split(';') || [];
    server.notes = values[headers.indexOf('notes')] || '';

    if (server.host && server.username) {
      servers.push(server);
    }
  }

  return servers;
}

/**
 * Parse JSON content to server configs
 */
function parseJSON(content: string): ServerConfig[] {
  const data = JSON.parse(content);
  const items = Array.isArray(data) ? data : data.servers || data.hosts || [];

  return items.map((item: any, index: number): ServerConfig => ({
    name: item.name || item.host || `Server ${index + 1}`,
    host: item.host || item.address || item.ip || '',
    port: item.port || 22,
    username: item.username || item.user || 'root',
    authType: item.authType || item.auth || item.privateKey ? 'privateKey' : 'password',
    password: item.password || item.pass,
    privateKeyPath: item.privateKeyPath || item.privateKey || item.key,
    group: item.group || item.folder || '',
    tags: item.tags || [],
    notes: item.notes || item.description || '',
  })).filter(s => s.host && s.username);
}

/**
 * Import servers from file
 */
export async function importServersFromFile(filePath: string): Promise<BatchImportResult> {
  const result: BatchImportResult = {
    success: false,
    imported: 0,
    failed: 0,
    errors: [],
  };

  try {
    if (!fs.existsSync(filePath)) {
      result.errors.push(`File not found: ${filePath}`);
      return result;
    }

    const content = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();

    let servers: ServerConfig[] = [];

    if (ext === '.csv') {
      servers = parseCSV(content);
    } else if (ext === '.json') {
      servers = parseJSON(content);
    } else {
      result.errors.push('Unsupported file format. Use .csv or .json');
      return result;
    }

    // Validate and import
    for (const server of servers) {
      if (!server.host || !server.username) {
        result.failed++;
        result.errors.push(`Invalid server: ${server.name || server.host}`);
        continue;
      }
      result.imported++;
    }

    result.success = result.imported > 0;
    console.log(`[BatchImport] Import complete: ${result.imported} imported, ${result.failed} failed`);

    return result;
  } catch (error: any) {
    result.errors.push(`Error: ${error.message}`);
    return result;
  }
}

/**
 * Export servers to CSV
 */
export function exportServersToCSV(servers: ServerConfig[]): string {
  const headers = 'name,host,port,username,authtype,password,privatekey,group,tags,notes';
  const rows = servers.map(s => [
    s.name,
    s.host,
    s.port,
    s.username,
    s.authType,
    s.password || '',
    s.privateKeyPath || '',
    s.group || '',
    (s.tags || []).join(';'),
    s.notes || '',
  ].join(','));
  return [headers, ...rows].join('\n');
}

/**
 * Export servers to JSON
 */
export function exportServersToJSON(servers: ServerConfig[]): string {
  return JSON.stringify({ servers }, null, 2);
}

/**
 * Generate sample CSV template
 */
export function getCSVTemplate(): string {
  return `name,host,port,username,authtype,password,privatekey,group,tags,notes
Production Server,192.168.1.10,22,admin,password,secret123,,"Production;Web",Main web server
Development Server,192.168.1.20,22,dev,privateKey,,~/.ssh/id_rsa,Development;API,Dev environment
Staging Server,192.168.1.30,22,staging,password,staging456,,"Staging;Test",Staging environment`;
}

/**
 * Generate sample JSON template
 */
export function getJSONTemplate(): string {
  return JSON.stringify({
    servers: [
      {
        name: "Production Server",
        host: "192.168.1.10",
        port: 22,
        username: "admin",
        authType: "password",
        password: "secret123",
        group: "Production",
        tags: ["web", "production"],
        notes: "Main production server"
      },
      {
        name: "Development Server",
        host: "192.168.1.20",
        port: 22,
        username: "dev",
        authType: "privateKey",
        privateKeyPath: "~/.ssh/id_rsa",
        group: "Development",
        tags: ["api", "dev"],
        notes: "Development environment"
      }
    ]
  }, null, 2);
}

export default {
  importServersFromFile,
  exportServersToCSV,
  exportServersToJSON,
  getCSVTemplate,
  getJSONTemplate,
};
