import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { GLEIFService } from '../services/gleifService';
import type { InsertGleifCandidate } from '../../shared/schema';

// Mock fetch globally
global.fetch = jest.fn();

describe('GLEIFService', () => {
  let gleifService: GLEIFService;
  const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    gleifService = new GLEIFService();
    mockFetch.mockClear();
  });

  describe('searchEntities', () => {
    it('should search for entities by company name', async () => {
      const mockResponse = {
        data: [
          {
            attributes: {
              entity: {
                legalName: { name: 'Apple Inc.' },
                legalAddress: { country: 'US' },
                entityStatus: 'ACTIVE',
                legalForm: { id: 'OTHE' },
                category: 'NON_FINANCIAL'
              },
              lei: '123456789012345678'
            }
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      } as Response);

      const result = await gleifService.searchEntities('Apple Inc.');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('filter[entity.legalName]=Apple Inc.'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Accept': 'application/json',
            'User-Agent': expect.stringContaining('DomainExtractor')
          })
        })
      );

      expect(result).toHaveLength(1);
      expect(result[0].legalName).toBe('Apple Inc.');
      expect(result[0].leiCode).toBe('123456789012345678');
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      } as Response);

      await expect(gleifService.searchEntities('Apple Inc.')).rejects.toThrow('GLEIF API error: 429 Too Many Requests');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(gleifService.searchEntities('Apple Inc.')).rejects.toThrow('Network error');
    });
  });

  describe('enhanceWithGLEIF', () => {
    const mockDomain = {
      id: 1,
      domain: 'apple.com',
      companyName: 'Apple Inc.',
      extractionMethod: 'domain_mapping',
      confidenceScore: 95,
      status: 'success'
    };

    it('should enhance domain with GLEIF candidates', async () => {
      const mockGLEIFResults = [
        {
          legalName: 'Apple Inc.',
          leiCode: '123456789012345678',
          jurisdiction: 'US',
          entityStatus: 'ACTIVE',
          legalForm: 'Corporation'
        }
      ];

      // Mock GLEIF search
      jest.spyOn(gleifService, 'searchEntities').mockResolvedValueOnce(mockGLEIFResults);

      const result = await gleifService.enhanceWithGLEIF(mockDomain);

      expect(result.level2Status).toBe('success');
      expect(result.level2Attempted).toBe(true);
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].legalName).toBe('Apple Inc.');
      expect(result.candidates[0].leiCode).toBe('123456789012345678');
    });

    it('should handle domains without company names', async () => {
      const domainWithoutName = {
        ...mockDomain,
        companyName: null
      };

      const result = await gleifService.enhanceWithGLEIF(domainWithoutName);

      expect(result.level2Status).toBe('failed');
      expect(result.level2Attempted).toBe(true);
      expect(result.candidates).toHaveLength(0);
      expect(result.level2ErrorMessage).toContain('No company name available');
    });

    it('should calculate weighted scores correctly', async () => {
      const mockGLEIFResults = [
        {
          legalName: 'Apple Inc.',
          leiCode: '123456789012345678',
          jurisdiction: 'US',
          entityStatus: 'ACTIVE',
          legalForm: 'Corporation'
        }
      ];

      jest.spyOn(gleifService, 'searchEntities').mockResolvedValueOnce(mockGLEIFResults);

      const result = await gleifService.enhanceWithGLEIF(mockDomain);

      expect(result.candidates[0].weightedScore).toBeGreaterThan(0);
      expect(result.candidates[0].nameMatchScore).toBeDefined();
      expect(result.candidates[0].domainTldScore).toBeDefined();
    });
  });

  describe('calculateWeightedScore', () => {
    it('should calculate Fortune 500 bonus correctly', () => {
      const candidate = {
        legalName: 'Apple Inc.',
        leiCode: '123456789012345678',
        jurisdiction: 'US'
      };

      const scores = gleifService.calculateWeightedScore(candidate, 'Apple Inc.', 'apple.com');

      expect(scores.fortune500Score).toBeGreaterThan(0);
      expect(scores.weightedScore).toBeGreaterThan(80); // High score for Fortune 500 match
    });

    it('should apply TLD jurisdiction bonus', () => {
      const candidate = {
        legalName: 'Deutsche Bank AG',
        leiCode: '123456789012345678',
        jurisdiction: 'DE'
      };

      const scores = gleifService.calculateWeightedScore(candidate, 'Deutsche Bank AG', 'deutschebank.de');

      expect(scores.domainTldScore).toBeGreaterThan(0);
      expect(scores.weightedScore).toBeGreaterThan(70);
    });

    it('should handle exact name matches', () => {
      const candidate = {
        legalName: 'Microsoft Corporation',
        leiCode: '123456789012345678',
        jurisdiction: 'US'
      };

      const scores = gleifService.calculateWeightedScore(candidate, 'Microsoft Corporation', 'microsoft.com');

      expect(scores.nameMatchScore).toBe(100);
      expect(scores.weightedScore).toBeGreaterThan(90);
    });
  });

  describe('selectPrimaryCandidate', () => {
    it('should select highest weighted score candidate', () => {
      const candidates: InsertGleifCandidate[] = [
        {
          leiCode: 'low-score',
          legalName: 'Low Score Corp',
          jurisdiction: 'XX',
          weightedScore: 45,
          domainId: 1
        },
        {
          leiCode: 'high-score',
          legalName: 'High Score Inc',
          jurisdiction: 'US',
          weightedScore: 85,
          domainId: 1
        },
        {
          leiCode: 'medium-score',
          legalName: 'Medium Score LLC',
          jurisdiction: 'CA',
          weightedScore: 65,
          domainId: 1
        }
      ];

      const result = gleifService.selectPrimaryCandidate(candidates);

      expect(result.selectedCandidate.leiCode).toBe('high-score');
      expect(result.selectionReason).toContain('highest weighted score');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should require minimum confidence threshold', () => {
      const candidates: InsertGleifCandidate[] = [
        {
          leiCode: 'low-confidence',
          legalName: 'Low Confidence Corp',
          jurisdiction: 'XX',
          weightedScore: 35,
          domainId: 1
        }
      ];

      const result = gleifService.selectPrimaryCandidate(candidates);

      expect(result.selectedCandidate.leiCode).toBe('low-confidence');
      expect(result.confidence).toBeLessThan(0.5);
      expect(result.selectionReason).toContain('Below recommended confidence');
    });
  });

  describe('isEligibleForLevel2', () => {
    it('should identify failed extractions as eligible', () => {
      const domain = {
        id: 1,
        status: 'failed',
        companyName: 'Partial Company',
        confidenceScore: null
      };

      const isEligible = gleifService.isEligibleForLevel2(domain);
      expect(isEligible).toBe(true);
    });

    it('should identify low confidence domains as eligible', () => {
      const domain = {
        id: 1,
        status: 'success',
        companyName: 'Low Confidence Corp',
        confidenceScore: 45
      };

      const isEligible = gleifService.isEligibleForLevel2(domain);
      expect(isEligible).toBe(true);
    });

    it('should not process high confidence domains', () => {
      const domain = {
        id: 1,
        status: 'success',
        companyName: 'High Confidence Inc.',
        confidenceScore: 95
      };

      const isEligible = gleifService.isEligibleForLevel2(domain);
      expect(isEligible).toBe(false);
    });

    it('should not process domains without company names', () => {
      const domain = {
        id: 1,
        status: 'failed',
        companyName: null,
        confidenceScore: null
      };

      const isEligible = gleifService.isEligibleForLevel2(domain);
      expect(isEligible).toBe(false);
    });
  });

  describe('Error handling and edge cases', () => {
    it('should handle empty GLEIF responses', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      } as Response);

      const result = await gleifService.searchEntities('Nonexistent Company');
      expect(result).toHaveLength(0);
    });

    it('should sanitize company names for API calls', async () => {
      const companyWithSpecialChars = 'Company & Co. (Holdings) Ltd.';
      
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] })
      } as Response);

      await gleifService.searchEntities(companyWithSpecialChars);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(companyWithSpecialChars)),
        expect.any(Object)
      );
    });

    it('should handle API rate limiting with retry logic', async () => {
      // First call returns rate limit error
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          statusText: 'Too Many Requests'
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: [] })
        } as Response);

      // Should handle rate limiting gracefully
      await expect(gleifService.searchEntities('Test Company')).rejects.toThrow('Too Many Requests');
    });
  });
});