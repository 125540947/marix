/**
 * Terminal Recording Service
 * Record and replay terminal sessions
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface RecordingSession {
  id: string;
  startTime: number;
  endTime?: number;
  serverName: string;
  serverHost: string;
  events: RecordingEvent[];
  status: 'recording' | 'paused' | 'stopped';
}

interface RecordingEvent {
  timestamp: number;
  type: 'input' | 'output' | 'resize' | 'title';
  data: string;
  cols?: number;
  rows?: number;
}

interface ReplayOptions {
  speed: number; // 1 = normal, 2 = 2x, etc.
  loop: boolean;
}

class TerminalRecordingService {
  private currentRecording: RecordingSession | null = null;
  private recordingsDir: string;
  private isRecording: boolean = false;
  private eventBuffer: RecordingEvent[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.recordingsDir = path.join(app.getPath('userData'), 'recordings');
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.recordingsDir)) {
      fs.mkdirSync(this.recordingsDir, { recursive: true });
    }
  }

  /**
   * Start a new recording session
   */
  startRecording(serverName: string, serverHost: string): string {
    if (this.isRecording) {
      console.warn('[Recording] Already recording');
      return this.currentRecording!.id;
    }

    const sessionId = `rec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentRecording = {
      id: sessionId,
      startTime: Date.now(),
      serverName,
      serverHost,
      events: [],
      status: 'recording',
    };

    this.isRecording = true;
    this.eventBuffer = [];

    // Periodic flush to disk
    this.flushInterval = setInterval(() => {
      this.flushToDisk();
    }, 5000);

    console.log(`[Recording] Started: ${sessionId} for ${serverName}@${serverHost}`);
    return sessionId;
  }

  /**
   * Record an event
   */
  recordEvent(type: RecordingEvent['type'], data: string, meta?: { cols?: number; rows?: number }): void {
    if (!this.isRecording || !this.currentRecording) return;

    const event: RecordingEvent = {
      timestamp: Date.now() - this.currentRecording.startTime,
      type,
      data,
      ...meta,
    };

    this.eventBuffer.push(event);
    this.currentRecording.events.push(event);

    // Keep buffer size manageable
    if (this.eventBuffer.length > 1000) {
      this.flushToDisk();
    }
  }

  /**
   * Pause recording
   */
  pauseRecording(): void {
    if (this.currentRecording) {
      this.currentRecording.status = 'paused';
      console.log(`[Recording] Paused: ${this.currentRecording.id}`);
    }
  }

  /**
   * Resume recording
   */
  resumeRecording(): void {
    if (this.currentRecording) {
      this.currentRecording.status = 'recording';
      console.log(`[Recording] Resumed: ${this.currentRecording.id}`);
    }
  }

  /**
   * Stop and save recording
   */
  stopRecording(): RecordingSession | null {
    if (!this.currentRecording) return null;

    this.isRecording = false;
    this.currentRecording.endTime = Date.now();
    this.currentRecording.status = 'stopped';

    // Flush remaining events
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    this.flushToDisk();

    const recording = { ...this.currentRecording };
    console.log(`[Recording] Stopped: ${recording.id}, ${recording.events.length} events`);

    this.currentRecording = null;
    this.eventBuffer = [];

    return recording;
  }

  /**
   * Flush event buffer to disk
   */
  private flushToDisk(): void {
    if (!this.currentRecording || this.eventBuffer.length === 0) return;

    const filePath = path.join(this.recordingsDir, `${this.currentRecording.id}.json`);
    
    try {
      let existing: RecordingSession | null = null;
      if (fs.existsSync(filePath)) {
        existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      }

      const session: RecordingSession = existing || this.currentRecording;
      session.events = [...session.events, ...this.eventBuffer];

      fs.writeFileSync(filePath, JSON.stringify(session, null, 2));
      this.eventBuffer = [];
    } catch (error) {
      console.error('[Recording] Flush error:', error);
    }
  }

  /**
   * Get all recordings
   */
  getRecordings(): RecordingSession[] {
    this.ensureDirectory();
    const files = fs.readdirSync(this.recordingsDir).filter(f => f.endsWith('.json'));
    
    return files.map(file => {
      const content = fs.readFileSync(path.join(this.recordingsDir, file), 'utf-8');
      return JSON.parse(content);
    }).sort((a, b) => b.startTime - a.startTime);
  }

  /**
   * Load a recording for playback
   */
  loadRecording(sessionId: string): RecordingSession | null {
    const filePath = path.join(this.recordingsDir, `${sessionId}.json`);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`[Recording] Not found: ${sessionId}`);
      return null;
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  /**
   * Delete a recording
   */
  deleteRecording(sessionId: string): boolean {
    const filePath = path.join(this.recordingsDir, `${sessionId}.json`);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log(`[Recording] Deleted: ${sessionId}`);
      return true;
    }
    return false;
  }

  /**
   * Get recording metadata (without full events)
   */
  getRecordingMeta(sessionId: string): { id: string; serverName: string; serverHost: string; startTime: number; endTime?: number; duration: number; eventCount: number } | null {
    const recording = this.loadRecording(sessionId);
    if (!recording) return null;

    return {
      id: recording.id,
      serverName: recording.serverName,
      serverHost: recording.serverHost,
      startTime: recording.startTime,
      endTime: recording.endTime,
      duration: (recording.endTime || Date.now()) - recording.startTime,
      eventCount: recording.events.length,
    };
  }

  /**
   * Export recording to text (for sharing)
   */
  exportToText(sessionId: string): string {
    const recording = this.loadRecording(sessionId);
    if (!recording) return '';

    let output = `Recording: ${recording.serverName}@${recording.serverHost}\n`;
    output += `Started: ${new Date(recording.startTime).toISOString()}\n`;
    output += `Events: ${recording.events.length}\n\n`;
    output += '-'.repeat(60) + '\n\n';

    for (const event of recording.events) {
      if (event.type === 'output') {
        output += event.data;
      }
    }

    return output;
  }

  /**
   * Get recordings directory path
   */
  getRecordingsDir(): string {
    return this.recordingsDir;
  }
}

export const terminalRecordingService = new TerminalRecordingService();
export default TerminalRecordingService;
