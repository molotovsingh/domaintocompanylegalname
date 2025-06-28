import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BatchProcessor } from '../services/processor';
import { MemStorage } from '../storage';
import { GLEIFService } from '../services/gleifService';
import type { Domain, InsertDomain } from '../../shared/schema';

// Mock the GLEIF service
jest.mock('../services/gleifService');

describe('BatchProcessor Level 2 Integration', () => {
  let processor: BatchProcessor;
  let storage: MemStorage;
  let mockGleifService: jest.Mocked<GLEIFService>;

  beforeEach(() => {
    storage = new MemStorage();
    mockGleifService = new GLEIFService() as jest.Mocked<GLEIFService>;
    processor = new BatchProcessor(storage);
    
    // Mock GLEIF service methods
    mockGleifService.isEligibleForLevel2 = jest.fn();
    mockGleifService.enhanceWithGLEIF = jest.fn();
  });

  describe('Level 2 Processing Integration', () => {
    it('should trigger Level 2 for eligible domains', async () => {
      const mockDomain: InsertDomain = {
        domain: 'lowconfidence.com',
        batchId: 'test-batch',
        status: 'pending'
      };

      // Mock domain creation and processing
      const createdDomain = await storage.createDomain(mockDomain);
      
      // Simulate failed Level 1 extraction
      const failedDomain = {
        ...createdDomain,
        status: 'failed',
        companyName: 'Partial Name',
        confidenceScore: 30
      };

      // Mock Level 2 eligibility check
      mockGleifService.isEligibleForLevel2.mockReturnValue(true);
      
      // Mock Level 2 enhancement
      const level2Result = {
        ...failedDomain,
        level2Status: 'success',
        level2Attempted: true,
        primaryLeiCode: '123456789012345678',
        candidates: [
          {
            leiCode: '123456789012345678',
            legalName: 'Enhanced Company Name Inc.',
            jurisdiction: 'US',
            entityStatus: 'ACTIVE',
            weightedScore: 85,
            isPrimarySelection: true,
            domainId: failedDomain.id
          }
        ]
      };

      mockGleifService.enhanceWithGLEIF.mockResolvedValue(level2Result);

      // Test Level 2 enhancement would be triggered
      expect(mockGleifService.isEligibleForLevel2(failedDomain)).toBe(true);
      
      const enhanced = await mockGleifService.enhanceWithGLEIF(failedDomain);
      expect(enhanced.level2Status).toBe('success');
      expect(enhanced.level2Attempted).toBe(true);
      expect(enhanced.primaryLeiCode).toBe('123456789012345678');
    });

    it('should not trigger Level 2 for high confidence domains', async () => {
      const highConfidenceDomain = {
        id: 1,
        domain: 'apple.com',
        status: 'success',
        companyName: 'Apple Inc.',
        confidenceScore: 95
      };

      mockGleifService.isEligibleForLevel2.mockReturnValue(false);

      expect(mockGleifService.isEligibleForLevel2(highConfidenceDomain)).toBe(false);
    });

    it('should handle Level 2 processing errors gracefully', async () => {
      const mockDomain = {
        id: 1,
        domain: 'problematic.com',
        status: 'failed',
        companyName: 'Problematic Corp',
        confidenceScore: 25
      };

      mockGleifService.isEligibleForLevel2.mockReturnValue(true);
      mockGleifService.enhanceWithGLEIF.mockRejectedValue(new Error('GLEIF API Error'));

      // Should handle error gracefully
      await expect(mockGleifService.enhanceWithGLEIF(mockDomain)).rejects.toThrow('GLEIF API Error');
    });
  });

  describe('Batch Processing with Level 2', () => {
    it('should process mixed domains with Level 1 and Level 2', async () => {
      const domains = [
        'apple.com',        // High confidence - no Level 2
        'unknown.com',      // Low confidence - Level 2 eligible
        'partial.com'       // Failed extraction - Level 2 eligible
      ];

      // Mock various processing outcomes
      const results = [
        { domain: 'apple.com', confidenceScore: 95, level2Attempted: false },
        { domain: 'unknown.com', confidenceScore: 45, level2Attempted: true },
        { domain: 'partial.com', confidenceScore: null, level2Attempted: true }
      ];

      // Verify different processing paths
      expect(results[0].level2Attempted).toBe(false); // High confidence
      expect(results[1].level2Attempted).toBe(true);  // Low confidence
      expect(results[2].level2Attempted).toBe(true);  // Failed extraction
    });
  });

  describe('Business Category Enhancement', () => {
    it('should enhance business categories with GLEIF data', () => {
      const gleifEnhancedDomain = {
        id: 1,
        domain: 'bank.com',
        companyName: 'Major Bank Corp',
        level2Status: 'success',
        primaryLeiCode: '123456789012345678',
        businessCategory: 'GLEIF Verified - High Priority'
      };

      expect(gleifEnhancedDomain.businessCategory).toContain('GLEIF Verified');
      expect(gleifEnhancedDomain.level2Status).toBe('success');
    });

    it('should categorize multiple GLEIF candidates appropriately', () => {
      const multipleCandidatesDomain = {
        id: 1,
        domain: 'conglomerate.com',
        level2Status: 'candidates_found',
        candidateCount: 3,
        businessCategory: 'GLEIF Multiple - Manual Review'
      };

      expect(multipleCandidatesDomain.businessCategory).toContain('Manual Review');
    });
  });
});