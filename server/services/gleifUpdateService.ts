/**
 * GLEIF Update Service - Periodic Entity Intelligence Synchronization
 * 
 * This service provides periodic checking and updating of GLEIF entity data
 * to ensure the knowledge base remains current with the latest LEI database.
 * 
 * GLEIF updates their database regularly with:
 * - New entity registrations
 * - Status changes (Active/Inactive/Lapsed)
 * - Legal name updates
 * - Address changes
 * - Relationship modifications
 */

import { storage } from '../pgStorage';
import { gleifKnowledgeBase } from './gleifKnowledgeBase';

interface GLEIFUpdateConfig {
  checkIntervalHours: number;
  batchSize: number;
  maxUpdatesPerRun: number;
  enableAutoUpdate: boolean;
}

interface UpdateResult {
  entitiesChecked: number;
  entitiesUpdated: number;
  newEntitiesFound: number;
  inactiveEntitiesFound: number;
  errors: string[];
  lastUpdateTime: Date;
}

interface EntityUpdateStatus {
  leiCode: string;
  previousStatus: string;
  currentStatus: string;
  hasChanges: boolean;
  changes: string[];
  lastModified: Date;
}

class GLEIFUpdateService {
  private config: GLEIFUpdateConfig = {
    checkIntervalHours: 24, // Daily updates
    batchSize: 50, // Process 50 entities at a time
    maxUpdatesPerRun: 500, // Maximum entities to check per run
    enableAutoUpdate: false // Manual trigger only initially
  };

  private isRunning = false;
  private lastUpdateCheck: Date | null = null;

  /**
   * Initialize periodic update checking
   */
  async initializePeriodicUpdates(): Promise<void> {
    if (!this.config.enableAutoUpdate) {
      console.log('GLEIF periodic updates disabled - use manual trigger');
      return;
    }

    const intervalMs = this.config.checkIntervalHours * 60 * 60 * 1000;
    
    setInterval(async () => {
      if (!this.isRunning) {
        console.log('🔄 Starting scheduled GLEIF entity update check');
        await this.performUpdateCheck();
      }
    }, intervalMs);

    console.log(`✓ GLEIF periodic updates initialized (${this.config.checkIntervalHours}h intervals)`);
  }

  /**
   * Manually trigger GLEIF entity update check
   */
  async manualUpdateCheck(): Promise<UpdateResult> {
    if (this.isRunning) {
      throw new Error('Update check already in progress');
    }

    console.log('🔄 Manual GLEIF entity update check initiated');
    return await this.performUpdateCheck();
  }

  /**
   * Perform comprehensive entity update check
   */
  private async performUpdateCheck(): Promise<UpdateResult> {
    this.isRunning = true;
    const startTime = new Date();
    
    const result: UpdateResult = {
      entitiesChecked: 0,
      entitiesUpdated: 0,
      newEntitiesFound: 0,
      inactiveEntitiesFound: 0,
      errors: [],
      lastUpdateTime: startTime
    };

    try {
      // Get all entities that need updating (prioritize recently discovered)
      const entitiesToCheck = await this.getEntitiesForUpdate();
      console.log(`📊 Found ${entitiesToCheck.length} entities to check for updates`);

      // Process entities in batches
      for (let i = 0; i < entitiesToCheck.length && i < this.config.maxUpdatesPerRun; i += this.config.batchSize) {
        const batch = entitiesToCheck.slice(i, i + this.config.batchSize);
        
        for (const entity of batch) {
          try {
            const updateStatus = await this.checkEntityForUpdates(entity.leiCode);
            result.entitiesChecked++;

            if (updateStatus.hasChanges) {
              await this.updateEntityInKnowledgeBase(entity.leiCode, updateStatus);
              result.entitiesUpdated++;
              
              if (updateStatus.currentStatus !== 'ACTIVE') {
                result.inactiveEntitiesFound++;
              }
            }

          } catch (error) {
            result.errors.push(`Entity ${entity.leiCode}: ${error}`);
            console.error(`Failed to update entity ${entity.leiCode}:`, error);
          }
        }

        // Small delay between batches to be respectful to GLEIF API
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log(`✅ GLEIF update check completed: ${result.entitiesUpdated}/${result.entitiesChecked} entities updated`);

    } catch (error) {
      result.errors.push(`Update check failed: ${error}`);
      console.error('GLEIF update check failed:', error);
    } finally {
      this.isRunning = false;
      this.lastUpdateCheck = new Date();
    }

    return result;
  }

  /**
   * Get entities that need periodic updates
   */
  private async getEntitiesForUpdate(): Promise<Array<{leiCode: string, lastUpdated: Date}>> {
    try {
      if (!storage.getGleifEntity) {
        console.log('GLEIF entity storage not available - using mock data for development');
        return [];
      }

      // In production, this would query the gleif_entities table
      // For now, return empty array since we don't have entities yet
      return [];

    } catch (error) {
      console.error('Failed to get entities for update:', error);
      return [];
    }
  }

  /**
   * Check individual entity for updates via GLEIF API
   */
  private async checkEntityForUpdates(leiCode: string): Promise<EntityUpdateStatus> {
    try {
      // Query GLEIF API for current entity status
      const response = await fetch(`https://api.gleif.org/api/v1/lei-records/${leiCode}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.api+json',
          'User-Agent': 'Domain-Intelligence-Platform/1.0'
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          return {
            leiCode,
            previousStatus: 'ACTIVE',
            currentStatus: 'NOT_FOUND',
            hasChanges: true,
            changes: ['Entity no longer found in GLEIF database'],
            lastModified: new Date()
          };
        }
        throw new Error(`GLEIF API error: ${response.status}`);
      }

      const data = await response.json();
      const entity = data.data;
      
      // Get current entity from our knowledge base
      const currentEntity = storage.getGleifEntity ? await storage.getGleifEntity(leiCode) : null;
      
      if (!currentEntity) {
        return {
          leiCode,
          previousStatus: 'UNKNOWN',
          currentStatus: entity.attributes.entity?.registrationStatus || 'ACTIVE',
          hasChanges: false,
          changes: [],
          lastModified: new Date()
        };
      }

      // Compare entity data for changes
      const changes: string[] = [];
      const gleifEntity = entity.attributes.entity;
      
      if (currentEntity.legalName !== gleifEntity.legalName?.name) {
        changes.push(`Legal name: ${currentEntity.legalName} → ${gleifEntity.legalName?.name}`);
      }
      
      if (currentEntity.entityStatus !== gleifEntity.registrationStatus) {
        changes.push(`Status: ${currentEntity.entityStatus} → ${gleifEntity.registrationStatus}`);
      }

      return {
        leiCode,
        previousStatus: currentEntity.entityStatus || 'ACTIVE',
        currentStatus: gleifEntity.registrationStatus || 'ACTIVE',
        hasChanges: changes.length > 0,
        changes,
        lastModified: new Date(entity.attributes.entity.lastUpdateDate || Date.now())
      };

    } catch (error) {
      console.error(`Failed to check entity ${leiCode}:`, error);
      throw error;
    }
  }

  /**
   * Update entity in knowledge base with latest information
   */
  private async updateEntityInKnowledgeBase(leiCode: string, updateStatus: EntityUpdateStatus): Promise<void> {
    try {
      if (!storage.updateGleifEntity) {
        console.log(`Would update entity ${leiCode}: ${updateStatus.changes.join(', ')}`);
        return;
      }

      await storage.updateGleifEntity(leiCode, {
        entityStatus: updateStatus.currentStatus,
        lastGleifUpdate: updateStatus.lastModified,
        isActive: updateStatus.currentStatus === 'ACTIVE'
      });

      console.log(`✓ Updated entity ${leiCode}: ${updateStatus.changes.join(', ')}`);

    } catch (error) {
      console.error(`Failed to update entity in knowledge base ${leiCode}:`, error);
      throw error;
    }
  }

  /**
   * Get update service status and configuration
   */
  getUpdateStatus(): {
    isRunning: boolean;
    lastUpdateCheck: Date | null;
    config: GLEIFUpdateConfig;
    nextScheduledCheck: Date | null;
  } {
    const nextCheck = this.lastUpdateCheck 
      ? new Date(this.lastUpdateCheck.getTime() + (this.config.checkIntervalHours * 60 * 60 * 1000))
      : null;

    return {
      isRunning: this.isRunning,
      lastUpdateCheck: this.lastUpdateCheck,
      config: this.config,
      nextScheduledCheck: this.config.enableAutoUpdate ? nextCheck : null
    };
  }

  /**
   * Configure update service settings
   */
  updateConfiguration(newConfig: Partial<GLEIFUpdateConfig>): void {
    this.config = { ...this.config, ...newConfig };
    console.log('✓ GLEIF update service configuration updated:', this.config);
  }
}

export const gleifUpdateService = new GLEIFUpdateService();
export type { UpdateResult, EntityUpdateStatus, GLEIFUpdateConfig };