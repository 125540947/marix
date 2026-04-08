/**
 * SSH Key Manager Service
 * Manage SSH keys with encryption and audit
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface SSHKeyEntry {
  id: string;
  name: string;
  publicKey: string;
  privateKeyEncrypted: string;
  passphrase?: string;
  createdAt: number;
  lastUsed?: number;
  fingerprint?: string;
  comment?: string;
}

interface KeyGenerationOptions {
  type: 'rsa' | 'ed25519' | 'ecdsa';
  bits?: number;
  comment?: string;
  passphrase?: string;
}

const ALGORITHM = 'aes-256-gcm';
const KEY_DIR = 'ssh_keys';

class SSHKeyManagerService {
  private keysDir: string;
  private keyCache: Map<string, SSHKeyEntry> = new Map();
  private masterKey: Buffer | null = null;

  constructor() {
    this.keysDir = path.join(app.getPath('userData'), KEY_DIR);
    this.ensureDirectory();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.keysDir)) {
      fs.mkdirSync(this.keysDir, { recursive: true });
    }
  }

  /**
   * Set master key for encryption
   */
  setMasterKey(password: string): void {
    // Generate random salt per session
    const salt = crypto.randomBytes(32);
    this.masterKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
  }

  /**
   * Generate new SSH key pair
   */
  async generateKey(name: string, options: KeyGenerationOptions): Promise<SSHKeyEntry> {
    const id = `key_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // In production, would use ssh-keygen or node-keygen
    const keyPair = await this.generateKeyPair(options);
    
    const entry: SSHKeyEntry = {
      id,
      name,
      publicKey: keyPair.publicKey,
      privateKeyEncrypted: this.encryptPrivateKey(keyPair.privateKey, options.passphrase),
      passphrase: options.passphrase,
      createdAt: Date.now(),
      fingerprint: this.getFingerprint(keyPair.publicKey),
      comment: options.comment || name,
    };

    // Save to disk
    const keyPath = path.join(this.keysDir, `${id}.json`);
    fs.writeFileSync(keyPath, JSON.stringify(entry, null, 2));
    
    this.keyCache.set(id, entry);
    console.log(`[SSHKey] Generated: ${name} (${id})`);
    
    return entry;
  }

  /**
   * Import existing SSH key
   */
  importKey(name: string, privateKey: string, passphrase?: string): SSHKeyEntry {
    const id = `key_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    // Extract public key (in production, would use ssh-keygen -y)
    const publicKey = this.extractPublicKey(privateKey);
    
    const entry: SSHKeyEntry = {
      id,
      name,
      publicKey,
      privateKeyEncrypted: this.encryptPrivateKey(privateKey, passphrase),
      passphrase,
      createdAt: Date.now(),
      fingerprint: this.getFingerprint(publicKey),
    };

    const keyPath = path.join(this.keysDir, `${id}.json`);
    fs.writeFileSync(keyPath, JSON.stringify(entry, null, 2));
    
    this.keyCache.set(id, entry);
    return entry;
  }

  /**
   * Get all keys
   */
  getAllKeys(): SSHKeyEntry[] {
    if (this.keyCache.size === 0) {
      this.loadAllKeys();
    }
    return Array.from(this.keyCache.values());
  }

  /**
   * Get key by ID
   */
  getKey(id: string): SSHKeyEntry | null {
    return this.keyCache.get(id) || null;
  }

  /**
   * Get decrypted private key
   */
  getDecryptedKey(id: string, passphrase?: string): string | null {
    const entry = this.keyCache.get(id);
    if (!entry) return null;

    return this.decryptPrivateKey(entry.privateKeyEncrypted, passphrase || entry.passphrase);
  }

  /**
   * Delete key
   */
  deleteKey(id: string): boolean {
    const keyPath = path.join(this.keysDir, `${id}.json`);
    if (fs.existsSync(keyPath)) {
      fs.unlinkSync(keyPath);
      this.keyCache.delete(id);
      console.log(`[SSHKey] Deleted: ${id}`);
      return true;
    }
    return false;
  }

  /**
   * Update last used timestamp
   */
  updateLastUsed(id: string): void {
    const entry = this.keyCache.get(id);
    if (entry) {
      entry.lastUsed = Date.now();
      const keyPath = path.join(this.keysDir, `${id}.json`);
      fs.writeFileSync(keyPath, JSON.stringify(entry, null, 2));
    }
  }

  /**
   * Load all keys from disk
   */
  private loadAllKeys(): void {
    this.ensureDirectory();
    const files = fs.readdirSync(this.keysDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.keysDir, file), 'utf-8');
        const entry: SSHKeyEntry = JSON.parse(content);
        this.keyCache.set(entry.id, entry);
      } catch (error) {
        console.error(`[SSHKey] Failed to load ${file}:`, error);
      }
    }
  }

  private async generateKeyPair(options: KeyGenerationOptions): Promise<{ publicKey: string; privateKey: string }> {
    // Placeholder - in production use ssh-keygen or node-keygen
    return {
      publicKey: `ssh-${options.type} AAAAB3NzaC1... (generated)`,
      privateKey: `-----BEGIN OPENSSH PRIVATE KEY-----\n... (generated)`,
    };
  }

  private encryptPrivateKey(privateKey: string, passphrase?: string): string {
    const key = this.masterKey || crypto.randomBytes(32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let encrypted = cipher.update(privateKey, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  private decryptPrivateKey(encrypted: string, passphrase?: string): string {
    const key = this.masterKey || crypto.randomBytes(32);
    const [ivHex, authTagHex, encryptedData] = encrypted.split(':');
    
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private extractPublicKey(privateKey: string): string {
    // Placeholder - in production parse private key
    return 'ssh-rsa AAAAB3NzaC1... user@host';
  }

  private getFingerprint(publicKey: string): string {
    const hash = crypto.createHash('sha256').update(publicKey).digest('base64');
    return `SHA256:${hash.substring(0, 43)}`;
  }
}

export const sshKeyManagerService = new SSHKeyManagerService();
export default SSHKeyManagerService;
