export interface ExtractionMethod {
  name: string;
  priority: number;
  confidence: number;
  enabled: boolean;
  timeout?: number;
  description: string;
  patterns?: string[];
  selectors?: string[];
  validation?: {
    minLength?: number;
    maxLength?: number;
    requiredWords?: number;
    blacklist?: string[];
    whitelist?: string[];
  };
}

export interface ConfidenceModifiers {
  legalSuffixBonus: number;
  legalSuffixPenalty: number;
  marketingContentPenalty: number;
  wordCountBonus: number;
  expectedEntityBonus: number;
  domainMatchBonus: number;
  connectivityPenalty: number;
}

export interface ValidationRules {
  minConfidenceThreshold: number;
  minCompanyNameLength: number;
  maxCompanyNameLength: number;
  maxMarketingWords: number;
  requireLegalSuffixForCorporate: boolean;
  allowedNonprofitPatterns: string[];
  blacklistedPatterns: string[];
}

export interface ProcessingTimeouts {
  perDomain: number;
  htmlExtraction: number;
  connectivityCheck: number;
  stuckDetection: number;
  batchProcessing: number;
}

export const EXTRACTION_METHODS: Record<string, ExtractionMethod> = {
  domain_mapping: {
    name: "Domain Mapping",
    priority: 1,
    confidence: 95,
    enabled: true,
    description: "Known Fortune 500 and major company mappings",
    validation: {
      minLength: 3,
      maxLength: 100
    }
  },
  
  structured_data: {
    name: "Structured Data (JSON-LD)",
    priority: 2,
    confidence: 98,
    enabled: true,
    timeout: 5000,
    description: "Schema.org organization data extraction",
    selectors: [
      'script[type="application/ld+json"]'
    ],
    validation: {
      minLength: 3,
      maxLength: 80,
      requiredWords: 1
    }
  },
  
  meta_property: {
    name: "Meta Properties",
    priority: 3,
    confidence: 90,
    enabled: true,
    timeout: 3000,
    description: "og:site_name, application-name, twitter:title extraction",
    selectors: [
      'meta[property="og:site_name"]',
      'meta[name="application-name"]',
      'meta[name="twitter:title"]',
      'meta[property="og:title"]'
    ],
    validation: {
      minLength: 2,
      maxLength: 60,
      blacklist: ["Welcome", "Home", "Login", "Sign In"]
    }
  },
  
  footer_copyright: {
    name: "Footer Copyright",
    priority: 4,
    confidence: 75,
    enabled: true,
    timeout: 8000,
    description: "Enhanced footer extraction with jurisdiction intelligence",
    selectors: [
      'footer',
      '[class*="footer"]',
      '[class*="copyright"]',
      '[id*="footer"]'
    ],
    patterns: [
      '©\\s*\\d{4}\\s+([^.!?]{3,80})',
      'copyright\\s*©?\\s*\\d{4}\\s+([^.!?]{3,80})',
      '\\d{4}\\s+([^.!?]{3,80}(?:Inc|Corp|Ltd|LLC|GmbH|S\\.A\\.|PLC))',
    ],
    validation: {
      minLength: 3,
      maxLength: 80,
      requiredWords: 2,
      blacklist: ["All rights reserved", "Privacy Policy", "Terms of Service"]
    }
  },
  
  about_page: {
    name: "About Page Extraction",
    priority: 5,
    confidence: 85,
    enabled: true,
    timeout: 8000,
    description: "Company information from about/company pages",
    patterns: [
      '/about',
      '/company',
      '/about-us',
      '/corporate',
      '/who-we-are'
    ],
    validation: {
      minLength: 5,
      maxLength: 100,
      requiredWords: 2
    }
  },
  
  legal_page: {
    name: "Legal Page Extraction",
    priority: 6,
    confidence: 80,
    enabled: true,
    timeout: 8000,
    description: "Legal entity names from terms/legal pages",
    patterns: [
      '/terms',
      '/legal',
      '/privacy',
      '/imprint',
      '/impressum'
    ],
    validation: {
      minLength: 5,
      maxLength: 100,
      requiredWords: 2
    }
  },
  
  domain_parse: {
    name: "Domain Parsing",
    priority: 7,
    confidence: 30,
    enabled: true,
    description: "Fallback domain name transformation",
    validation: {
      minLength: 3,
      maxLength: 50,
      requiredWords: 1
    }
  }
};

export const CONFIDENCE_MODIFIERS: ConfidenceModifiers = {
  legalSuffixBonus: 20,
  legalSuffixPenalty: -40,
  marketingContentPenalty: -30,
  wordCountBonus: 15,
  expectedEntityBonus: 25,
  domainMatchBonus: 15,
  connectivityPenalty: -100
};

export const VALIDATION_RULES: ValidationRules = {
  minConfidenceThreshold: 65,
  minCompanyNameLength: 3,
  maxCompanyNameLength: 100,
  maxMarketingWords: 1,
  requireLegalSuffixForCorporate: true,
  allowedNonprofitPatterns: [
    "university",
    "college",
    "hospital",
    "foundation",
    "institute",
    "association",
    "society",
    "trust",
    "museum",
    "library"
  ],
  blacklistedPatterns: [
    "welcome to",
    "home page",
    "our business is",
    "client challenge",
    "grocery store",
    "contact us",
    "privacy policy",
    "terms of service",
    "all rights reserved",
    "loading...",
    "please wait",
    "error",
    "not found"
  ]
};

export const PROCESSING_TIMEOUTS: ProcessingTimeouts = {
  perDomain: 11000,        // 11 seconds max per domain (optimized based on longest successful extraction)
  htmlExtraction: 6000,    // 6 seconds for HTML processing (quicker timeout)
  connectivityCheck: 3000, // 3 seconds for connectivity test (faster triage)
  stuckDetection: 20000,   // 20 seconds to detect stuck processing (earlier intervention)
  batchProcessing: 3600000 // 1 hour max for batch processing
};

// Helper functions for parsing rules
export function getEnabledMethods(): ExtractionMethod[] {
  return Object.values(EXTRACTION_METHODS)
    .filter(method => method.enabled)
    .sort((a, b) => a.priority - b.priority);
}

export function getMethodByName(name: string): ExtractionMethod | null {
  return Object.values(EXTRACTION_METHODS)
    .find(method => method.name.toLowerCase() === name.toLowerCase()) || null;
}

export function calculateConfidence(
  baseConfidence: number,
  hasLegalSuffix: boolean,
  isMarketingContent: boolean,
  wordCount: number,
  isExpectedEntity: boolean = false,
  domainMatch: boolean = false
): number {
  let confidence = baseConfidence;
  
  // Apply modifiers
  if (hasLegalSuffix) {
    confidence += CONFIDENCE_MODIFIERS.legalSuffixBonus;
  } else {
    confidence += CONFIDENCE_MODIFIERS.legalSuffixPenalty;
  }
  
  if (isMarketingContent) {
    confidence += CONFIDENCE_MODIFIERS.marketingContentPenalty;
  }
  
  if (wordCount >= 2 && wordCount <= 4) {
    confidence += CONFIDENCE_MODIFIERS.wordCountBonus;
  }
  
  if (isExpectedEntity) {
    confidence += CONFIDENCE_MODIFIERS.expectedEntityBonus;
  }
  
  if (domainMatch) {
    confidence += CONFIDENCE_MODIFIERS.domainMatchBonus;
  }
  
  // Ensure confidence stays within bounds
  return Math.max(0, Math.min(100, confidence));
}

export function validateCompanyName(
  companyName: string,
  method: string,
  hasLegalSuffix: boolean
): { isValid: boolean; reason?: string } {
  const rules = VALIDATION_RULES;
  
  // Length validation
  if (companyName.length < rules.minCompanyNameLength) {
    return { isValid: false, reason: "Too short" };
  }
  
  if (companyName.length > rules.maxCompanyNameLength) {
    return { isValid: false, reason: "Too long" };
  }
  
  // Blacklist validation
  const lowerName = companyName.toLowerCase();
  for (const pattern of rules.blacklistedPatterns) {
    if (lowerName.includes(pattern)) {
      return { isValid: false, reason: `Contains blacklisted pattern: ${pattern}` };
    }
  }
  
  // Legal suffix requirement for corporate entities
  if (rules.requireLegalSuffixForCorporate && !hasLegalSuffix) {
    // Check if it's a nonprofit/institutional entity
    const isNonprofit = rules.allowedNonprofitPatterns.some(pattern => 
      lowerName.includes(pattern)
    );
    
    if (!isNonprofit) {
      return { isValid: false, reason: "Missing required legal suffix for corporate entity" };
    }
  }
  
  return { isValid: true };
}

export function isMarketingContent(text: string): boolean {
  const marketingPatterns = [
    "welcome to",
    "our business",
    "we are",
    "leading provider",
    "best in class",
    "world class",
    "industry leader",
    "cutting edge",
    "state of the art",
    "premier destination",
    "your trusted",
    "innovative solutions"
  ];
  
  const lowerText = text.toLowerCase();
  return marketingPatterns.some(pattern => lowerText.includes(pattern));
}

// Method priority configuration
export function updateMethodPriority(methodName: string, newPriority: number): boolean {
  const method = getMethodByName(methodName);
  if (method) {
    method.priority = newPriority;
    return true;
  }
  return false;
}

// Method enablement configuration
export function toggleMethod(methodName: string, enabled: boolean): boolean {
  const method = getMethodByName(methodName);
  if (method) {
    method.enabled = enabled;
    return true;
  }
  return false;
}