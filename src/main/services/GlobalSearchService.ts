/**
 * Global Search Service
 * Search across servers, groups, and tags
 */

interface ServerIndex {
  id: string;
  name: string;
  host: string;
  username: string;
  group: string;
  tags: string[];
  notes: string;
}

interface SearchResult {
  type: 'server' | 'group' | 'tag';
  id: string;
  name: string;
  host?: string;
  score: number;
  matches: string[];
}

interface SearchOptions {
  limit?: number;
  fuzzy?: boolean;
  caseSensitive?: boolean;
}

class GlobalSearchService {
  private serverIndex: Map<string, ServerIndex> = new Map();
  private groupIndex: Map<string, string[]> = new Map(); // group -> server IDs
  private tagIndex: Map<string, string[]> = new Map(); // tag -> server IDs
  private lastUpdate: number = 0;

  /**
   * Rebuild search index from server list
   */
  rebuildIndex(servers: any[]): void {
    this.serverIndex.clear();
    this.groupIndex.clear();
    this.tagIndex.clear();

    for (const server of servers) {
      const index: ServerIndex = {
        id: server.id || server._id || String(server.host + server.port),
        name: server.name || '',
        host: server.host || '',
        username: server.username || '',
        group: server.group || '',
        tags: server.tags || [],
        notes: server.notes || '',
      };

      this.serverIndex.set(index.id, index);

      // Index by group
      if (index.group) {
        const groupKey = index.group.toLowerCase();
        if (!this.groupIndex.has(groupKey)) {
          this.groupIndex.set(groupKey, []);
        }
        this.groupIndex.get(groupKey)!.push(index.id);
      }

      // Index by tags
      for (const tag of index.tags || []) {
        const tagKey = tag.toLowerCase();
        if (!this.tagIndex.has(tagKey)) {
          this.tagIndex.set(tagKey, []);
        }
        this.tagIndex.get(tagKey)!.push(index.id);
      }
    }

    this.lastUpdate = Date.now();
    console.log(`[Search] Index rebuilt with ${this.serverIndex.size} servers`);
  }

  /**
   * Perform global search
   */
  search(query: string, options: SearchOptions = {}): SearchResult[] {
    const { limit = 20, fuzzy = true, caseSensitive = false } = options;
    
    if (!query || query.trim().length === 0) {
      return [];
    }

    const searchTerms = query.toLowerCase().split(/\s+/);
    const results: SearchResult[] = [];
    const seenIds = new Set<string>();

    // Search servers
    for (const [id, server] of this.serverIndex) {
      const score = this.calculateScore(server, searchTerms, caseSensitive, fuzzy);
      
      if (score > 0) {
        const matches = this.getMatches(server, searchTerms, caseSensitive);
        results.push({
          type: 'server',
          id,
          name: server.name,
          host: server.host,
          score,
          matches,
        });
        seenIds.add(id);
      }
    }

    // Search groups
    for (const [group, serverIds] of this.groupIndex) {
      if (this.matchesTerms(group, searchTerms, caseSensitive, fuzzy)) {
        results.push({
          type: 'group',
          id: group,
          name: group,
          score: searchTerms.every(term => group.includes(term)) ? 50 : 20,
          matches: searchTerms.filter(term => group.includes(term)),
        });
      }
    }

    // Search tags
    for (const [tag, serverIds] of this.tagIndex) {
      if (this.matchesTerms(tag, searchTerms, caseSensitive, fuzzy)) {
        results.push({
          type: 'tag',
          id: tag,
          name: tag,
          score: searchTerms.every(term => tag.includes(term)) ? 40 : 15,
          matches: searchTerms.filter(term => tag.includes(term)),
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, limit);
  }

  /**
   * Calculate match score for a server
   */
  private calculateScore(server: ServerIndex, terms: string[], caseSensitive: boolean, fuzzy: boolean): number {
    let score = 0;
    const searchable = caseSensitive 
      ? `${server.name} ${server.host} ${server.username} ${server.group} ${server.tags?.join(' ')} ${server.notes}`
      : `${server.name} ${server.host} ${server.username} ${server.group} ${server.tags?.join(' ')} ${server.notes}`.toLowerCase();

    for (const term of terms) {
      // Exact match
      if (searchable.includes(term)) {
        score += 100;
        // Bonus for exact field matches
        if (server.host.toLowerCase().includes(term)) score += 50;
        if (server.name.toLowerCase().includes(term)) score += 30;
        if (server.username.toLowerCase().includes(term)) score += 20;
      } else if (fuzzy) {
        // Fuzzy match (simple Levenshtein-like)
        const distance = this.fuzzyMatch(term, searchable);
        if (distance <= 2) {
          score += 30 - distance * 10;
        }
      }
    }

    // All terms match = higher score
    const matchedTerms = terms.filter(term => searchable.includes(term));
    if (matchedTerms.length === terms.length) {
      score *= 1.5;
    }

    return score;
  }

  /**
   * Get matched fields
   */
  private getMatches(server: ServerIndex, terms: string[], caseSensitive: boolean): string[] {
    const matches: string[] = [];
    const searchable = caseSensitive 
      ? server 
      : {
          ...server,
          name: server.name.toLowerCase(),
          host: server.host.toLowerCase(),
          username: server.username.toLowerCase(),
          group: server.group?.toLowerCase() || '',
          tags: server.tags?.map(t => t.toLowerCase()) || [],
          notes: server.notes?.toLowerCase() || '',
        };

    for (const term of terms) {
      if (searchable.host.includes(term)) matches.push('host');
      if (searchable.name.includes(term)) matches.push('name');
      if (searchable.username.includes(term)) matches.push('username');
      if (searchable.group?.includes(term)) matches.push('group');
      if (searchable.tags?.some(t => t.includes(term))) matches.push('tags');
      if (searchable.notes?.includes(term)) matches.push('notes');
    }

    return [...new Set(matches)];
  }

  /**
   * Check if text matches search terms
   */
  private matchesTerms(text: string, terms: string[], caseSensitive: boolean, fuzzy: boolean): boolean {
    const searchText = caseSensitive ? text : text.toLowerCase();
    return terms.some(term => {
      if (searchText.includes(term)) return true;
      if (fuzzy) {
        return this.fuzzyMatch(term, searchText) <= 2;
      }
      return false;
    });
  }

  /**
   * Simple fuzzy match (Levenshtein distance approximation)
   */
  private fuzzyMatch(a: string, b: string): number {
    // For performance, just check if characters exist in similar positions
    let matches = 0;
    for (const char of a) {
      if (b.includes(char)) matches++;
    }
    return a.length - matches;
  }

  /**
   * Quick search - returns only server IDs
   */
  quickSearch(query: string): string[] {
    const results = this.search(query, { limit: 50 });
    return results
      .filter(r => r.type === 'server')
      .map(r => r.id);
  }

  /**
   * Get index statistics
   */
  getStats(): { servers: number; groups: number; tags: number } {
    return {
      servers: this.serverIndex.size,
      groups: this.groupIndex.size,
      tags: this.tagIndex.size,
    };
  }
}

export const globalSearchService = new GlobalSearchService();
export default GlobalSearchService;
