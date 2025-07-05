
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface CodeChange {
  id: string;
  timestamp: string;
  type: 'feature' | 'fix' | 'enhancement' | 'system';
  description: string;
  files: string[];
  agent: 'assistant';
}

class ChangeLogger {
  private changesPath: string;

  constructor() {
    this.changesPath = join(process.cwd(), 'logs', 'code-changes.json');
  }

  logChange(change: Omit<CodeChange, 'id' | 'timestamp' | 'agent'>) {
    const changes = this.getChanges();
    
    const newChange: CodeChange = {
      id: this.generateId(),
      timestamp: new Date().toISOString(),
      agent: 'assistant',
      ...change
    };

    changes.unshift(newChange); // Add to beginning
    changes.splice(20); // Keep only last 20 changes

    writeFileSync(this.changesPath, JSON.stringify(changes, null, 2));
  }

  getChanges(): CodeChange[] {
    if (!existsSync(this.changesPath)) {
      return [];
    }
    
    try {
      const content = readFileSync(this.changesPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('Failed to read changes log:', error);
      return [];
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  private formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) {
      return `${diffMins} minutes ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hours ago`;
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  }

  getFormattedChanges() {
    return this.getChanges().map(change => ({
      ...change,
      formattedTime: this.formatTimestamp(change.timestamp)
    }));
  }
}

export const changeLogger = new ChangeLogger();
