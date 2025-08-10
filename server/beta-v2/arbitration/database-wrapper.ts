import { executeBetaV2Query } from '../database';

/**
 * Database wrapper for arbitration services
 * Provides a consistent interface for database operations
 */
export const db = {
  async query(queryText: string, params?: any[]): Promise<any> {
    return executeBetaV2Query(queryText, params || []);
  }
};

export default db;