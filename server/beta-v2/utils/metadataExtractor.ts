import * as cheerio from 'cheerio';
import { PageMetadata } from '../crawlee-dump/crawleeDumpTypes';

export class MetadataExtractor {
  /**
   * Extract comprehensive metadata from a page for bias detection
   */
  static extractPageMetadata(
    html: string, 
    headers: Record<string, string>, 
    url: string
  ): PageMetadata {
    const $ = cheerio.load(html);
    const text = $.text();
    
    return {
      language: this.extractLanguageMetadata($, headers, text),
      location: this.extractLocationMetadata($, url, text),
      currency: this.extractCurrencyMetadata($, text),
      contentPatterns: this.extractContentPatterns($, text)
    };
  }

  /**
   * Extract language metadata from multiple sources
   */
  private static extractLanguageMetadata(
    $: cheerio.CheerioAPI,
    headers: Record<string, string>,
    text: string
  ): PageMetadata['language'] {
    const metadata: PageMetadata['language'] = {
      confidence: 0
    };

    // 1. HTML lang attribute (highest priority)
    const htmlLang = $('html').attr('lang');
    if (htmlLang) {
      metadata.htmlLang = htmlLang;
      metadata.confidence += 0.4;
    }

    // 2. Content-Language HTTP header
    const contentLangHeader = headers['content-language'] || headers['Content-Language'];
    if (contentLangHeader) {
      metadata.contentLanguage = contentLangHeader;
      metadata.confidence += 0.3;
    }

    // 3. Meta content-language tag
    const metaLang = $('meta[http-equiv="content-language"]').attr('content');
    if (metaLang) {
      metadata.metaLanguage = metaLang;
      metadata.confidence += 0.2;
    }

    // 4. Detect languages in content (simplified - in production use a library)
    const detectedLangs = this.detectLanguagesInText(text);
    if (detectedLangs.length > 0) {
      metadata.detectedLanguages = detectedLangs;
      metadata.confidence += 0.1;
    }

    // 5. Determine primary language
    metadata.primaryLanguage = 
      metadata.htmlLang?.split('-')[0] || 
      metadata.contentLanguage?.split('-')[0] || 
      metadata.metaLanguage?.split('-')[0] ||
      detectedLangs[0];

    // Cap confidence at 1
    metadata.confidence = Math.min(metadata.confidence, 1);

    return metadata;
  }

  /**
   * Extract location metadata from multiple sources
   */
  private static extractLocationMetadata(
    $: cheerio.CheerioAPI,
    url: string,
    text: string
  ): PageMetadata['location'] {
    const metadata: PageMetadata['location'] = {
      confidence: 0
    };

    // 1. TLD hint
    const tld = this.extractTLD(url);
    if (tld) {
      metadata.tldHint = tld;
      const country = this.tldToCountry(tld);
      if (country) {
        metadata.confidence += 0.2;
      }
    }

    // 2. Extract from schema.org markup
    const schemaOrg = this.extractSchemaOrgLocation($);
    if (schemaOrg) {
      metadata.schemaOrgLocation = schemaOrg;
      if (schemaOrg.address?.addressCountry) {
        metadata.businessCountry = schemaOrg.address.addressCountry;
        metadata.confidence += 0.3;
      }
      if (schemaOrg.address?.addressLocality) {
        metadata.businessCity = schemaOrg.address.addressLocality;
      }
    }

    // 3. Extract from address patterns in text
    const addressInfo = this.extractAddressInfo(text);
    if (addressInfo.country && !metadata.businessCountry) {
      metadata.businessCountry = addressInfo.country;
      metadata.confidence += 0.2;
    }
    if (addressInfo.city && !metadata.businessCity) {
      metadata.businessCity = addressInfo.city;
    }

    // 4. Extract legal jurisdiction from terms/privacy
    const jurisdiction = this.extractLegalJurisdiction($);
    if (jurisdiction) {
      metadata.legalJurisdiction = jurisdiction;
      metadata.confidence += 0.2;
    }

    // 5. Consolidate country (best guess)
    metadata.consolidatedCountry = 
      metadata.businessCountry || 
      this.tldToCountry(metadata.tldHint || '') ||
      this.jurisdictionToCountry(metadata.legalJurisdiction || '');

    // Cap confidence at 1
    metadata.confidence = Math.min(metadata.confidence, 1);

    return metadata;
  }

  /**
   * Extract currency metadata
   */
  private static extractCurrencyMetadata(
    $: cheerio.CheerioAPI,
    text: string
  ): PageMetadata['currency'] {
    const metadata: PageMetadata['currency'] = {
      confidence: 0,
      symbolFrequency: {}
    };

    // 1. Count currency symbols
    const currencyPatterns = [
      { symbol: '$', code: 'USD', pattern: /\$[\d,]+\.?\d*/g },
      { symbol: '€', code: 'EUR', pattern: /€[\d,]+\.?\d*/g },
      { symbol: '£', code: 'GBP', pattern: /£[\d,]+\.?\d*/g },
      { symbol: '¥', code: 'JPY', pattern: /¥[\d,]+/g },
      { symbol: 'R$', code: 'BRL', pattern: /R\$[\d,]+\.?\d*/g },
      { symbol: 'A$', code: 'AUD', pattern: /A\$[\d,]+\.?\d*/g },
      { symbol: 'C$', code: 'CAD', pattern: /C\$[\d,]+\.?\d*/g },
      { symbol: '₹', code: 'INR', pattern: /₹[\d,]+\.?\d*/g },
    ];

    const detectedCurrencies = new Set<string>();
    let maxFrequency = 0;
    let primaryCurrency = '';

    currencyPatterns.forEach(({ symbol, code, pattern }) => {
      const matches = text.match(pattern);
      if (matches) {
        const count = matches.length;
        metadata.symbolFrequency![symbol] = count;
        detectedCurrencies.add(code);
        
        if (count > maxFrequency) {
          maxFrequency = count;
          primaryCurrency = code;
        }
      }
    });

    // 2. Detect ISO currency codes
    const isoCodes = text.match(/\b(USD|EUR|GBP|JPY|AUD|CAD|CHF|CNY|INR|BRL)\b/g);
    if (isoCodes) {
      isoCodes.forEach(code => detectedCurrencies.add(code));
    }

    // 3. Detect payment processors
    const processors: string[] = [];
    if (text.toLowerCase().includes('stripe')) processors.push('Stripe');
    if (text.toLowerCase().includes('paypal')) processors.push('PayPal');
    if (text.toLowerCase().includes('square')) processors.push('Square');
    if (text.toLowerCase().includes('razorpay')) processors.push('Razorpay');
    
    if (processors.length > 0) {
      metadata.paymentProcessors = processors;
      metadata.confidence += 0.2;
    }

    // 4. Extract OpenGraph price data
    const ogPrice = $('meta[property="og:price:amount"]').attr('content');
    const ogCurrency = $('meta[property="og:price:currency"]').attr('content');
    if (ogPrice && ogCurrency) {
      metadata.openGraphPrices = [{ amount: ogPrice, currency: ogCurrency }];
      detectedCurrencies.add(ogCurrency);
      metadata.confidence += 0.3;
    }

    // 5. Set results
    if (detectedCurrencies.size > 0) {
      metadata.allCurrencies = Array.from(detectedCurrencies);
      metadata.primaryCurrency = primaryCurrency || metadata.allCurrencies[0];
      metadata.confidence += 0.5;
      metadata.source = maxFrequency > 0 ? 'content' : 'metadata';
    }

    // Cap confidence at 1
    metadata.confidence = Math.min(metadata.confidence, 1);

    return metadata;
  }

  /**
   * Extract content patterns for bias detection
   */
  private static extractContentPatterns(
    $: cheerio.CheerioAPI,
    text: string
  ): PageMetadata['contentPatterns'] {
    const patterns: PageMetadata['contentPatterns'] = {};

    // 1. Formality level (based on language patterns)
    const formalIndicators = [
      /\bhereby\b/gi, /\bwherein\b/gi, /\bthereof\b/gi, /\bhereinafter\b/gi,
      /\bnotwithstanding\b/gi, /\bpursuant to\b/gi, /\bshall\b/gi
    ];
    const formalCount = formalIndicators.reduce((count, pattern) => 
      count + (text.match(pattern)?.length || 0), 0
    );
    
    if (formalCount > 10) patterns.formalityLevel = 'high';
    else if (formalCount > 3) patterns.formalityLevel = 'medium';
    else patterns.formalityLevel = 'low';

    // 2. Transparency score (how openly entity info is shared)
    let transparencyScore = 0;
    if ($('footer').text().match(/©.*?(inc|corp|llc|ltd|gmbh|ag|srl|sa)/i)) transparencyScore += 0.3;
    if (text.match(/registered (in|at|with)/i)) transparencyScore += 0.2;
    if (text.match(/company (number|registration)/i)) transparencyScore += 0.2;
    if ($('[itemtype*="Organization"]').length > 0) transparencyScore += 0.3;
    patterns.transparencyScore = Math.min(transparencyScore, 1);

    // 3. Privacy focus (GDPR/privacy indicators)
    const privacyIndicators = [
      /\bGDPR\b/i, /\bdata protection\b/i, /\bprivacy policy\b/i,
      /\bcookie consent\b/i, /\bdata controller\b/i, /\bdata processor\b/i
    ];
    const privacyCount = privacyIndicators.reduce((count, pattern) => 
      count + (text.match(pattern)?.length || 0), 0
    );
    patterns.privacyFocused = privacyCount > 3;

    // 4. Industry sector detection
    patterns.industrySector = this.detectIndustry(text);

    // 5. Regulatory region
    if (text.match(/\bMiFID\b/i)) patterns.regulatoryRegion = 'EU_MiFID';
    else if (text.match(/\bSEC\b/i)) patterns.regulatoryRegion = 'US_SEC';
    else if (text.match(/\bFCA\b/i)) patterns.regulatoryRegion = 'UK_FCA';
    else if (text.match(/\bBaFin\b/i)) patterns.regulatoryRegion = 'DE_BaFin';

    // 6. Disclosure requirements
    if (patterns.industrySector === 'Financial Services' || patterns.regulatoryRegion) {
      patterns.disclosureRequirements = 'high';
    } else if (patterns.industrySector === 'Healthcare') {
      patterns.disclosureRequirements = 'medium';
    } else {
      patterns.disclosureRequirements = 'low';
    }

    return patterns;
  }

  // Helper methods

  private static detectLanguagesInText(text: string): string[] {
    const languages: string[] = [];
    
    // Simple language detection based on common words
    if (text.match(/\b(the|and|or|is|in|of|to|for)\b/gi)?.length || 0 > 20) languages.push('en');
    if (text.match(/\b(der|die|das|und|oder|ist|in|von)\b/gi)?.length || 0 > 20) languages.push('de');
    if (text.match(/\b(le|la|les|et|ou|est|dans|de)\b/gi)?.length || 0 > 20) languages.push('fr');
    if (text.match(/\b(el|la|los|las|y|o|es|en|de)\b/gi)?.length || 0 > 20) languages.push('es');
    if (text.match(/\b(の|は|を|に|が|で|と|から)\b/g)?.length || 0 > 10) languages.push('ja');
    if (text.match(/\b(的|是|在|和|了|不|我|有)\b/g)?.length || 0 > 10) languages.push('zh');
    
    return languages;
  }

  private static extractTLD(url: string): string | undefined {
    try {
      const hostname = new URL(url).hostname;
      const parts = hostname.split('.');
      if (parts.length >= 2) {
        return parts[parts.length - 1];
      }
    } catch {
      // Invalid URL
    }
    return undefined;
  }

  private static tldToCountry(tld: string): string | undefined {
    const tldMap: Record<string, string> = {
      'uk': 'GB', 'de': 'DE', 'fr': 'FR', 'jp': 'JP', 'cn': 'CN',
      'au': 'AU', 'ca': 'CA', 'br': 'BR', 'in': 'IN', 'mx': 'MX',
      'es': 'ES', 'it': 'IT', 'nl': 'NL', 'se': 'SE', 'ch': 'CH',
      'kr': 'KR', 'sg': 'SG', 'hk': 'HK', 'tw': 'TW', 'ru': 'RU'
    };
    return tldMap[tld];
  }

  private static jurisdictionToCountry(jurisdiction: string): string | undefined {
    if (jurisdiction.includes('England') || jurisdiction.includes('Wales')) return 'GB';
    if (jurisdiction.includes('Delaware') || jurisdiction.includes('California')) return 'US';
    if (jurisdiction.includes('Germany')) return 'DE';
    if (jurisdiction.includes('France')) return 'FR';
    return undefined;
  }

  private static extractSchemaOrgLocation($: cheerio.CheerioAPI): any {
    try {
      const scripts = $('script[type="application/ld+json"]');
      for (let i = 0; i < scripts.length; i++) {
        const content = $(scripts[i]).html();
        if (content) {
          const data = JSON.parse(content);
          if (data['@type'] === 'Organization' && data.address) {
            return data;
          }
        }
      }
    } catch {
      // Invalid JSON
    }
    return null;
  }

  private static extractAddressInfo(text: string): { country?: string; city?: string } {
    const result: { country?: string; city?: string } = {};
    
    // Country patterns
    const countryPatterns = [
      { pattern: /\bUnited States\b/i, country: 'US' },
      { pattern: /\bUnited Kingdom\b/i, country: 'GB' },
      { pattern: /\bGermany\b/i, country: 'DE' },
      { pattern: /\bFrance\b/i, country: 'FR' },
      { pattern: /\bJapan\b/i, country: 'JP' },
      { pattern: /\bChina\b/i, country: 'CN' },
      { pattern: /\bCanada\b/i, country: 'CA' },
      { pattern: /\bAustralia\b/i, country: 'AU' },
      { pattern: /\bBrazil\b/i, country: 'BR' },
      { pattern: /\bIndia\b/i, country: 'IN' }
    ];

    for (const { pattern, country } of countryPatterns) {
      if (text.match(pattern)) {
        result.country = country;
        break;
      }
    }

    // City patterns (major cities)
    const cityPatterns = [
      'New York', 'London', 'Tokyo', 'Paris', 'Berlin',
      'Sydney', 'Toronto', 'Mumbai', 'Shanghai', 'Singapore'
    ];

    for (const city of cityPatterns) {
      const regex = new RegExp(`\\b${city}\\b`, 'i');
      if (text.match(regex)) {
        result.city = city;
        break;
      }
    }

    return result;
  }

  private static extractLegalJurisdiction($: cheerio.CheerioAPI): string | undefined {
    // Look for jurisdiction in legal pages
    const legalText = $('a[href*="terms"], a[href*="privacy"], a[href*="legal"]')
      .parent()
      .text()
      .toLowerCase();

    if (legalText.includes('england and wales')) return 'England and Wales';
    if (legalText.includes('delaware')) return 'Delaware, USA';
    if (legalText.includes('california')) return 'California, USA';
    if (legalText.includes('new york')) return 'New York, USA';
    
    return undefined;
  }

  private static detectIndustry(text: string): string | undefined {
    const industries = [
      { name: 'Financial Services', keywords: ['banking', 'investment', 'finance', 'trading', 'insurance'] },
      { name: 'Technology', keywords: ['software', 'technology', 'digital', 'cloud', 'data', 'AI'] },
      { name: 'Healthcare', keywords: ['health', 'medical', 'pharma', 'clinical', 'patient', 'therapy'] },
      { name: 'Retail', keywords: ['shop', 'store', 'retail', 'product', 'buy', 'sale'] },
      { name: 'Manufacturing', keywords: ['manufacturing', 'production', 'industrial', 'factory'] },
      { name: 'Energy', keywords: ['energy', 'power', 'oil', 'gas', 'renewable', 'electric'] }
    ];

    let maxScore = 0;
    let detectedIndustry: string | undefined;

    for (const industry of industries) {
      const score = industry.keywords.reduce((sum, keyword) => {
        const matches = text.toLowerCase().match(new RegExp(`\\b${keyword}\\b`, 'g'));
        return sum + (matches?.length || 0);
      }, 0);

      if (score > maxScore) {
        maxScore = score;
        detectedIndustry = industry.name;
      }
    }

    return maxScore > 5 ? detectedIndustry : undefined;
  }
}