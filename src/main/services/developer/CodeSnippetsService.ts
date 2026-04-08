/**
 * Code Snippets Service
 * Store and manage reusable code snippets and command templates
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

interface CodeSnippet {
  id: string;
  name: string;
  description: string;
  language: string;
  code: string;
  tags: string[];
  variables: SnippetVariable[];
  createdAt: number;
  lastUsed?: number;
  useCount: number;
}

interface SnippetVariable {
  name: string;
  defaultValue: string;
  description?: string;
}

interface SnippetTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  commands: string[];
  variables: SnippetVariable[];
}

const SNIPPETS_DIR = 'snippets';

class CodeSnippetsService {
  private snippetsDir: string;
  private snippetsCache: Map<string, CodeSnippet> = new Map();
  private templates: Map<string, SnippetTemplate> = new Map();

  constructor() {
    this.snippetsDir = path.join(app.getPath('userData'), SNIPPETS_DIR);
    this.ensureDirectory();
    this.initBuiltInTemplates();
  }

  private ensureDirectory(): void {
    if (!fs.existsSync(this.snippetsDir)) {
      fs.mkdirSync(this.snippetsDir, { recursive: true });
    }
  }

  /**
   * Initialize built-in command templates
   */
  private initBuiltInTemplates(): void {
    const builtInTemplates: SnippetTemplate[] = [
      {
        id: 'tmpl_git_basic',
        name: 'Git Basic',
        description: 'Common Git commands',
        category: 'Version Control',
        commands: [
          'git status',
          'git add .',
          'git commit -m "${message}"',
          'git push origin ${branch}',
          'git pull',
        ],
        variables: [
          { name: 'message', defaultValue: 'Update', description: 'Commit message' },
          { name: 'branch', defaultValue: 'main', description: 'Branch name' },
        ],
      },
      {
        id: 'tmpl_docker',
        name: 'Docker',
        description: 'Common Docker commands',
        category: 'Container',
        commands: [
          'docker ps',
          'docker images',
          'docker run -d ${name}',
          'docker exec -it ${container} bash',
          'docker logs -f ${container}',
          'docker-compose up -d',
        ],
        variables: [
          { name: 'name', defaultValue: 'myapp', description: 'Container name' },
          { name: 'container', defaultValue: 'container_id', description: 'Container ID' },
        ],
      },
      {
        id: 'tmpl_systemd',
        name: 'Systemd',
        description: 'Systemd service management',
        category: 'System',
        commands: [
          'sudo systemctl status ${service}',
          'sudo systemctl restart ${service}',
          'sudo systemctl enable ${service}',
          'sudo journalctl -u ${service} -f',
        ],
        variables: [
          { name: 'service', defaultValue: 'nginx', description: 'Service name' },
        ],
      },
      {
        id: 'tmpl_nginx',
        name: 'Nginx',
        description: 'Nginx common commands',
        category: 'Web Server',
        commands: [
          'sudo nginx -t',
          'sudo systemctl restart nginx',
          'sudo nginx -s reload',
          'tail -f /var/log/nginx/access.log',
        ],
        variables: [],
      },
      {
        id: 'tmpl_db',
        name: 'Database',
        description: 'Database maintenance',
        category: 'Database',
        commands: [
          'sudo systemctl status postgresql',
          'psql -U ${user} -d ${database}',
          'pg_dump ${database} > backup.sql',
          'mysql -u ${user} -p ${database}',
        ],
        variables: [
          { name: 'user', defaultValue: 'root', description: 'Database user' },
          { name: 'database', defaultValue: 'mydb', description: 'Database name' },
        ],
      },
      {
        id: 'tmpl_package',
        name: 'Package Manager',
        description: 'Package management commands',
        category: 'System',
        commands: [
          'sudo apt update && sudo apt upgrade -y',
          'sudo apt install ${package}',
          'sudo apt remove ${package}',
          'apt list --upgradable',
          'apt-cache search ${keyword}',
        ],
        variables: [
          { name: 'package', defaultValue: 'nginx', description: 'Package name' },
          { name: 'keyword', defaultValue: 'web server', description: 'Search keyword' },
        ],
      },
    ];

    for (const tmpl of builtInTemplates) {
      this.templates.set(tmpl.id, tmpl);
    }
  }

  /**
   * Create a new snippet
   */
  createSnippet(snippet: Omit<CodeSnippet, 'id' | 'createdAt' | 'useCount'>): CodeSnippet {
    const id = `snippet_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    
    const newSnippet: CodeSnippet = {
      ...snippet,
      id,
      createdAt: Date.now(),
      useCount: 0,
    };

    // Save to disk
    const filePath = path.join(this.snippetsDir, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(newSnippet, null, 2));
    
    this.snippetsCache.set(id, newSnippet);
    console.log(`[Snippets] Created: ${snippet.name}`);
    
    return newSnippet;
  }

  /**
   * Get all snippets
   */
  getAllSnippets(): CodeSnippet[] {
    if (this.snippetsCache.size === 0) {
      this.loadSnippets();
    }
    return Array.from(this.snippetsCache.values());
  }

  /**
   * Get snippet by ID
   */
  getSnippet(id: string): CodeSnippet | null {
    return this.snippetsCache.get(id) || null;
  }

  /**
   * Update snippet
   */
  updateSnippet(id: string, updates: Partial<CodeSnippet>): CodeSnippet | null {
    const snippet = this.snippetsCache.get(id);
    if (!snippet) return null;

    const updated = { ...snippet, ...updates };
    const filePath = path.join(this.snippetsDir, `${id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2));
    
    this.snippetsCache.set(id, updated);
    return updated;
  }

  /**
   * Delete snippet
   */
  deleteSnippet(id: string): boolean {
    const filePath = path.join(this.snippetsDir, `${id}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      this.snippetsCache.delete(id);
      return true;
    }
    return false;
  }

  /**
   * Record snippet use
   */
  recordUse(id: string): void {
    const snippet = this.snippetsCache.get(id);
    if (snippet) {
      snippet.lastUsed = Date.now();
      snippet.useCount++;
      const filePath = path.join(this.snippetsDir, `${id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(snippet, null, 2));
    }
  }

  /**
   * Get all templates
   */
  getAllTemplates(): SnippetTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): SnippetTemplate | null {
    return this.templates.get(id) || null;
  }

  /**
   * Render template with variables
   */
  renderTemplate(templateId: string, variables: Record<string, string>): string[] {
    const template = this.templates.get(templateId);
    if (!template) return [];

    // Validate variable names - only allow alphanumeric and underscore
    for (const key of Object.keys(variables)) {
      if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(key)) {
        console.warn(`[Snippets] Invalid variable name rejected: ${key}`);
        throw new Error('Invalid variable name');
      }
    }

    return template.commands.map(cmd => {
      let rendered = cmd;
      for (const [key, value] of Object.entries(variables)) {
        // Sanitize value - prevent command injection
        const sanitized = value.replace(/[;&|`$]/g, '');
        rendered = rendered.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), sanitized);
      }
      return rendered;
    });
  }

  /**
   * Search snippets
   */
  search(query: string): CodeSnippet[] {
    const q = query.toLowerCase();
    return this.getAllSnippets().filter(s => 
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q))
    );
  }

  /**
   * Load snippets from disk
   */
  private loadSnippets(): void {
    this.ensureDirectory();
    const files = fs.readdirSync(this.snippetsDir).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.snippetsDir, file), 'utf-8');
        const snippet: CodeSnippet = JSON.parse(content);
        this.snippetsCache.set(snippet.id, snippet);
      } catch (error) {
        console.error(`[Snippets] Failed to load ${file}:`, error);
      }
    }
  }

  /**
   * Get popular snippets
   */
  getPopularSnippets(limit: number = 10): CodeSnippet[] {
    return this.getAllSnippets()
      .sort((a, b) => b.useCount - a.useCount)
      .slice(0, limit);
  }

  /**
   * Export snippets
   */
  exportSnippets(): string {
    return JSON.stringify(this.getAllSnippets(), null, 2);
  }

  /**
   * Import snippets
   */
  importSnippets(json: string): number {
    const snippets: CodeSnippet[] = JSON.parse(json);
    let imported = 0;
    
    for (const snippet of snippets) {
      const { id, ...data } = snippet;
      this.createSnippet(data);
      imported++;
    }
    
    return imported;
  }
}

export const codeSnippetsService = new CodeSnippetsService();
export default CodeSnippetsService;
