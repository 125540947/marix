/**
 * Audit Log Service
import * as crypto from "crypto";
 * Track all SSH operations and user activities
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

type AuditAction = 
  | 'ssh_connect' | 'ssh_disconnect' | 'ssh_command'
  | 'file_upload' | 'file_download' | 'file_delete'
  | 'key_create' | 'key_use' | 'key_delete'
  | 'backup_create' | 'backup_restore' | 'backup_delete'
  | 'server_add' | 'server_edit' | 'server_delete'
  | 'settings_change' | 'login' | 'logout';

interface AuditEntry {
  id: string;
  timestamp: number;
  action: AuditAction;
  userId?: string;
  serverId?: string;
  serverName?: string;
  details: string;
  metadata?: Record<string, any>;
  success: boolean;
  error?: string;
  ip?: string;
}

interface AuditFilters {
  startDate?: number;
  endDate?: number;
  action?: AuditAction[];
  serverId?: string;
  userId?: string;
  success?: boolean;
}

const LOG_DIR = 'audit_logs';
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10MB

class AuditLogService {
  private logDir: string;
  private currentLogFile: string;
  private logStream: fs.WriteStream | null = null;

  constructor() {
    this.logDir = path.join(app.getPath('userData'), LOG_DIR);
    this.currentLogFile = path.join(this.logDir, `audit_${this.getDateString()}.jsonl`);
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  private getDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Log an audit event
   */
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
    const auditEntry: AuditEntry = {
      ...entry,
      id: `audit_${Date.now()}_${randomBytes(8).toString('hex')}`,
      timestamp: Date.now(),
    };

    // Write to current log file
    this.writeToLog(auditEntry);

    console.log(`[Audit] ${auditEntry.action}: ${auditEntry.details} (${auditEntry.success ? 'success' : 'failed'})`);
    return auditEntry;
  }

  /**
   * Write entry to log file
   */
  private writeToLog(entry: AuditEntry): void {
    const today = this.getDateString();
    const logFile = path.join(this.logDir, `audit_${today}.jsonl`);
    
    if (logFile !== this.currentLogFile) {
      this.currentLogFile = logFile;
    }

    const line = JSON.stringify(entry) + '\n';
    
    try {
      fs.appendFileSync(this.currentLogFile, line, 'utf8');
      
      // Check file size and rotate if needed
      const stats = fs.statSync(this.currentLogFile);
      if (stats.size > MAX_LOG_SIZE) {
        this.rotateLog();
      }
    } catch (error) {
      console.error('[Audit] Write error:', error);
    }
  }

  /**
   * Rotate log file
   */
  private rotateLog(): void {
    const timestamp = Date.now();
    const rotatedFile = this.currentLogFile.replace('.jsonl', `_${timestamp}.jsonl`);
    fs.renameSync(this.currentLogFile, rotatedFile);
    console.log(`[Audit] Rotated: ${rotatedFile}`);
  }

  /**
   * Query audit logs
   */
  query(filters: AuditFilters = {}, limit: number = 100): AuditEntry[] {
    const entries: AuditEntry[] = [];
    const files = this.getLogFiles();

    for (const file of files) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l);

        for (const line of lines) {
          const entry: AuditEntry = JSON.parse(line);
          
          if (this.matchesFilters(entry, filters)) {
            entries.push(entry);
          }
        }
      } catch (error) {
        console.error(`[Audit] Error reading ${file}:`, error);
      }
    }

    // Sort by timestamp descending
    entries.sort((a, b) => b.timestamp - a.timestamp);
    
    return entries.slice(0, limit);
  }

  /**
   * Check if entry matches filters
   */
  private matchesFilters(entry: AuditEntry, filters: AuditFilters): boolean {
    if (filters.startDate && entry.timestamp < filters.startDate) return false;
    if (filters.endDate && entry.timestamp > filters.endDate) return false;
    if (filters.action && !filters.action.includes(entry.action)) return false;
    if (filters.serverId && entry.serverId !== filters.serverId) return false;
    if (filters.userId && entry.userId !== filters.userId) return false;
    if (filters.success !== undefined && entry.success !== filters.success) return false;
    
    return true;
  }

  /**
   * Get all log files
   */
  private getLogFiles(): string[] {
    if (!fs.existsSync(this.logDir)) return [];
    
    return fs.readdirSync(this.logDir)
      .filter(f => f.startsWith('audit_') && f.endsWith('.jsonl'))
      .map(f => path.join(this.logDir, f))
      .sort();
  }

  /**
   * Get statistics
   */
  getStats(days: number = 7): { total: number; byAction: Record<string, number>; byDay: Record<string, number> } {
    const startDate = Date.now() - (days * 24 * 60 * 60 * 1000);
    const entries = this.query({ startDate }, 10000);
    
    const stats = {
      total: entries.length,
      byAction: {} as Record<string, number>,
      byDay: {} as Record<string, number>,
    };

    for (const entry of entries) {
      // By action
      stats.byAction[entry.action] = (stats.byAction[entry.action] || 0) + 1;
      
      // By day
      const day = new Date(entry.timestamp).toISOString().split('T')[0];
      stats.byDay[day] = (stats.byDay[day] || 0) + 1;
    }

    return stats;
  }

  /**
   * Export logs
   */
  export(filters: AuditFilters = {}): string {
    const entries = this.query(filters, 10000);
    return JSON.stringify(entries, null, 2);
  }

  /**
   * Clean old logs
   */
  cleanOldLogs(days: number = 30): number {
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    let deleted = 0;
    
    const files = this.getLogFiles();
    for (const file of files) {
      const stats = fs.statSync(file);
      if (stats.mtimeMs < cutoff) {
        fs.unlinkSync(file);
        deleted++;
      }
    }
    
    console.log(`[Audit] Cleaned ${deleted} old log files`);
    return deleted;
  }
}

export const auditLogService = new AuditLogService();
export default AuditLogService;