import { createHash } from 'crypto';

/**
 * Domain Hash Utility for Persistent Unique Identification
 * 
 * Generates consistent MD5 hashes for domains that persist across:
 * - Multiple batch runs
 * - Database migrations
 * - System restarts
 * - Historical tracking
 */

export function generateDomainHash(domain: string): string {
  // Normalize domain to lowercase and trim whitespace
  const normalizedDomain = domain.toLowerCase().trim();
  
  // Generate MD5 hash for consistent identification
  return createHash('md5').update(normalizedDomain).digest('hex');
}

/**
 * Create domain hash with validation
 */
export function createDomainHash(domain: string): string {
  if (!domain || typeof domain !== 'string') {
    throw new Error('Domain must be a non-empty string');
  }
  
  // Basic domain validation
  if (!/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    throw new Error(`Invalid domain format: ${domain}`);
  }
  
  return generateDomainHash(domain);
}

/**
 * Batch domain hash generation for upload processing
 */
export function generateDomainHashes(domains: string[]): Map<string, string> {
  const hashMap = new Map<string, string>();
  
  for (const domain of domains) {
    try {
      const hash = createDomainHash(domain);
      hashMap.set(domain, hash);
    } catch (error) {
      console.warn(`Failed to generate hash for domain ${domain}:`, error);
    }
  }
  
  return hashMap;
}

/**
 * Verify domain hash consistency
 */
export function verifyDomainHash(domain: string, expectedHash: string): boolean {
  try {
    const actualHash = generateDomainHash(domain);
    return actualHash === expectedHash;
  } catch {
    return false;
  }
}

/**
 * Historical lookup helper
 */
export function findDomainByHash(domains: { domain: string; domainHash: string }[], hash: string): string | null {
  const match = domains.find(d => d.domainHash === hash);
  return match ? match.domain : null;
}