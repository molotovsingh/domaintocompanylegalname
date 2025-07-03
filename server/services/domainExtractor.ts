import axios from 'axios';
import * as cheerio from 'cheerio';
import { promisify } from 'util';
import { exec } from 'child_process';
import { lookup } from 'dns';
import { 
  EXTRACTION_METHODS, 
  CONFIDENCE_MODIFIERS, 
  VALIDATION_RULES, 
  PROCESSING_TIMEOUTS,
  getEnabledMethods,
  calculateConfidence,
  validateCompanyName,
  isMarketingContent
} from '@shared/parsing-rules';
const execAsync = promisify(exec);
const dnsLookup = promisify(lookup);

export interface ExtractionAttempt {
  method: string;
  success: boolean;
  companyName?: string;
  confidence?: number;
  error?: string;
}

export interface GeographicMarkers {
  detectedCountries: string[];
  phoneCountryCodes: string[];
  addressMentions: string[];
  currencySymbols: string[];
  legalJurisdictions: string[];
  languageIndicators: string[];
  confidenceScore: number;
}

export interface EntityCategoryPrediction {
  primaryCategory: string;
  confidence: number;
  indicators: string[];
  alternativeCategories?: { category: string; confidence: number }[];
}

export interface ExtractionResult {
  companyName: string | null;
  method: 'footer_copyright' | 'about_page' | 'legal_page' | 'structured_data' | 'meta_property' | 'domain_mapping' | 'domain_parse' | 'html_subpage' | 'html_title' | 'html_about' | 'html_legal' | 'meta_description';
  confidence: number;
  error?: string;
  connectivity?: 'reachable' | 'unreachable' | 'unknown' | 'protected';
  failureCategory?: string;
  technicalDetails?: string;
  recommendation?: string;
  extractionAttempts?: ExtractionAttempt[];
  geographicMarkers?: GeographicMarkers;
  guessedCountry?: string;
  entityCategory?: EntityCategoryPrediction;
}

export class DomainExtractor {
  private timeout = 6000; // Ultra-fast 6-second HTML extraction timeout
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  private geographicPatterns = {
    countries: {
      'United States': ['US', 'USA', 'United States', 'America', 'Delaware', 'California', 'New York', 'Texas', 'Florida'],
      'Germany': ['Germany', 'Deutschland', 'German', 'Berlin', 'Munich', 'Hamburg', 'GmbH', 'AG'],
      'United Kingdom': ['UK', 'United Kingdom', 'Britain', 'British', 'England', 'London', 'Scotland', 'Wales'],
      'France': ['France', 'French', 'Paris', 'Lyon', 'Marseille', 'SA', 'SAS', 'SARL'],
      'Japan': ['Japan', 'Japanese', 'Tokyo', 'Osaka', 'Kyoto', 'Co., Ltd.', 'K.K.', 'Kabushiki'],
      'Canada': ['Canada', 'Canadian', 'Toronto', 'Vancouver', 'Montreal', 'Inc.', 'Ltd.', 'Corp.'],
      'Italy': ['Italy', 'Italian', 'Rome', 'Milan', 'S.p.A.', 'S.r.l.'],
      'Spain': ['Spain', 'Spanish', 'Madrid', 'Barcelona', 'S.A.', 'S.L.'],
      'Netherlands': ['Netherlands', 'Dutch', 'Amsterdam', 'B.V.', 'N.V.'],
      'Australia': ['Australia', 'Australian', 'Sydney', 'Melbourne', 'Pty Ltd'],
      'Switzerland': ['Switzerland', 'Swiss', 'Zurich', 'Geneva', 'AG', 'GmbH'],
      'Austria': ['Austria', 'Austrian', 'Vienna', 'Salzburg', 'GmbH', 'AG']
    },
    phonePatterns: {
      '+1': 'US/Canada',
      '+44': 'UK',
      '+49': 'Germany', 
      '+33': 'France',
      '+81': 'Japan',
      '+39': 'Italy',
      '+34': 'Spain',
      '+31': 'Netherlands',
      '+61': 'Australia',
      '+41': 'Switzerland',
      '+43': 'Austria'
    } as Record<string, string>,
    currencySymbols: {
      '$': 'USD',
      '€': 'EUR', 
      '£': 'GBP',
      '¥': 'JPY',
      'C$': 'CAD',
      'A$': 'AUD',
      'CHF': 'CHF'
    },
    legalTerms: {
      'incorporated in': 'legal_jurisdiction',
      'registered in': 'legal_jurisdiction', 
      'headquartered in': 'headquarters',
      'based in': 'headquarters',
      'located in': 'location'
    }
  };

  private getCountryFromTLD(domain: string): string | null {
    // Import jurisdiction data
    const { getJurisdictionByTLD } = require('@shared/jurisdictions');
    return getJurisdictionByTLD(domain);
  }

  /**
   * Extract geographic markers from website content
   */
  private extractGeographicMarkers($: cheerio.CheerioAPI, domain: string): GeographicMarkers {
    const content = $.text().toLowerCase();
    const html = $.html();

    const markers: GeographicMarkers = {
      detectedCountries: [],
      phoneCountryCodes: [],
      addressMentions: [],
      currencySymbols: [],
      legalJurisdictions: [],
      languageIndicators: [],
      confidenceScore: 0
    };

    // Enhanced phone number patterns with country codes
    const phonePatterns = [
      { pattern: /\+1[\s\-\.]?\(?[0-9]{3}\)?[\s\-\.]?[0-9]{3}[\s\-\.]?[0-9]{4}/, country: 'US', confidence: 90 },
      { pattern: /\+44[\s\-\.]?[0-9]{2,4}[\s\-\.]?[0-9]{3,4}[\s\-\.]?[0-9]{3,4}/, country: 'GB', confidence: 90 },
      { pattern: /\+49[\s\-\.]?[0-9]{2,4}[\s\-\.]?[0-9]{3,4}[\s\-\.]?[0-9]{3,4}/, country: 'DE', confidence: 90 },
      { pattern: /\+33[\s\-\.]?[0-9]{1}[\s\-\.]?[0-9]{2}[\s\-\.]?[0-9]{2}[\s\-\.]?[0-9]{2}[\s\-\.]?[0-9]{2}/, country: 'FR', confidence: 90 },
      { pattern: /\+55[\s\-\.]?\(?[0-9]{2}\)?[\s\-\.]?[0-9]{4,5}[\s\-\.]?[0-9]{4}/, country: 'BR', confidence: 90 },
      { pattern: /\+65[\s\-\.]?[0-9]{4}[\s\-\.]?[0-9]{4}/, country: 'SG', confidence: 95 },
      { pattern: /\+81[\s\-\.]?[0-9]{1,4}[\s\-\.]?[0-9]{1,4}[\s\-\.]?[0-9]{1,4}/, country: 'JP', confidence: 90 },
      { pattern: /\+86[\s\-\.]?[0-9]{2,4}[\s\-\.]?[0-9]{3,4}[\s\-\.]?[0-9]{3,4}/, country: 'CN', confidence: 90 },
      { pattern: /\+91[\s\-\.]?[0-9]{4}[\s\-\.]?[0-9]{3}[\s\-\.]?[0-9]{3}/, country: 'IN', confidence: 90 },
      { pattern: /\+90[\s\-\.]?[0-9]{3}[\s\-\.]?[0-9]{3}[\s\-\.]?[0-9]{2}[\s\-\.]?[0-9]{2}/, country: 'TR', confidence: 90 },
      { pattern: /\+7[\s\-\.]?[0-9]{3}[\s\-\.]?[0-9]{3}[\s\-\.]?[0-9]{2}[\s\-\.]?[0-9]{2}/, country: 'RU', confidence: 85 },
      { pattern: /\+52[\s\-\.]?\(?[0-9]{2,3}\)?[\s\-\.]?[0-9]{3,4}[\s\-\.]?[0-9]{4}/, country: 'MX', confidence: 90 }
    ];

    // Enhanced currency symbols and patterns
    const currencyPatterns = [
      { pattern: /\$[0-9,]+(\.[0-9]{2})?(?!\s*(AUD|CAD|NZD|SGD))/i, country: 'US', confidence: 70 },
      { pattern: /USD?\s*\$?[0-9,]+(\.[0-9]{2})?/i, country: 'US', confidence: 85 },
      { pattern: /£[0-9,]+(\.[0-9]{2})?/i, country: 'GB', confidence: 95 },
      { pattern: /GBP\s*£?[0-9,]+(\.[0-9]{2})?/i, country: 'GB', confidence: 95 },
      { pattern: /€[0-9,]+(\.[0-9]{2})?/i, country: 'EU', confidence: 80 },
      { pattern: /EUR\s*€?[0-9,]+(\.[0-9]{2})?/i, country: 'EU', confidence: 85 },
      { pattern: /¥[0-9,]+/i, country: 'JP', confidence: 85 },
      { pattern: /JPY\s*¥?[0-9,]+/i, country: 'JP', confidence: 90 },
      { pattern: /R\$[0-9,]+(\.[0-9]{2})?/i, country: 'BR', confidence: 95 },
      { pattern: /BRL\s*R?\$?[0-9,]+(\.[0-9]{2})?/i, country: 'BR', confidence: 95 },
      { pattern: /₹[0-9,]+(\.[0-9]{2})?/i, country: 'IN', confidence: 95 },
      { pattern: /INR\s*₹?[0-9,]+(\.[0-9]{2})?/i, country: 'IN', confidence: 95 },
      { pattern: /₩[0-9,]+/i, country: 'KR', confidence: 95 },
      { pattern: /KRW\s*₩?[0-9,]+/i, country: 'KR', confidence: 95 },
      { pattern: /¥[0-9,]+(?=\s*(RMB|CNY|中国))/i, country: 'CN', confidence: 90 },
      { pattern: /RMB\s*¥?[0-9,]+(\.[0-9]{2})?/i, country: 'CN', confidence: 95 }
    ];

    // Enhanced legal jurisdiction and business registration patterns
    const jurisdictionPatterns = [
      // United States
      { pattern: /\b(Delaware|Nevada|California|New York|Texas|Florida)\s+(corporation|corp\.?|inc\.?|LLC)\b/i, country: 'US', confidence: 95 },
      { pattern: /\b(SEC|Securities and Exchange Commission|IRS|Internal Revenue Service)\b/i, country: 'US', confidence: 90 },
      { pattern: /\bEIN\s*:?\s*[0-9]{2}-[0-9]{7}\b/i, country: 'US', confidence: 95 },

      // United Kingdom
      { pattern: /\b(Companies House|UK|United Kingdom|England|Scotland|Wales)\s+(Limited|Ltd\.?|PLC)\b/i, country: 'GB', confidence: 85 },
      { pattern: /\bCompany\s+Number\s*:?\s*[0-9]{8}\b/i, country: 'GB', confidence: 90 },
      { pattern: /\bVAT\s+(Registration\s+)?Number\s*:?\s*GB[0-9]{9}\b/i, country: 'GB', confidence: 95 },

      // Germany
      { pattern: /\b(Handelsregister|Amtsgericht|Registergericht)\b/i, country: 'DE', confidence: 90 },
      { pattern: /\bHRB\s*[0-9]+\b/i, country: 'DE', confidence: 95 },
      { pattern: /\bUStIdNr\.?\s*:?\s*DE[0-9]{9}\b/i, country: 'DE', confidence: 95 },

      // France
      { pattern: /\b(Registre du commerce|SIRET|SIREN|RCS)\b/i, country: 'FR', confidence: 90 },
      { pattern: /\bSIRET\s*:?\s*[0-9]{14}\b/i, country: 'FR', confidence: 95 },
      { pattern: /\bSIREN\s*:?\s*[0-9]{9}\b/i, country: 'FR', confidence: 95 },

      // Brazil
      { pattern: /\b(CNPJ|Receita Federal|Junta Comercial)\b/i, country: 'BR', confidence: 95 },
      { pattern: /\bCNPJ\s*:?\s*[0-9]{2}\.[0-9]{3}\.[0-9]{3}\/[0-9]{4}-[0-9]{2}\b/i, country: 'BR', confidence: 98 },

      // Singapore
      { pattern: /\b(ACRA|Singapore|Accounting and Corporate Regulatory Authority)\b/i, country: 'SG', confidence: 95 },
      { pattern: /\bUEN\s*:?\s*[0-9]{8}[A-Z]\b/i, country: 'SG', confidence: 95 },

      // China
      { pattern: /\b(中国|People's Republic of China|PRC|工商|营业执照)\b/i, country: 'CN', confidence: 90 },
      { pattern: /\b统一社会信用代码\s*:?\s*[0-9A-Z]{18}\b/i, country: 'CN', confidence: 95 },

      // India
      { pattern: /\b(Ministry of Corporate Affairs|MCA|Corporate Identity Number|CIN)\b/i, country: 'IN', confidence: 90 },
      { pattern: /\bCIN\s*:?\s*[UL][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}\b/i, country: 'IN', confidence: 95 },

      // Turkey
      { pattern: /\b(Ticaret Sicil|Merkezi Sicil|Vergi Dairesi)\b/i, country: 'TR', confidence: 90 },
      { pattern: /\bVergi\s+No\s*:?\s*[0-9]{10}\b/i, country: 'TR', confidence: 95 },

      // Russia
      { pattern: /\b(ОГРН|ИНН|Федеральная налоговая служба|ФНС)\b/i, country: 'RU', confidence: 90 },
      { pattern: /\bОГРН\s*:?\s*[0-9]{13}\b/i, country: 'RU', confidence: 95 },
      { pattern: /\bИНН\s*:?\s*[0-9]{10,12}\b/i, country: 'RU', confidence: 95 }
    ];

    // Enhanced address patterns for global coverage
    const addressPatterns = [
      // US States and postal codes
      { pattern: /\b(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b/i, country: 'US', confidence: 75 },
      { pattern: /\b[0-9]{5}(-[0-9]{4})?\s+(USA|United States)\b/i, country: 'US', confidence: 85 },

      // Major international cities
      { pattern: /\b(London|Manchester|Birmingham|Edinburgh|Glasgow)\b.*\b(UK|United Kingdom|England|Scotland)\b/i, country: 'GB', confidence: 80 },
      { pattern: /\b(Berlin|Munich|Hamburg|Frankfurt|Cologne|Stuttgart|Düsseldorf)\b.*\bGermany\b/i, country: 'DE', confidence: 80 },
      { pattern: /\b(Paris|Lyon|Marseille|Toulouse|Nice|Nantes|Strasbourg)\b.*\bFrance\b/i, country: 'FR', confidence: 80 },
      { pattern: /\b(São Paulo|Rio de Janeiro|Brasília|Salvador|Fortaleza|Belo Horizonte)\b.*\bBrazil\b/i, country: 'BR', confidence: 80 },
      { pattern: /\b(Tokyo|Osaka|Kyoto|Yokohama|Nagoya|Sapporo|Fukuoka)\b.*\bJapan\b/i, country: 'JP', confidence: 80 },
      { pattern: /\b(Beijing|Shanghai|Guangzhou|Shenzhen|Chengdu|Hangzhou|Nanjing)\b.*\bChina\b/i, country: 'CN', confidence: 80 },
      { pattern: /\b(Mumbai|Delhi|Bangalore|Hyderabad|Chennai|Kolkata|Pune)\b.*\bIndia\b/i, country: 'IN', confidence: 80 },
      { pattern: /\b(Istanbul|Ankara|Izmir|Bursa|Antalya)\b.*\bTurkey\b/i, country: 'TR', confidence: 80 },
      { pattern: /\b(Moscow|St\. Petersburg|Novosibirsk|Yekaterinburg|Nizhny Novgorod)\b.*\bRussia\b/i, country: 'RU', confidence: 80 }
    ];

    // Language detection patterns for additional context
    const languagePatterns = [
      { pattern: /\b(privacy policy|terms of service|about us|contact us|copyright|all rights reserved)\b/i, country: 'US', confidence: 30 },
      { pattern: /\b(política de privacidade|termos de serviço|sobre nós|fale conosco|direitos reservados)\b/i, country: 'BR', confidence: 70 },
      { pattern: /\b(politique de confidentialité|conditions d'utilisation|à propos|nous contacter|droits réservés)\b/i, country: 'FR', confidence: 70 },
      { pattern: /\b(datenschutz|nutzungsbedingungen|über uns|kontakt|alle rechte vorbehalten)\b/i, country: 'DE', confidence: 70 },
      { pattern: /\b(隐私政策|服务条款|关于我们|联系我们|版权所有)\b/i, country: 'CN', confidence: 70 },
      { pattern: /\b(プライバシーポリシー|利用規約|会社概要|お問い合わせ|著作権)\b/i, country: 'JP', confidence: 70 },
      { pattern: /\b(gizlilik politikası|kullanım şartları|hakkımızda|iletişim|tüm hakları saklıdır)\b/i, country: 'TR', confidence: 70 },
      { pattern: /\b(политика конфиденциальности|условия использования|о нас|контакты|все права защищены)\b/i, country: 'RU', confidence: 70 }
    ];

    // Check all pattern categories
    const allPatterns = [
      ...phonePatterns.map(p => ({...p, type: 'phone' as const})),
      ...currencyPatterns.map(p => ({...p, type: 'currency' as const})),
      ...jurisdictionPatterns.map(p => ({...p, type: 'jurisdiction' as const})),
      ...addressPatterns.map(p => ({...p, type: 'address' as const})),
      ...languagePatterns.map(p => ({...p, type: 'language' as const}))
    ];

    for (const patternConfig of allPatterns) {
      const matches = content.match(new RegExp(patternConfig.pattern, 'gi'));
      if (matches) {
        if (!markers.detectedCountries.includes(patternConfig.country)) {
          markers.detectedCountries.push(patternConfig.country);
        }
        markers.phoneCountryCodes.push(patternConfig.country);
        markers.currencySymbols.push(patternConfig.country);
        markers.legalJurisdictions.push(patternConfig.country);
        markers.addressMentions.push(patternConfig.country);
        markers.languageIndicators.push(patternConfig.country);
        markers.confidenceScore = patternConfig.confidence
      }
    }

    // Detect country mentions
    for (const [country, patterns] of Object.entries(this.geographicPatterns.countries)) {
      for (const pattern of patterns) {
        if (content.includes(pattern.toLowerCase())) {
          if (!markers.detectedCountries.includes(country)) {
            markers.detectedCountries.push(country);
          }
        }
      }
    }

    // Extract phone country codes
    const phoneRegex = /(\+\d{1,3})\s*[\d\s\-\(\)]+/g;
    let phoneMatch;
    while ((phoneMatch = phoneRegex.exec(content)) !== null) {
      const code = phoneMatch[1];
      if (this.geographicPatterns.phonePatterns[code]) {
        markers.phoneCountryCodes.push(code);
      }
    }

    // Extract currency symbols
    for (const [symbol, currency] of Object.entries(this.geographicPatterns.currencySymbols)) {
      if (content.includes(symbol)) {
        markers.currencySymbols.push(symbol);
      }
    }

    // Extract legal jurisdiction mentions
    for (const [term, type] of Object.entries(this.geographicPatterns.legalTerms)) {
      const regex = new RegExp(term + '\\s+([a-z\\s,]+)', 'gi');
      const matches = content.match(regex);
      if (matches) {
        markers.legalJurisdictions.push(...matches);
      }
    }

    // Extract address patterns
    const addressPatterns2 = [
      /\d+\s+[a-z\s]+(?:street|st|avenue|ave|road|rd|boulevard|blvd|drive|dr|lane|ln)/gi,
      /[a-z\s]+,\s*[a-z]{2}\s+\d{5}/gi, // US ZIP codes
      /[a-z\s]+\s+\d{5}\s+[a-z\s]+/gi, // European postal codes
    ];

    for (const pattern of addressPatterns2) {
      const matches = content.match(pattern);
      if (matches) {
        markers.addressMentions.push(...matches.slice(0, 3)); // Limit to first 3 matches
      }
    }

    // Detect language indicators
    const langAttribute = $('html').attr('lang');
    if (langAttribute) {
      markers.languageIndicators.push(langAttribute);
    }

    // Calculate confidence score
    markers.confidenceScore = this.calculateGeographicConfidence(markers);

    return markers;
  }

  /**
   * Calculate confidence score for geographic detection
   */
  private calculateGeographicConfidence(markers: GeographicMarkers): number {
    let score = 0;

    // Country mentions (high value)
    score += markers.detectedCountries.length * 25;

    // Phone codes (medium-high value)
    score += markers.phoneCountryCodes.length * 20;

    // Legal jurisdictions (high value)
    score += markers.legalJurisdictions.length * 30;

    // Address mentions (medium value)
    score += markers.addressMentions.length * 15;

    // Currency symbols (low-medium value)
    score += markers.currencySymbols.length * 10;

    // Language indicators (medium value)
    score += markers.languageIndicators.length * 15;

    return Math.min(score, 100); // Cap at 100
  }

  /**
   * Predict entity category based on domain, company name, and website content
   */
  private predictEntityCategory(domain: string, companyName: string | null, $: cheerio.CheerioAPI): EntityCategoryPrediction {
    const content = $.text().toLowerCase();
    const domainLower = domain.toLowerCase();
    
    const categoryIndicators = {
      'Technology/Software': {
        domainKeywords: ['tech', 'software', 'digital', 'cloud', 'data', 'ai', 'cyber', 'app'],
        contentKeywords: ['software', 'technology', 'digital', 'platform', 'cloud', 'artificial intelligence', 'machine learning', 'cybersecurity', 'saas', 'api'],
        tldBonus: ['.io', '.tech', '.ai', '.app'],
        weight: 1.0
      },
      'Financial Services': {
        domainKeywords: ['bank', 'finance', 'invest', 'capital', 'credit', 'loan', 'insurance'],
        contentKeywords: ['banking', 'financial', 'investment', 'insurance', 'credit', 'loans', 'wealth management', 'portfolio', 'trading', 'fintech'],
        businessSuffixes: ['bank', 'capital', 'investments', 'insurance', 'financial'],
        weight: 1.0
      },
      'Healthcare/Pharmaceutical': {
        domainKeywords: ['health', 'pharma', 'medical', 'bio', 'med', 'care'],
        contentKeywords: ['healthcare', 'pharmaceutical', 'medicine', 'medical', 'patient', 'therapy', 'drug', 'clinical', 'biotechnology', 'diagnostics'],
        businessSuffixes: ['healthcare', 'pharmaceuticals', 'medical', 'biotech'],
        weight: 1.0
      },
      'Manufacturing/Industrial': {
        domainKeywords: ['manufacturing', 'industrial', 'auto', 'steel', 'chemical', 'materials'],
        contentKeywords: ['manufacturing', 'industrial', 'production', 'automotive', 'steel', 'chemical', 'materials', 'engineering', 'machinery', 'components'],
        businessSuffixes: ['manufacturing', 'industries', 'industrial', 'automotive'],
        weight: 0.9
      },
      'Energy/Utilities': {
        domainKeywords: ['energy', 'power', 'electric', 'oil', 'gas', 'renewable', 'utility'],
        contentKeywords: ['energy', 'electricity', 'power', 'oil', 'gas', 'renewable', 'solar', 'wind', 'utilities', 'petroleum'],
        businessSuffixes: ['energy', 'power', 'electric', 'utilities'],
        weight: 1.0
      },
      'Retail/Consumer': {
        domainKeywords: ['retail', 'shop', 'store', 'market', 'consumer', 'brand'],
        contentKeywords: ['retail', 'shopping', 'consumer', 'products', 'brands', 'merchandise', 'e-commerce', 'marketplace', 'fashion', 'lifestyle'],
        businessSuffixes: ['retail', 'brands', 'consumer', 'products'],
        weight: 0.8
      },
      'Telecommunications': {
        domainKeywords: ['telecom', 'mobile', 'network', 'communications', 'wireless'],
        contentKeywords: ['telecommunications', 'mobile', 'network', 'communications', 'wireless', 'broadband', '5g', 'connectivity', 'internet'],
        businessSuffixes: ['telecom', 'communications', 'mobile', 'networks'],
        weight: 1.0
      },
      'Aerospace/Defense': {
        domainKeywords: ['aerospace', 'aviation', 'defense', 'aircraft', 'space'],
        contentKeywords: ['aerospace', 'aviation', 'aircraft', 'defense', 'space', 'satellite', 'military', 'flight', 'aviation'],
        businessSuffixes: ['aerospace', 'aviation', 'defense', 'aircraft'],
        weight: 1.0
      },
      'Food/Beverage': {
        domainKeywords: ['food', 'beverage', 'nutrition', 'restaurant', 'dining'],
        contentKeywords: ['food', 'beverage', 'nutrition', 'restaurant', 'dining', 'culinary', 'ingredients', 'dairy', 'agriculture'],
        businessSuffixes: ['foods', 'beverages', 'nutrition', 'agriculture'],
        weight: 0.9
      },
      'Real Estate': {
        domainKeywords: ['real', 'estate', 'property', 'construction', 'development'],
        contentKeywords: ['real estate', 'property', 'construction', 'development', 'building', 'residential', 'commercial', 'investment'],
        businessSuffixes: ['properties', 'development', 'construction', 'realty'],
        weight: 0.8
      }
    };

    const scores: Record<string, { score: number; indicators: string[] }> = {};

    // Initialize scores
    Object.keys(categoryIndicators).forEach(category => {
      scores[category] = { score: 0, indicators: [] };
    });

    // Analyze each category
    Object.entries(categoryIndicators).forEach(([category, config]) => {
      let categoryScore = 0;
      const indicators: string[] = [];

      // Domain keyword analysis
      config.domainKeywords.forEach(keyword => {
        if (domainLower.includes(keyword)) {
          categoryScore += 30;
          indicators.push(`Domain contains "${keyword}"`);
        }
      });

      // Content keyword analysis
      config.contentKeywords.forEach(keyword => {
        if (content.includes(keyword)) {
          categoryScore += 15;
          indicators.push(`Content mentions "${keyword}"`);
        }
      });

      // Company name analysis
      if (companyName) {
        const companyLower = companyName.toLowerCase();
        config.domainKeywords.forEach(keyword => {
          if (companyLower.includes(keyword)) {
            categoryScore += 25;
            indicators.push(`Company name contains "${keyword}"`);
          }
        });

        // Business suffix analysis
        if (config.businessSuffixes) {
          config.businessSuffixes.forEach(suffix => {
            if (companyLower.includes(suffix)) {
              categoryScore += 20;
              indicators.push(`Company name suggests "${suffix}" business`);
            }
          });
        }
      }

      // TLD bonus
      if (config.tldBonus) {
        config.tldBonus.forEach(tld => {
          if (domain.endsWith(tld)) {
            categoryScore += 15;
            indicators.push(`TLD "${tld}" suggests tech focus`);
          }
        });
      }

      // Apply category weight
      categoryScore *= config.weight;

      scores[category] = { score: categoryScore, indicators };
    });

    // Find top category
    const sortedCategories = Object.entries(scores)
      .sort(([,a], [,b]) => b.score - a.score)
      .filter(([,data]) => data.score > 0);

    if (sortedCategories.length === 0) {
      return {
        primaryCategory: 'General Business',
        confidence: 30,
        indicators: ['No specific industry indicators found'],
        alternativeCategories: []
      };
    }

    const [primaryCategory, primaryData] = sortedCategories[0];
    const alternatives = sortedCategories.slice(1, 3).map(([cat, data]) => ({
      category: cat,
      confidence: Math.min(Math.round((data.score / Math.max(primaryData.score, 1)) * 100), 95)
    }));

    return {
      primaryCategory,
      confidence: Math.min(Math.round(primaryData.score), 95),
      indicators: primaryData.indicators.slice(0, 5), // Top 5 indicators
      alternativeCategories: alternatives.length > 0 ? alternatives : undefined
    };
  }

  /**
   * Determine most likely country from geographic markers
   */
  /**
   * Detect Cloudflare protection through multiple indicators
   */
  /**
   * Ultra-fast Cloudflare detection via DNS lookup
   */
  private async checkCloudflareByDNS(domain: string): Promise<boolean> {
    try {
      // Method 1: Check if domain resolves to Cloudflare IP ranges
      const result = await dnsLookup(domain);
      const ip = result.address;

      // Cloudflare IP ranges (most common ones)
      const cloudflareRanges = [
        '104.16.', '104.17.', '104.18.', '104.19.', '104.20.', '104.21.', '104.22.', '104.23.', 
        '104.24.', '104.25.', '104.26.', '104.27.', '104.28.', '104.29.', '104.30.', '104.31.',
        '172.64.', '172.65.', '172.66.', '172.67.', '172.68.', '172.69.', '172.70.', '172.71.',
        '173.245.', '188.114.', '190.93.', '197.234.', '198.41.'
      ];

      for (const range of cloudflareRanges) {
        if (ip.startsWith(range)) {
          console.log(`CLOUDFLARE IP DETECTED: ${domain} -> ${ip} (${range})`);
          return true;
        }
      }

      // Method 2: Check nameservers for Cloudflare patterns
      try {
        const { stdout } = await execAsync(`nslookup -type=ns ${domain}`);
        const nsOutput = stdout.toLowerCase();

        if (nsOutput.includes('cloudflare') || 
            nsOutput.includes('.ns.cloudflare.com') ||
            nsOutput.includes('andy.ns.cloudflare.com') ||
            nsOutput.includes('lynn.ns.cloudflare.com')) {
          console.log(`CLOUDFLARE NS DETECTED: ${domain}`);
          return true;
        }
      } catch (nsError) {
        // NS lookup failed, continue with IP-based detection only
      }

      return false;
    } catch (error) {
      // DNS lookup failed, not necessarily Cloudflare
      return false;
    }
  }

  private detectCloudflareProtection(response: any): boolean {
    const headers = response.headers || {};

    // Method 1: Direct Cloudflare headers (100% accurate)
    const cloudflareHeaders = [
      'cf-ray',           // Always present on Cloudflare
      'cf-cache-status',  // Cloudflare caching
      'cf-request-id',    // Cloudflare request tracking
      'cf-visitor',       // Cloudflare visitor info
      'cf-connecting-ip', // Original IP header
      'cf-ipcountry',     // Country detection
      'cf-edge-cache'     // Edge caching info
    ];

    for (const header of cloudflareHeaders) {
      if (headers[header]) {
        console.log(`CLOUDFLARE HEADER DETECTED: ${header} = ${headers[header]}`);
        return true;
      }
    }

    // Method 2: Server identification
    const server = headers['server']?.toLowerCase() || '';
    if (server.includes('cloudflare') || server.includes('cf-')) {
      console.log(`CLOUDFLARE SERVER DETECTED: ${server}`);
      return true;
    }

    // Method 3: Status code patterns (Cloudflare specific)
    if (response.status === 403 && headers['cf-ray']) {
      console.log(`CLOUDFLARE 403 + CF-RAY DETECTED`);
      return true;
    }

    // Method 4: Security headers pattern
    const securityHeaders = headers['x-frame-options'] || headers['x-content-type-options'] || '';
    if (securityHeaders && (headers['cf-ray'] || server.includes('cloudflare'))) {
      console.log(`CLOUDFLARE SECURITY PATTERN DETECTED`);
      return true;
    }

    // Method 5: Challenge detection in response body (if available)
    if (response.data && typeof response.data === 'string') {
      const challengePatterns = [
        'checking your browser',
        'cloudflare',
        'ray id',
        'challenge',
        'just a moment',
        'enable javascript and cookies',
        'cf-browser-verification'
      ];

      const lowerData = response.data.toLowerCase();
      for (const pattern of challengePatterns) {
        if (lowerData.includes(pattern)) {
          console.log(`CLOUDFLARE CHALLENGE PATTERN DETECTED: ${pattern}`);
          return true;
        }
      }
    }

    return false;
  }

  private guessCountryFromMarkers(markers: GeographicMarkers, domain: string): string {
    const countryScores: Record<string, number> = {};

    // TLD-based initial guess
    const tldCountry = this.getCountryFromTLD(domain);
    if (tldCountry) {
      countryScores[tldCountry] = 20;
    }

    // .com domains default to US unless strong evidence otherwise
    if (domain.endsWith('.com') && !tldCountry) {
      countryScores['United States'] = 15;
    }

    // Score based on detected countries
    for (const country of markers.detectedCountries) {
      countryScores[country] = (countryScores[country] || 0) + 30;
    }

    // Score based on phone codes
    for (const code of markers.phoneCountryCodes) {
      const country = this.geographicPatterns.phonePatterns[code];
      if (country) {
        countryScores[country] = (countryScores[country] || 0) + 25;
      }
    }

    // Score based on legal jurisdictions
    for (const jurisdiction of markers.legalJurisdictions) {
      for (const [country, patterns] of Object.entries(this.geographicPatterns.countries)) {
        for (const pattern of patterns) {
          if (jurisdiction.toLowerCase().includes(pattern.toLowerCase())) {
            countryScores[country] = (countryScores[country] || 0) + 35;
          }
        }
      }
    }

    // Find highest scoring country
    const topCountry = Object.entries(countryScores)
      .sort(([,a], [,b]) => b - a)[0];

    return topCountry?.[0] || 'Unknown';
  }

  private getCountryLegalSuffixes(country: string): string[] {
    // Import jurisdiction data
    const { getJurisdictionSuffixes, JURISDICTIONS } = require('@shared/jurisdictions');

    if (country && JURISDICTIONS[country]) {
      return getJurisdictionSuffixes(country);
    }

    // Default to US suffixes if country not found
    return getJurisdictionSuffixes('us');
  }

  private extractDomainStem(domain: string): string[] {
    // Remove TLD and common words to get meaningful brand terms
    const domainBase = domain.split('.')[0];
    const commonWords = ['the', 'and', 'group', 'company', 'corp', 'inc', 'ltd', 'llc'];

    // Split on hyphens, underscores, numbers
    const parts = domainBase.split(/[-_0-9]+/).filter(part => 
      part.length > 2 && !commonWords.includes(part.toLowerCase())
    );

    return [domainBase, ...parts].filter(Boolean);
  }

  async extractCompanyName(domain: string): Promise<ExtractionResult> {
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
    const extractionAttempts: ExtractionAttempt[] = [];

    // STEP 1: Pre-flight Cloudflare DNS detection (ultra-fast)
    try {
      const isCloudflareByDNS = await this.checkCloudflareByDNS(cleanDomain);
      if (isCloudflareByDNS) {
        console.log(`DNS CLOUDFLARE DETECTED: ${cleanDomain} - Skipping extraction`);
        return {
          companyName: null,
          method: 'domain_parse',
          confidence: 0,
          connectivity: 'protected',
          error: 'Cloudflare protection detected via DNS',
          failureCategory: 'protected_manual_review',
          technicalDetails: 'Domain uses Cloudflare nameservers - anti-bot protection likely',
          recommendation: 'Manual review needed - Use browser or proxy',
          extractionAttempts: [{
            method: 'dns_cloudflare_detection',
            success: false,
            error: 'Cloudflare detected via DNS lookup'
          }]
        };
      }
    } catch (dnsError) {
      console.log(`DNS CHECK FAILED for ${cleanDomain}: ${dnsError instanceof Error ? dnsError.message : 'Unknown error'} - Continuing with extraction`);
      // Continue with extraction if DNS check fails
    }

    // Set up timeout protection to prevent infinite processing
    const timeout = 6000; // Reduced timeout for faster processing
    const timeoutPromise = new Promise<ExtractionResult>((_, reject) => {
      setTimeout(() => reject(new Error('Extraction timeout')), timeout);
    });

    const extractionPromise = this.performExtraction(cleanDomain, extractionAttempts);

    try {
      return await Promise.race([extractionPromise, timeoutPromise]);
    } catch (error: any) {
      if (error.message === 'Extraction timeout') {
        console.log(`EXTRACTION TIMEOUT: ${domain} exceeded ${timeout}ms processing limit`);
        return {
          companyName: null,
          method: 'domain_parse',
          confidence: 0,
          error: 'Processing timeout',
          failureCategory: 'technical_timeout',
          extractionAttempts
        };
      }
      throw error;
    }
  }

  private async performExtraction(cleanDomain: string, extractionAttempts: ExtractionAttempt[]): Promise<ExtractionResult> {
    try {
      // ALWAYS check domain mappings first (overrides cache)
      const knownMappings = this.getKnownCompanyMappings();
      console.log(`DOMAIN MAPPING DEBUG: Looking up "${cleanDomain}"`);
      console.log(`DOMAIN MAPPING DEBUG: Available keys: ${Object.keys(knownMappings).filter(k => k.includes(cleanDomain.split('.')[0])).join(', ')}`);

      if (knownMappings[cleanDomain]) {
        console.log(`DOMAIN MAPPING SUCCESS: Found "${knownMappings[cleanDomain]}" for ${cleanDomain}`);
        extractionAttempts.push({
          method: 'domain_mapping',
          success: true,
          companyName: knownMappings[cleanDomain],
          confidence: 95
        });

        return {
          companyName: knownMappings[cleanDomain],
          method: 'domain_mapping',
          confidence: 95,
          failureCategory: 'success',
          extractionAttempts
        };
      } else {
        console.log(`DOMAIN MAPPING FAILED: "${cleanDomain}" not found in mappings`);
      }

      extractionAttempts.push({
        method: 'domain_mapping',
        success: false,
        error: 'No known mapping found'
      });

      // Early triage: Quick connectivity check before expensive HTML extraction
      const connectivity = await this.checkConnectivity(cleanDomain);

      if (connectivity === 'unreachable') {
        extractionAttempts.push({
          method: 'connectivity_check',
          success: false,
          error: 'Domain unreachable'
        });

        return this.classifyFailure({
          companyName: null,
          method: 'domain_parse',
          confidence: 0,
          connectivity: 'unreachable',
          error: 'Domain unreachable - bad website/network issue',
          extractionAttempts
        }, cleanDomain);
      }

      if (connectivity === 'protected') {
        extractionAttempts.push({
          method: 'connectivity_check',
          success: false,
          error: 'Protected by anti-bot measures'
        });

        return this.classifyFailure({
          companyName: null,
          method: 'domain_parse',
          confidence: 0,
          connectivity: 'protected',
          error: 'Site protected - manual review needed',
          extractionAttempts
        }, cleanDomain);
      }

      // Domain is reachable - try enhanced footer extraction with expected entity names
      try {
        const htmlResult = await this.extractFromHTML(`https://${cleanDomain}`);

        extractionAttempts.push({
          method: htmlResult.method,
          success: !!htmlResult.companyName && this.isValidCompanyName(htmlResult.companyName || ''),
          companyName: htmlResult.companyName || undefined,
          confidence: htmlResult.confidence
        });

        if (htmlResult.companyName && this.isValidCompanyName(htmlResult.companyName)) {
          return {
            ...htmlResult,
            connectivity: 'reachable',
            failureCategory: 'success',
            extractionAttempts
          };
        }
      } catch (error) {
        extractionAttempts.push({
          method: 'html_extraction',
          success: false,
          error: error instanceof Error ? error.message : 'HTML extraction failed'
        });
      }

      // Fallback to domain parsing if HTML extraction fails
      const domainResult = this.extractFromDomain(cleanDomain);

      extractionAttempts.push({
        method: 'domain_parse',
        success: !!domainResult.companyName && this.isValidCompanyName(domainResult.companyName || ''),
        companyName: domainResult.companyName || undefined,
        confidence: domainResult.confidence
      });

      if (domainResult.companyName && this.isValidCompanyName(domainResult.companyName)) {
        return {
          ...domainResult,
          connectivity: 'reachable',
          failureCategory: 'success',
          extractionAttempts
        };
      }

      // All extraction methods failed - classify the failure
      return this.classifyFailure({
        companyName: domainResult.companyName, // Include partial result for analysis
        method: 'domain_parse',
        confidence: domainResult.confidence,
        connectivity: 'reachable',
        error: 'Domain accessible but validation failed',
        extractionAttempts
      }, cleanDomain);

    } catch (error) {
      extractionAttempts.push({
        method: 'exception_handling',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown extraction error'
      });

      // Use domain parsing as final fallback
      const domainResult = this.extractFromDomain(cleanDomain);
      return {
        ...domainResult,
        error: error instanceof Error ? error.message : 'Unknown extraction error',
        extractionAttempts
      };
    }
  }

  private getKnownCompanyMappings(): Record<string, string> {
    return {
      // Fortune 500 - Technology
      'apple.com': 'Apple Inc.',
      'microsoft.com': 'Microsoft Corporation',
      'amazon.com': 'Amazon.com, Inc.',
      'google.com': 'Alphabet Inc.',
      'meta.com': 'Meta Platforms, Inc.',
      'facebook.com': 'Meta Platforms, Inc.',
      'tesla.com': 'Tesla, Inc.',
      'nvidia.com': 'NVIDIA Corporation',
      'oracle.com': 'Oracle Corporation',
      'salesforce.com': 'Salesforce, Inc.',

      // Fortune 500 - Financial
      'jpmorgan.com': 'JPMorgan Chase & Co.',
      'berkshirehathaway.com': 'Berkshire Hathaway Inc.',
      'wellsfargo.com': 'Wells Fargo & Company',
      'goldmansachs.com': 'The Goldman Sachs Group, Inc.',
      'morganstanley.com': 'Morgan Stanley',

      // German Companies (corrected mappings)
      'springer.com': 'Springer Nature Group',
      'rtl.com': 'RTL Group SA',
      'wirecard.com': 'Wirecard AG', 
      'fuchs.com': 'Fuchs Petrolub SE',
      'siltronic.com': 'Siltronic AG',
      'siemens-energy.com': 'Siemens Energy AG',
      'rossmann.de': 'Dirk Rossmann GmbH',
      'lidl.com': 'Lidl Stiftung & Co. KG',
      'fielmann.com': 'Fielmann AG',
      'otto.de': 'Otto GmbH & Co KG',
      'metro-ag.de': 'Metro AG',
      'software-ag.com': 'Software AG',
      'zf.com': 'ZF Friedrichshafen AG',
      'trumpf.com': 'TRUMPF SE + Co. KG',
      'osram.com': 'OSRAM GmbH',
      'kuka.com': 'KUKA AG',
      'leica-microsystems.com': 'Leica Microsystems GmbH',
      'evotec.com': 'Evotec SE',
      'deutsche-boerse.com': 'Deutsche Börse AG',
      'united-internet.de': 'United Internet AG',

      // Russian Companies
      'gazprom.com': 'Gazprom PAO',
      'rosneft.com': 'Rosneft Oil Company PAO',
      'sberbank.com': 'Sberbank PAO',
      'lukoil.com': 'LUKOIL PAO',
      'norilsknickel.com': 'Nornickel PAO',
      'magnit.com': 'Magnit PAO',
      'x5.ru': 'X5 Retail Group',
      'vtb.com': 'VTB Bank PAO',
      'surgutneftegas.com': 'Surgutneftegaz PAO',
      'yandex.com': 'Yandex N.V.',
      'carl-zeiss.com': 'Carl Zeiss AG',
      'dhs-versicherungsmakler.de': 'DHS Insurance Broker GmbH & Co. KG',
      'morphosys.com': 'MorphoSys AG',
      'heidelberg.com': 'Heidelberger Druckmaschinen AG',
      'qiagen.com': 'QIAGEN GmbH',
      'teamviewer.com': 'TeamViewer SE',
      'puma.com': 'PUMA SE',
      'hellofresh.com': 'HelloFresh SE',
      'zalando.com': 'Zalando SE',
      'varta-ag.com': 'VARTA AG',
      'jenoptik.com': 'JENOPTIK AG',
      'delivery-hero.com': 'Delivery Hero SE',
      'evonik.com': 'Evonik Industries AG',
      'hugo-boss.com': 'HUGO BOSS AG',
      'krones.com': 'Krones AG',
      'pfeiffer-vacuum.com': 'Pfeiffer Vacuum Technology AG',
      'gerresheimer.com': 'Gerresheimer AG',
      'symrise.com': 'Symrise AG',
      'rational-online.com': 'RATIONAL AG',

      // Czech Republic Companies
      'cez.cz': 'ČEZ a.s.',
      'ceska-sporitelna.cz': 'Česká spořitelna a.s.',
      'kb.cz': 'Komerční banka a.s.',
      'csob.cz': 'Československá obchodní banka a.s.',
      'o2.cz': 'O2 Czech Republic a.s.',
      'tmobile.cz': 'T-Mobile Czech Republic a.s.',
      'vodafone.cz': 'Vodafone Czech Republic a.s.',
      'skoda-auto.cz': 'ŠKODA AUTO a.s.',
      'zentiva.com': 'Zentiva Group a.s.',
      'agrofert.cz': 'AGROFERT a.s.',
      'avast.com': 'Avast Software s.r.o.',
      'jet-investment.com': 'J&T BANKA a.s.',
      'moneta.cz': 'Moneta Money Bank a.s.',
      'air-bank.cz': 'Air Bank a.s.',
      'unicreditbank.cz': 'UniCredit Bank Czech Republic and Slovakia a.s.',
      'era.cz': 'ERA a.s.',
      'nwr.eu': 'New World Resources N.V.',
      'unipetrol.cz': 'Unipetrol a.s.',

      // Indian Companies (corrected mappings)
      'pnbindia.in': 'Punjab National Bank',
      'phonepe.com': 'PhonePe Pvt Ltd',
      'ola.com': 'ANI Technologies Pvt Ltd',
      'pidilite.com': 'Pidilite Industries Ltd',
      'nestleindia.com': 'Nestle India Ltd',
      'paytm.com': 'One97 Communications Ltd',
      'persistentsys.com': 'Persistent Systems Ltd',
      'marutisuzuki.com': 'Maruti Suzuki India Ltd',
      'nykaa.com': 'Nykaa E-Retail Pvt Ltd',
      'nseindia.com': 'National Stock Exchange of India Ltd',
      'mphasis.com': 'Mphasis Ltd',
      'maxlife.com': 'Max Life Insurance Company Ltd',
      'licindia.in': 'Life Insurance Corporation of India',
      'motherson.com': 'Samvardhana Motherson International Ltd',
      'mindtree.com': 'LTIMindtree Ltd',
      'maxhealthcare.in': 'Max Healthcare Institute Ltd',
      'marico.com': 'Marico Ltd',
      'kotakmf.com': 'Kotak Mahindra Asset Management Company Ltd',
      'larsentoubro.com': 'Larsen & Toubro Ltd',
      'mahindraholidays.com': 'Mahindra Holidays & Resorts India Ltd',
      'mahindra.com': 'Mahindra Group',
      'ltts.com': 'L&T Technology Services Ltd',
      'jswsteel.in': 'JSW Steel Ltd',
      'karurbank.com': 'Karur Vysya Bank Ltd',
      'justdial.com': 'Just Dial Ltd',
      'lupin.com': 'Lupin Ltd',
      'kotak.com': 'Kotak Mahindra Bank Ltd',
      'jkcement.com': 'JK Cement Ltd',
      'indusind.com': 'IndusInd Bank Ltd',
      'jspl.com': 'Jindal Steel & Power Ltd',
      'itc.in': 'ITC Ltd',
      'heromotocorp.com': 'Hero MotoCorp Ltd',
      'iocl.com': 'Indian Oil Corporation Ltd',
      'infosys.com': 'Infosys Ltd',
      'indianbank.in': 'Indian Bank',
      'grasim.com': 'Grasim Industries Ltd',
      'delhivery.com': 'Delhivery Ltd',
      'indiamart.com': 'IndiaMART InterMESH Ltd',
      'hdfcbank.com': 'HDFC Bank Ltd',
      'icicibank.com': 'ICICI Bank Ltd',
      'hdfcergo.com': 'HDFC ERGO General Insurance Company Ltd',
      'iciciprulife.com': 'ICICI Prudential Life Insurance Company Ltd',

      // French Companies with proper legal entity suffixes
      'matmut.fr': 'Matmut SA',
      'bollore.com': 'Bolloré SE',
      'citroen.com': 'Citroën SA',
      'peugeot.com': 'Peugeot SA', 
      'groupama.com': 'Groupama SA',
      'macif.fr': 'Macif SA',
      'maif.fr': 'Maif SA',
      'amundi.com': 'Amundi SA',
      'cic.fr': 'CIC SA',
      'bpifrance.fr': 'Bpifrance SA',
      'natixis.com': 'Natixis SA',
      'bred.fr': 'BRED SA',
      'caisse-epargne.fr': 'Caisse d\'Épargne SA',
      'lcl.fr': 'LCL SA',
      'monoprix.fr': 'Monoprix SA',
      'franprix.fr': 'Franprix SA',
      'brico-depot.fr': 'Brico Dépôt SA',
      'credit-mutuel.fr': 'Crédit Mutuel SA',
      'casino.fr': 'Casino SA',
      'banque-populaire.fr': 'Banque Populaire SA',
      'castorama.fr': 'Castorama SA',
      'conforama.com': 'Conforama SA',
      'leroy-merlin.fr': 'Leroy Merlin SA',
      'fnac.com': 'Fnac SA',
      'but.fr': 'BUT SA',
      'darty.com': 'Darty SA',
      'tag-heuer.com': 'TAG Heuer SA',
      'lacoste.com': 'Lacoste SA',
      'neoen.com': 'Neoen SA',
      'sephora.com': 'Sephora SA',
      'loccitane.com': 'L\'Occitane SA',
      'bulgari.com': 'Bulgari SA',
      'tiffany.com': 'Tiffany SA',
      'alexander-mcqueen.com': 'Alexander McQueen SA',
      'gucci.com': 'Gucci SA',
      'bottega-veneta.com': 'Bottega Veneta SA',
      'balenciaga.com': 'Balenciaga SA',
      'christian-dior.com': 'Christian Dior SA',
      'chanel.com': 'Chanel SA',
      'yves-saint-laurent.com': 'Yves Saint Laurent SA',
      'soitec.com': 'Soitec SA',
      'icade.com': 'Icade SA',
      'lvmh.com': 'LVMH SA',
      'total.com': 'TotalEnergies SE',
      'totalenergies.com': 'TotalEnergies SE',
      'bureau-veritas.com': 'Bureau Veritas SA',
      'dassault-systemes.com': 'Dassault Systèmes SE',
      'credit-agricole.com': 'Crédit Agricole SA',
      'saint-gobain.com': 'Saint-Gobain SA',
      'societe-generale.com': 'Société Générale SA',
      'pernod-ricard.com': 'Pernod Ricard SA',
      'unibail-rodamco.com': 'Unibail-Rodamco SE',
      'dassault-aviation.com': 'Dassault Aviation SA',
      'schneider-electric.com': 'Schneider Electric SE',

      // Additional German Companies (addressing failures)
      'db.com': 'Deutsche Bank AG',
      'deutschebank.com': 'Deutsche Bank AG',
      'deutsche-bank.com': 'Deutsche Bank AG',
      'rewe.de': 'REWE Group',
      'bertelsmann.com': 'Bertelsmann SE & Co. KGaA',
      'aldi.com': 'ALDI Group',
      'prosiebensat1.com': 'ProSiebenSat.1 Media SE',
      '1und1.com': '1&1 AG',
      'aixtron.com': 'AIXTRON SE',
      'gea.com': 'GEA Group AG',

      // Sri Lankan Companies (major corporations and conglomerates)
      'keells.com': 'John Keells Holdings PLC',
      'johnkeells.com': 'John Keells Holdings PLC',
      'cargillsceylon.com': 'Cargills (Ceylon) PLC',
      'aitken-spence.com': 'Aitken Spence PLC',
      'commercial.lk': 'Commercial Bank of Ceylon PLC',
      'combank.lk': 'Commercial Bank of Ceylon PLC',
      'dfcc.lk': 'DFCC Bank PLC',
      'hatton.lk': 'Hatton National Bank PLC',
      'sampath.lk': 'Sampath Bank PLC',
      'ndb.lk': 'National Development Bank PLC',
      'unionbank.lk': 'Union Bank of Colombo PLC',
      'seylan.lk': 'Seylan Bank PLC',
      'peoplesbank.lk': 'Peoples Bank',
      'boc.lk': 'Bank of Ceylon',
      'nsb.lk': 'National Savings Bank',
      'chevrontexaco.lk': 'Chevron Lubricants Lanka PLC',
      'brandix.com': 'Brandix Lanka Limited',
      'mas.lk': 'MAS Holdings Private Limited',
      'hemas.com': 'Hemas Holdings PLC',
      'arpico.com': 'Richard Pieris & Company PLC',
      'dialog.lk': 'Dialog Axiata PLC',
      'mobitel.lk': 'Mobitel (Pvt) Ltd',
      'slt.lk': 'Sri Lanka Telecom PLC',
      'etisalat.lk': 'Etisalat Lanka (Private) Limited',
      'ceylonelectricity.gov.lk': 'Ceylon Electricity Board',
      'leco.lk': 'Lanka Electricity Company (Private) Limited',
      'ceypetco.gov.lk': 'Ceylon Petroleum Corporation',
      'petrolumlanka.com': 'Petrolium Lanka PLC',
      'teejay.com': 'Teejay Lanka PLC',
      'dilmah.com': 'Dilmah Ceylon Tea Company PLC',
      'unilever.lk': 'Unilever Sri Lanka Limited',
      'nestle.lk': 'Nestlé Lanka PLC',
      'coca-cola.lk': 'Coca-Cola Beverages Sri Lanka Limited',
      'elephant-house.com': 'Elephant House PLC',
      'maliban.lk': 'Maliban Biscuit Manufactories (Private) Limited',
      'ceylon-cold-stores.com': 'Ceylon Cold Stores PLC',
      'cic.lk': 'CIC Holdings PLC',
      'dipped.lk': 'Dipped Products PLC',
      'loadstar.lk': 'Loadstar (Private) Limited',
      'acl.lk': 'ACL Cables PLC',
      'lankabell.lk': 'Lanka Bell Limited',
      'softlogic.lk': 'Softlogic Holdings PLC',
      'softlogiclife.com': 'Softlogic Life Insurance PLC',
      'janashakthi.lk': 'Janashakthi Insurance PLC',
      'allianz.lk': 'Allianz Insurance Lanka Limited',
      'aig.lk': 'AIG Insurance Lanka Limited',
      'fairfirst.lk': 'Fairfirst Insurance Limited',
      'singer.lk': 'Singer (Sri Lanka) PLC',
      'damro.lk': 'Damro Limited',
      'odel.lk': 'Odel PLC',
      'abans.lk': 'Abans PLC',
      'dsf.lk': 'Distilleries Company of Sri Lanka PLC',
      'ceylon-tobacco.com': 'Ceylon Tobacco Company PLC',
      'casino.lk': 'Ballys Colombo',
      'colombofort.com': 'Colombo Fort Land & Building PLC',

      // Mexican Companies (when needed)
      // Major Mexican companies can be added here with proper legal entity suffixes
      // Examples: 'cemex.com': 'CEMEX S.A.B. de C.V.', 'femsa.com': 'FEMSA S.A. de C.V.', etc.

      // Brazilian companies (major corporations)
      'petrobras.com.br': 'Petróleo Brasileiro S.A.',
      'vale.com': 'Vale S.A.',
      'itau.com.br': 'Itaú Unibanco Holding S.A.',
      'bradesco.com.br': 'Banco Bradesco S.A.',
      'ambev.com.br': 'Ambev S.A.',
      'jbs.com.br': 'JBS S.A.',
      'natura.com.br': 'Natura & Co Holding S.A.',
      'embraer.com': 'Embraer S.A.',
      'magazine-luiza.com.br': 'Magazine Luiza S.A.',
      'weg.net': 'WEG S.A.',
      'gerdau.com': 'Gerdau S.A.',
      'ultrapar.com.br': 'Ultrapar Participações S.A.',
      'suzano.com.br': 'Suzano S.A.',
      'braskem.com': 'Braskem S.A.',
      'banco-do-brasil.com.br': 'Banco do Brasil S.A.',
      'santander.com.br': 'Banco Santander Brasil S.A.',
      'nubank.com.br': 'Nu Pagamentos S.A.',
      'mercadolivre.com.br': 'MercadoLibre Brasil Ltda.',
      'oi.com.br': 'Oi S.A.',
      'tim.com.br': 'TIM Brasil S.A.',

      // Irish companies (major corporations)
      'ryanair.com': 'Ryanair DAC',
      'aib.ie': 'Allied Irish Banks PLC',
      'bankofireland.com': 'Bank of Ireland PLC',
      'permanenttsb.ie': 'Permanent TSB PLC',
      'kbc.ie': 'KBC Bank Ireland PLC',
      'ulsterbank.ie': 'Ulster Bank Ireland DAC',
      'eircom.net': 'Eir Limited',
      'cih.ie': 'CIH Bank DAC',
      'accenture.com': 'Accenture PLC',
      'glanbia.com': 'Glanbia PLC',
      'kingspan.com': 'Kingspan Group PLC',
      'crh.com': 'CRH PLC',
      'smurfitkappa.com': 'Smurfit Kappa Group PLC',
      'kerry.com': 'Kerry Group PLC',
      'irishtimes.com': 'The Irish Times DAC',
      'independent.ie': 'Independent News & Media PLC',
      'rte.ie': 'Raidió Teilifís Éireann',
      'dcc.ie': 'DCC PLC',
      'paddy-power.com': 'Flutter Entertainment PLC',
      'betfair.com': 'Flutter Entertainment PLC',
      'greencore.com': 'Greencore Group PLC',
      'cairnhomes.com': 'Cairn Homes PLC',
      'dalata.ie': 'Dalata Hotel Group PLC',

      // Irish Private Companies (large non-public corporations)
      'musgrave.ie': 'Musgrave Group Limited',
      'applegreen.com': 'Applegreen Limited',
      'dunnes.ie': 'Dunnes Stores Limited',
      'supermacs.ie': 'Supermac\'s Holdings Limited',
      'quinn.ie': 'Quinn Group Limited',
      'sisk.ie': 'John Sisk & Son Limited',
      'rohcon.ie': 'Rohcon Limited',
      'mcinerney.ie': 'McInerney Holdings Limited',
      'zipmex.ie': 'Zipmex Europe DAC',
      'circle.ie': 'Circle Internet Financial Ireland Limited',
      'stripe.com': 'Stripe Payments Europe Limited',
      'paypal.ie': 'PayPal Europe Limited',
      'workday.ie': 'Workday Ireland Limited',
      'hubspot.ie': 'HubSpot Ireland Limited',
      'salesforce.ie': 'Salesforce Ireland Limited',
      'microsoft.ie': 'Microsoft Ireland Operations Limited',
      'google.ie': 'Google Ireland Limited',
      'facebook.ie': 'Meta Platforms Ireland Limited',
      'linkedin.ie': 'LinkedIn Ireland Unlimited Company',
      'twitter.ie': 'Twitter International Unlimited Company',
      'amazon.ie': 'Amazon EU S.à r.l. Irish Branch',
      'airbnb.ie': 'Airbnb Ireland UC',
      'uber.ie': 'Uber Ireland Limited',
      'dropbox.ie': 'Dropbox Ireland Limited'

      // Italian Companies (when needed)
      // Major Italian companies can be added here with proper legal entity suffixes
      // Examples: 'eni.com': 'Eni S.p.A.', 'telecomitalia.it': 'Telecom Italia S.p.A.', etc.
    };
  }

  private async extractFromHTML(url: string): Promise<ExtractionResult> {
    try {
      // First try the main page (includes footer extraction)
      const mainResult = await this.extractFromPage(url);
      if (mainResult.companyName && mainResult.confidence >= 60 && this.isValidCompanyName(mainResult.companyName)) {
        return mainResult;
      }

      // If main page didn't work, try sub-pages
      const baseUrl = url.replace(/\/$/, '');
      const subPages = ['/about', '/about-us', '/company', '/terms', '/legal'];

      for (const subPath of subPages) {
        try {
          const subPageUrl = `${baseUrl}${subPath}`;
          const subResult = await this.extractFromPage(subPageUrl);
          if (subResult.companyName && subResult.confidence >= 60 && this.isValidCompanyName(subResult.companyName)) {
            // Mark as sub-page extraction for confidence adjustment
            subResult.method = 'html_subpage';
            subResult.confidence = Math.min(subResult.confidence + 10, 95); // Bonus for sub-page legal content
            return subResult;
          }
        } catch {
          // Continue to next sub-page if this one fails
          continue;
        }
      }

      // Return main page result even if low quality
      return mainResult;
    } catch (error) {
      return { 
        companyName: null, 
        method: 'html_title', 
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async extractFromPage(url: string): Promise<ExtractionResult> {
    const response = await axios.get(url, {
      timeout: this.timeout,
      headers: {
        'User-Agent': this.userAgent,
      },
      maxRedirects: 5,
    });

    const $ = cheerio.load(response.data);

    // Extract domain from URL for enhanced footer extraction
    const domain = new URL(url).hostname.replace(/^www\./, '');

    // Extract geographic markers from page content
    const geographicMarkers = this.extractGeographicMarkers($, domain);
    const guessedCountry = this.guessCountryFromMarkers(geographicMarkers, domain);

    // Priority 1: Try footer copyright extraction first (most reliable for legal entities)
    const footerResult = this.extractFromFooterCopyright($, domain);
    if (footerResult.companyName && this.isValidCompanyName(footerResult.companyName)) {
      const entityCategory = this.predictEntityCategory(domain, footerResult.companyName, $);
      return {
        ...footerResult,
        geographicMarkers,
        guessedCountry,
        entityCategory
      };
    }

    // Priority 2: Try meta properties extraction
    const pageTitle = $('title').text() || '';
    const pageMetaDescription = $('meta[name="description"]').attr('content') || '';

    if (pageTitle && this.isValidCompanyName(this.cleanCompanyName(pageTitle))) {
      const cleanTitle = this.cleanCompanyName(pageTitle);
      return {
        companyName: cleanTitle,
        method: 'meta_property',
        confidence: this.calculateConfidence(cleanTitle, 'meta_property')
      };
    }

    // Priority 2: Try About Us/Legal pages for unknown domains
    const aboutUrl = url.replace(/\/$/, '') + '/about';
    try {
      const aboutResult = await this.extractFromPage(aboutUrl);
      if (aboutResult.companyName && this.isValidCompanyName(aboutResult.companyName)) {
        return {
          ...aboutResult,
          method: 'about_page'
        };
      }
    } catch {
      // About page doesn't exist, continue
    }

    // HTML title extraction completely removed - proven unreliable source of marketing content
    // Now only uses authoritative sources: Domain mappings → About Us → Legal pages → Domain parsing

    // Try about section extraction (high-confidence legal entities)
    const aboutSelectors = [
      'section[class*="about"] p:first-of-type',
      '.about-section p:first-of-type',
      '#about p:first-of-type',
      '[class*="company-info"] p:first-of-type',
      '[class*="about"] h1',
      '[class*="company"] h1'
    ];

    for (const selector of aboutSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const text = element.text().trim();
        const companyName = this.extractCompanyFromAboutText(text);
        if (companyName && this.isValidCompanyName(companyName)) {
          return {
            companyName,
            method: 'html_about',
            confidence: this.calculateConfidence(companyName, 'html_about'),
          };
        }
      }
    }

    // Try legal/terms content extraction
    const legalSelectors = [
      '[class*="legal"] p:first-of-type',
      '[class*="terms"] p:first-of-type',
      'footer p:first-of-type'
    ];

    for (const selector of legalSelectors) {
      const element = $(selector).first();
      if (element.length) {
        const text = element.text().trim();
        const companyName = this.extractCompanyFromLegalText(text);
        if (companyName && this.isValidCompanyName(companyName)) {
          return {
            companyName,
            method: 'html_legal',
            confidence: this.calculateConfidence(companyName, 'html_legal'),
          };
        }
      }
    }

    // Try meta description
    const metaDescription = $('meta[name="description"]').attr('content');
    if (metaDescription) {
      const companyName = this.extractCompanyFromText(metaDescription);
      if (companyName && this.isValidCompanyName(companyName)) {
        const entityCategory = this.predictEntityCategory(domain, companyName, $);
        return {
          companyName,
          method: 'meta_description',
          confidence: this.calculateConfidence(companyName, 'meta_description'),
          entityCategory
        };
      }
    }

    // Try other common selectors
    const selectors = [
      'h1',
      '.company-name',
      '#company-name',
      '.brand',
      '.logo',
      'header h1',
      'nav .brand',
    ];

    for (const selector of selectors) {
      const element = $(selector).first();
      if (element.length) {
        const text = element.text().trim();
        const companyName = this.cleanCompanyName(text);
        if (companyName && this.isValidCompanyName(companyName)) {
          return {
            companyName,
            method: 'html_title',
            confidence: this.calculateConfidence(companyName, 'html_title') - 10,
          };
        }
      }
    }

    return { companyName: null, method: 'html_title', confidence: 0 };
  }

  private extractFromDomain(domain: string): ExtractionResult {
    // Remove protocol and www
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];

    // Remove TLD and convert to company name
    const withoutTLD = cleanDomain.replace(/\.(com|org|net|edu|gov|co\.uk|co\.jp|co\.kr|com\.au|com\.br|com\.mx|com\.tr|com\.tw|com\.sg|com\.my|com\.ph|com\.th|com\.vn|com\.cn|co\.in|co\.za|com\.ar|com\.cl|com\.pe|com\.co|io|app|tech|ai|cloud)$/, '');

    // Convert to company name format
    const companyName = this.domainToCompanyName(withoutTLD);

    // For .io domains and tech companies, be more lenient
    const isTechDomain = /\.(io|tech|ai|app|cloud)$/.test(cleanDomain);
    let confidence = this.calculateConfidence(companyName, 'domain_parse');

    if (isTechDomain && companyName.length >= 3) {
      confidence += 15; // Bonus for tech domains that often don't have legal suffixes
    }

    return {
      companyName,
      method: 'domain_parse',
      confidence: confidence
    };
  }

  private cleanCompanyName(text: string): string {
    return text
      // Remove common website patterns
      .replace(/\s*[-|–]\s*.*$/, '') // Remove everything after dash or pipe
      .replace(/\s*\|\s*.*$/, '')
      .replace(/\s*:.*$/, '') // Remove everything after colon
      .replace(/^\s*Welcome to\s*/i, '')
      .replace(/^\s*Home\s*[-|]\s*/i, '')
      // Remove descriptive phrases and marketing content
      .replace(/\s*,\s*(the\s+)?(world|global|leading|trusted|premier|top|best)\s+.*/i, '')
      .replace(/\s*-\s*(the\s+)?(world|global|leading|trusted|premier|top|best)\s+.*/i, '')
      .replace(/\s+(home\s+page|homepage)$/i, '')
      .replace(/\s+(inc|corp|corporation|company|co\.?)$/i, ' $1')
      // Remove navigation elements and UI text
      .replace(/(searchopen|go back|follow link|read icon|previous|pause|play|next|country selector)/gi, '')
      // Clean up excessive whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractCompanyFromText(text: string): string {
    // Look for company patterns in text
    const sentences = text.split(/[.!?]+/);
    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/);
      if (words.length >= 2 && words.length <= 5) {
        // Check if it looks like a company name
        const potential = words.join(' ').trim();
        if (this.isValidCompanyName(potential)) {
          return potential;
        }
      }
    }
    return this.cleanCompanyName(text);
  }

  private domainToCompanyName(domain: string): string {
    // Known Fortune 500 and major global company mappings
    const knownCompanies: Record<string, string> = {
      // German Companies (fixing current bad extractions)
      'springer.com': 'Springer Nature',
      'rtl.com': 'RTL Group',
      'wirecard.com': 'Wirecard AG', 
      'fuchs.com': 'Fuchs Petrolub SE',
      'siltronic.com': 'Siltronic AG',
      'siemens-energy.com': 'Siemens Energy AG',
      'rossmann.de': 'Dirk Rossmann GmbH',
      'lidl.com': 'Lidl Stiftung & Co. KG',
      'fielmann.com': 'Fielmann AG',
      'otto.de': 'Otto GmbH & Co KG',
      'metro-ag.de': 'Metro AG',
      'software-ag.com': 'Software AG',
      'zf.com': 'ZF Friedrichshafen AG',
      'trumpf.com': 'TRUMPF SE + Co. KG',
      'osram.com': 'OSRAM GmbH',
      'kuka.com': 'KUKA AG',
      'leica-microsystems.com': 'Leica Microsystems GmbH',
      'evotec.com': 'Evotec SE',
      'carl-zeiss.com': 'Carl Zeiss AG',
      'morphosys.com': 'MorphoSys AG',
      'heidelberg.com': 'Heidelberger Druckmaschinen AG',
      'qiagen.com': 'QIAGEN GmbH',
      'teamviewer.com': 'TeamViewer SE',
      'puma.com': 'PUMA SE',
      'hellofresh.com': 'HelloFresh SE',
      'zalando.com': 'Zalando SE',
      'varta-ag.com': 'VARTA AG',
      'jenoptik.com': 'JENOPTIK AG',
      'delivery-hero.com': 'Delivery Hero SE',
      'evonik.com': 'Evonik Industries AG',
      'hugo-boss.com': 'HUGO BOSS AG',
      'krones.com': 'Krones AG',
      'pfeiffer-vacuum.com': 'Pfeiffer Vacuum Technology AG',
      'gerresheimer.com': 'Gerresheimer AG',
      'symrise.com': 'Symrise AG',
      'rational-online.com': 'RATIONAL AG',

      // US Tech Giants
      'microsoft.com': 'Microsoft Corp.',
      'apple.com': 'Apple Inc.',
      'google.com': 'Alphabet Inc.',
      'alphabet.com': 'Alphabet Inc.',
      'amazon.com': 'Amazon.com Inc.',
      'meta.com': 'Meta Platforms Inc.',
      'facebook.com': 'Meta Platforms Inc.',
      'tesla.com': 'Tesla Inc.',
      'netflix.com': 'Netflix Inc.',
      'nvidia.com': 'NVIDIA Corp.',
      'salesforce.com': 'Salesforce Inc.',
      'oracle.com': 'Oracle Corp.',
      'adobe.com': 'Adobe Inc.',

      // UK FTSE 100 Companies (Adding missing ones from current batch)
      'shell.com': 'Shell plc',
      'astrazeneca.com': 'AstraZeneca PLC',
      'unilever.com': 'Unilever PLC',
      'bp.com': 'BP p.l.c.',
      'hsbc.com': 'HSBC Holdings plc',
      'vodafone.com': 'Vodafone Group Plc',
      'gsk.com': 'GSK plc',
      'riotinto.com': 'Rio Tinto Group',
      'prudentialplc.com': 'Prudential plc',
      'rolls-royce.com': 'Rolls-Royce Holdings plc',
      'relx.com': 'RELX PLC',
      'lseg.com': 'London Stock Exchange Group plc',
      'nationalgrid.com': 'National Grid plc',
      'tesco.com': 'Tesco PLC',
      'natwestgroup.com': 'NatWest Group plc',
      'lloydsbankinggroup.com': 'Lloyds Banking Group plc',
      'sage.com': 'Sage Group plc',
      'smiths.com': 'Smiths Group plc',
      'sse.com': 'SSE plc',
      'kingfisher.com': 'Kingfisher plc',
      'pearson.com': 'Pearson PLC',
      'reckitt.com': 'Reckitt Benckiser Group plc',
      'schroders.com': 'Schroders plc',
      'segro.com': 'SEGRO plc',
      'wpp.com': 'WPP plc',
      'legalandgeneral.com': 'Legal & General Group plc',
      'marksandspencer.com': 'Marks and Spencer Group plc',
      'landsec.com': 'Land Securities Group PLC',
      'haleon.com': 'Haleon plc',
      'intertek.com': 'Intertek Group plc',
      'jdplc.com': 'JD Sports Fashion plc',
      'mandg.com': 'M&G plc',
      'thephoenixgroup.com': 'Phoenix Group Holdings plc',
      'rentokil-initial.com': 'Rentokil Initial plc',
      'persimmonhomes.com': 'Persimmon Plc',
      'severntrent.com': 'Severn Trent Plc',
      'spiraxsarco.com': 'Spirax-Sarco Engineering plc',
      'unitedutilities.com': 'United Utilities Group PLC',
      'smith-nephew.com': 'Smith & Nephew plc',
      'londonmetric.com': 'LondonMetric Property Plc',
      'mondigroup.com': 'Mondi plc',
      'melroseplc.net': 'Melrose Industries PLC',
      'scottishmortgage.com': 'Scottish Mortgage Investment Trust PLC',
      'pershingsquareholdings.com': 'Pershing Square Holdings Ltd.',
      'imi-plc.com': 'IMI plc',
      'sc.com': 'Standard Chartered PLC',

      // Chinese Companies - Fortune 500 & Major Global Companies
      'bytedance.com': 'ByteDance Ltd.',
      'huawei.com': 'Huawei Technologies Co. Ltd.',
      'lenovo.com': 'Lenovo Group Ltd.',
      'geely.com': 'Zhejiang Geely Holding Group',
      'haier.com': 'Haier Smart Home Co. Ltd.',
      'pingan.com': 'Ping An Insurance Group',
      'sinopec.com': 'China Petroleum & Chemical Corp.',
      'catl.com': 'Contemporary Amperex Technology Co. Ltd.',
      'mindray.com': 'Mindray Medical International Ltd.',
      'anta.com': 'Anta Sports Products Ltd.',
      'gree.com': 'Gree Electric Appliances Inc.',
      'hengrui.com': 'Jiangsu Hengrui Medicine Co. Ltd.',

      // Chinese State-Owned Enterprises (Abbreviations)
      'crcc.cn': 'China Railway Construction Corp.',
      'ccccltd.cn': 'China Communications Construction Corp.',
      'cr.cn': 'China Railway Group Ltd.',
      'cscec.com': 'China State Construction Engineering Corp.',
      'chinaunicom.com': 'China United Network Communications Group',
      'chinatowercom.com': 'China Tower Corp. Ltd.',
      'coscoshipping.com': 'COSCO Shipping Holdings Co. Ltd.',
      'csair.com': 'China Southern Airlines Co. Ltd.',
      'ceair.com': 'China Eastern Airlines Corp. Ltd.',
      'cebbank.com': 'China Everbright Bank Co. Ltd.',
      'conch.cn': 'Anhui Conch Cement Co. Ltd.',
      'sxcoal.com': 'Shanxi Coking Coal Group',
      'smics.com': 'Semiconductor Manufacturing International Corp.',
      'crrcgc.cc': 'China Railway Rolling Stock Corp.',
      'whchem.com': 'Wanhua Chemical Group Co. Ltd.',
      'cmhk.com': 'China Mobile Hong Kong Co. Ltd.',
      'jxcc.com': 'Jiangxi Copper Co. Ltd.',
      'cqbeer.com': 'Chongqing Brewery Co. Ltd.',

      // Previously failing Chinese companies
      'sf-express.com': 'SF Holding Co. Ltd.',
      'fuyaogroup.com': 'Fuyao Glass Industry Group Co. Ltd.',
      'kuaishou.com': 'Kuaishou Technology',
      'hikvision.com': 'Hangzhou Hikvision Digital Technology Co. Ltd.',
      'zijinmining.com': 'Zijin Mining Group Co. Ltd.',
      'eastmoney.com': 'East Money Information Co. Ltd.',
      'wuxiapptec.com': 'WuXi AppTec Co. Ltd.',

      // Brazilian companies (major corporations)
      'petrobras.com.br': 'Petróleo Brasileiro S.A.',
      'vale.com': 'Vale S.A.',
      'itau.com.br': 'Itaú Unibanco Holding S.A.',
      'bradesco.com.br': 'Banco Bradesco S.A.',
      'ambev.com.br': 'Ambev S.A.',
      'jbs.com.br': 'JBS S.A.',
      'natura.com.br': 'Natura & Co Holding S.A.',
      'embraer.com': 'Embraer S.A.',
      'magazine-luiza.com.br': 'Magazine Luiza S.A.',
      'weg.net': 'WEG S.A.',
      'gerdau.com': 'Gerdau S.A.',
      'ultrapar.com.br': 'Ultrapar Participações S.A.',
      'suzano.com.br': 'Suzano S.A.',
      'braskem.com': 'Braskem S.A.',
      'banco-do-brasil.com.br': 'Banco do Brasil S.A.',
      'santander.com.br': 'Banco Santander Brasil S.A.',
      'nubank.com.br': 'Nu Pagamentos S.A.',
      'mercadolivre.com.br': 'MercadoLibre Brasil Ltda.',
      'oi.com.br': 'Oi S.A.',
      'tim.com.br': 'TIM Brasil S.A.',
      'muyuanfoods.com': 'Muyuan Foods Co. Ltd.',
      'jsbchina.cn': 'Jiangsu Bank Co. Ltd.',
      'citicbank.com': 'China CITIC Bank Corp. Ltd.',
      'haitian.com': 'Haitian International Holdings Ltd.',

      // Singaporean Companies - Major Financial and Technology Corporations
      'dbs.com': 'DBS Group Holdings Ltd',
      'ocbc.com': 'Oversea-Chinese Banking Corporation Ltd',
      'uob.com': 'United Overseas Bank Ltd',
      'singtel.com': 'Singapore Telecommunications Ltd',
      'capitaland.com': 'CapitaLand Investment Ltd',
      'wilmar-international.com': 'Wilmar International Ltd',
      'genting.com': 'Genting Singapore Ltd',
      'citydev.com': 'City Developments Ltd',
      'keppelcorp.com': 'Keppel Corporation Ltd',
      'sembcorp.com': 'Sembcorp Industries Ltd',
      'comfort-delgro.com': 'ComfortDelGro Corporation Ltd',
      'sph.com.sg': 'Singapore Press Holdings Ltd',
      'stx.com.sg': 'STX OSV Holdings Ltd',
      'jardines.com': 'Jardine Matheson Holdings Ltd',
      'hyflux.com': 'Hyflux Ltd',
    };

    // Check if we have a known mapping for this domain
    const fullDomain = domain.toLowerCase();
    if (knownCompanies[fullDomain]) {
      return knownCompanies[fullDomain];
    }

    // Fallback to generic domain parsing
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .split('.')[0];

    return cleanDomain
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  private isValidCompanyName(name: string): boolean {
    if (!name || name.length < 3 || name.length > 100) return false; // Reduced back to 3 characters

    // Global brand validation: Allow well-known company names without legal suffixes
    const globalBrands = /\b(shell|bmw|volkswagen|bosch|mercedes|toyota|honda|samsung|sony|microsoft|apple|google|amazon|facebook|tesla|netflix|nike|adidas|coca-cola|pepsi|mcdonalds|walmart|target|costco|ikea|h&m|zara|uniqlo)\b/i;
    if (globalBrands.test(name)) {
      return true; // Global brands are always valid
    }

    // Tech-friendly validation: Allow "SecureVision" and similar tech company names
    const techKeywords = /\b(secure|vision|tech|data|cloud|app|digital|software|systems|platform|solutions|analytics|cyber|smart|safe|shield|guard|protect)\b/i;
    if (techKeywords.test(name)) {
      return true; // Skip strict validation for tech company names
    }

    // Government domains: Allow shorter names for government entities
    const govPatterns = /\b(council|ministry|department|agency|authority|commission|bureau|office|gov|government)\b/i;
    if (govPatterns.test(name)) {
      return true; // Government entities often have shorter names
    }

    // ENHANCED: Reject Brazilian/Portuguese fragments and invalid patterns
    const invalidPatterns = [
      // Brazilian fragments
      /^(o|br|ticos|do|da|de|dos|das)\s/i, // Portuguese articles/fragments
      /\s+(o|br|do|da|de|dos|das)$/i, // Ending with Portuguese articles
      /^(o|br|ticos)\s+(s\.a\.|ltda|sa|limitada)/i, // Fragment + suffix only

      // Generic business terms
      /^(solutions|technology|systems|platform|global|worldwide|leading|premier)$/i,
      /^(company|business|enterprise|organization|corporation)$/i,
      /^(website|homepage|main|official|portal)$/i,
      /due to several reasons/i,
      /access denied/i,
      /blocked/i,
      /error/i,
      /page not found/i,
      /404/i,
      /403/i,
      /unauthorized/i,
      /world leader in/i,
      /global leader in/i,
      /spend less\. smile more/i,
      /investor relations/i,
      /pay, send and save/i,
      /^(home|about|contact|login|register|sign|error|404|403|500|page)$/i,
      /^(the|a|an|and|or|but|in|on|at|to|for|of|with|by)$/i,
      /^\d+$/,
      /^[^\w\s]+$/,
      /our business is/i,
      /client challenge/i,
      /grocery store/i,
      /industrial intelligence/i,
      /microscopes and imaging/i,
      /together for medicines/i,
      /print and packaging/i,
      /sample to insight/i,
      /drug packaging/i,
      /vacuum technology/i,
      /technology partner/i,
      /deine brille/i,
      /europas internet/i,
      /perfect silicon solutions/i,
      /global leader in energy/i,
      /global lubrication solutions/i,

      // Only legal suffix patterns
      /^(inc|ltd|llc|corp|co|company|corporation|limited|ltda|s\.a\.|sa)$/i,
    ];

    return !invalidPatterns.some(pattern => pattern.test(name.trim()));
  }

  private isMarketingContent(text: string): boolean {
    const marketingPatterns = [
      /our business is/i,
      /client challenge/i,
      /grocery store/i,
      /perfect silicon solutions/i,
      /global leader in/i,
      /global lubrication/i,
      /energy technology/i,
      /industrial intelligence/i,
      /microscopes and imaging/i,
      /together for medicines/i,
      /print and packaging/i,
      /sample to insight/i,
      /drug packaging/i,
      /vacuum technology/i,
      /technology partner/i,
      /solutions beyond/i,
      /meal kits/i,
      /digital workplace/i,
      /personal banking/i,
      /re\(ai\)magining the world/i,
      /buy cosmetics products/i,
      /savings accounts/i,
      /integrated logistics/i,
      /express parcel/i,
      /leading global pharmaceutical/i,
      /official website/i,
      /maruti suzuki cars/i,
      /the mahindra group/i,
    ];

    return marketingPatterns.some(pattern => pattern.test(text.trim()));
  }

  private hasLegalSuffix(companyName: string): boolean {
    const legalSuffixes = /\b(Inc\.?|Incorporated|LLC|L\.L\.C\.|Corp\.?|Corporation|Ltd\.?|Limited|Company|Co\.?|Group|Holdings|P\.C\.|PC|PLLC|P\.L\.L\.C\.|LP|L\.P\.|LLP|L\.L\.P\.|LLLP|L\.L\.L\.P\.|Co-op|Cooperative|Trust|Association|Ltée|plc|PLC|DAC|CLG|UC|ULC|Society|GmbH|AG|UG|KG|GmbH\s*&\s*Co\.\s*KG|OHG|GbR|e\.K\.|eG|SE|Stiftung|e\.V\.|gGmbH|gAG|Pvt\.?\s*Ltd\.?|Private\s*Limited|SARL|SA|SAS|SNC|SCS|SCA|EURL|SC|SCOP|GIE|SEM|Fondation|Ltda\.?|Limitada|SLU|EIRELI|MEI|Coop|Cooperativa|SCA|OSC|Fundação|Associação|S\.p\.A\.|S\.r\.l\.|S\.r\.l\.s\.|S\.n\.c\.|S\.a\.s\.|S\.a\.p\.a\.|Soc\.\s*Coop\.|Società\s*Cooperativa|Fondazione|S\.A\.|S\.A\.\s*de\s*C\.V\.|S\.\s*de\s*R\.L\.|S\.\s*de\s*R\.L\.\s*de\s*C\.V\.|S\.\s*en\s*C\.|S\.\s*en\s*C\.\s*por\s*A\.|S\.C\.|A\.C\.|I\.A\.P\.|S\.A\.P\.I\.|S\.A\.P\.I\.\s*de\s*C\.V\.)\b/i;
    const hasValidSuffix = legalSuffixes.test(companyName);
    console.log(`SUFFIX CHECK: "${companyName}" has legal suffix: ${hasValidSuffix}`);
    return hasValidSuffix;
  }

  private extractCompanyFromAboutText(text: string): string | null {
    // Look for patterns like "We are XYZ Company" or "XYZ Corp is a leading..."
    // Include US, German, French, Mexican, and Indian legal entity suffixes
    const legalSuffixes = "Inc\.?|Incorporated|Corp\.?|Corporation|Company|Ltd\.?|Limited|LLC|L\.L\.C\.|P\.C\.|PC|PLLC|P\.L\.L\.C\.|LP|L\.P\.|LLP|L\.L\.P\.|LLLP|L\.L\.L\.P\.|Co-op|Cooperative|Trust|Association|plc|GmbH|AG|UG|KG|OHG|GbR|e\.K\.|eG|SE|Stiftung|e\.V\.|gGmbH|gAG|SARL|SA|SAS|SNC|SCS|SCA|EURL|SC|SCOP|GIE|SEM|Fondation|S\.A\.|S\.A\.\s*de\s*C\.V\.|S\.\s*de\s*R\.L\.|S\.\s*de\s*R\.L\.\s*de\s*C\.V\.|S\.\s*en\s*C\.|S\.\s*en\s*C\.\s*por\s*A\.|S\.C\.|A\.C\.|I\.A\.P\.|S\.A\.P\.I\.|S\.A\.P\.I\.\s*de\s*C\.V\.|Pvt\.?\s*Ltd\.?|Private\s*Limited";
    const patterns = [
      new RegExp(`(?:we are|about)\\s+([A-Z][a-zA-Z\\s&.,'-]+(?:${legalSuffixes}))`, 'i'),
      new RegExp(`^([A-Z][a-zA-Z\\s&.,'-]+(?:${legalSuffixes}))\\s+(?:is|was|provides|offers|specializes)`, 'i'),
      new RegExp(`(?:founded|established|created)\\s+([A-Z][a-zA-Z\\s&.,'-]+(?:${legalSuffixes}))`, 'i')
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const companyName = match[1].trim();
        if (companyName.length > 3 && companyName.length < 80) {
          return companyName;
        }
      }
    }

    return null;
  }

  private extractCompanyFromLegalText(text: string): string | null {
    // Look for legal entity mentions in terms/legal text
    // Include US, German, French, Mexican, and Indian legal entity suffixes
    const legalSuffixes = "Inc\.?|Incorporated|Corp\.?|Corporation|Company|Ltd\.?|Limited|LLC|L\.L\.C\.|P\.C\.|PC|PLLC|P\.L\.L\.C\.|LP|L\.P\.|LLP|L\.L\.P\.|LLLP|L\.L\.L\.P\.|Co-op|Cooperative|Trust|Association|plc|GmbH|AG|UG|KG|OHG|GbR|e\.K\.|eG|SE|Stiftung|e\.V\.|gGmbH|gAG|SARL|SA|SAS|SNC|SCS|SCA|EURL|SC|SCOP|GIE|SEM|Fondation|S\.A\.|S\.A\.\s*de\s*C\.V\.|S\.\s*de\s*R\.L\.|S\.\s*de\s*R\.L\.\s*de\s*C\.V\.|S\.\s*en\s*C\.|S\.\s*en\s*C\.\s*por\s*A\.|S\.C\.|A\.C\.|I\.A\.P\.|S\.A\.P\.I\.|S\.A\.P\.I\.\s*de\s*C\.V\.|Pvt\.?\s*Ltd\.?|Private\s*Limited";
    const patterns = [
      new RegExp(`(?:this agreement|these terms).*?(?:between you and|with)\\s+([A-Z][a-zA-Z\\s&.,'-]+(?:${legalSuffixes}))`, 'i'),
      new RegExp(`(?:copyright|©|all rights reserved).*?(\\d{4}).*?([A-Z][a-zA-Z\\s&.,'-]+(?:${legalSuffixes}))`, 'i'),
      new RegExp(`^([A-Z][a-zA-Z\\s&.,'-]+(?:${legalSuffixes})).*?(?:owns|operates|maintains)`, 'i')
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const companyName = match[match.length - 1].trim(); // Get the last capture group (company name)
        if (companyName && companyName.length > 3 && companyName.length < 80) {
          return companyName;
        }
      }
    }

    return null;
  }

  private calculateConfidence(companyName: string, method: string): number {
    // Get base confidence from extraction method configuration
    const extractionMethod = EXTRACTION_METHODS[method] || EXTRACTION_METHODS.domain_parse;
    let confidence = extractionMethod.confidence;

    // Calculate using centralized confidence system
    const hasLegalSuffix = this.hasLegalSuffix(companyName);
    const isMarketing = isMarketingContent(companyName);
    const wordCount = companyName.split(/\s+/).length;

    confidence = calculateConfidence(
      confidence,
      hasLegalSuffix,
      isMarketing,
      wordCount,
      false, // isExpectedEntity - not implemented in this context
      false  // domainMatch - not implemented in this context
    );

    console.log(`CONFIDENCE CALCULATION: "${companyName}" method="${method}" base=${extractionMethod.confidence} final=${confidence}`);

    return confidence;
  }

  private extractFromFooterCopyright($: any, domain: string): ExtractionResult {
    const country = this.getCountryFromTLD(domain);
    const legalSuffixes = country ? this.getCountryLegalSuffixes(country) : this.getCountryLegalSuffixes('usa');
    const domainStems = this.extractDomainStem(domain);

    const footerSelectors = [
      'footer',
      '.footer',
      '#footer',
      '[class*="footer"]',
      '[id*="footer"]',
      '.site-footer',
      '.page-footer',
      '.copyright',
      '[class*="copyright"]',
      '[id*="copyright"]'
    ];

    let footerText = '';
    for (const selector of footerSelectors) {
      footerText += ' ' + $(selector).text();
    }

    // Also check bottom of page content for copyright notices
    const bodyText = $('body').text();
    const bottomText = bodyText.slice(-2000); // Last 2000 characters
    const combinedText = footerText + ' ' + bottomText;

    console.log(`ENHANCED FOOTER: Processing ${domain} - Footer text length: ${footerText.length}`);

    // Early exit for minimal content to prevent infinite loops
    if (footerText.length < 50) {
      console.log(`ENHANCED FOOTER: Skipping ${domain} - insufficient footer content (${footerText.length} chars)`);
      return { companyName: null, method: 'footer_copyright', confidence: 0 };
    }

    // ENHANCED: Dual-layer footer search with expected entity names

    // Method 1: Expected entity names + legal suffixes (98% confidence)
    const expectedEntityNames = this.generateExpectedEntityNames(domainStems);
    console.log(`ENHANCED FOOTER: Expected entities for ${domain}: ${expectedEntityNames.join(', ')}`);

    for (const expectedName of expectedEntityNames) {
      for (const suffix of legalSuffixes.slice(0, 10)) { // Limit to first 10 suffixes to prevent infinite loops
        const patterns = [
          new RegExp(`\\b${this.escapeRegex(expectedName)}\\s+${this.escapeRegex(suffix)}\\b`, 'i'),
          new RegExp(`\\b${this.escapeRegex(expectedName)}\\s*${this.escapeRegex(suffix)}\\b`, 'i'),
          new RegExp(`\\b${this.escapeRegex(expectedName)}[,\\s]*${this.escapeRegex(suffix)}\\b`, 'i')
        ];

        for (const pattern of patterns) {
          const match = combinedText.match(pattern);
          if (match) {
            const companyName = match[0].trim();
            console.log(`ENHANCED FOOTER: Found expected entity "${companyName}" from "${expectedName}" + "${suffix}"`);
            return {
              companyName: this.cleanCompanyName(companyName),
              method: 'footer_copyright',
              confidence: 98 // Highest confidence for expected entity + legal suffix match
            };
          }
        }
      }
    }

    // Enhanced targeted search approach - NEW INTELLIGENCE
    const targetedResult = this.searchFooterForLegalEntity(combinedText, domainStems, legalSuffixes, country);
    if (targetedResult) {
      return {
        companyName: targetedResult.companyName,
        method: 'footer_copyright',
        confidence: targetedResult.confidence
      };
    }

    // Fallback to enhanced copyright patterns with strict validation
    const legalEntityPatterns = [
      // Copyright with company name patterns - country-specific suffixes (FIXED: capture complete legal entities)
      new RegExp(`©\\s*\\d{4}[^A-Za-z]*([A-Z][\\w\\s&,.'-]+?(?:${legalSuffixes.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'i'),
      new RegExp(`copyright\\s*©?\\s*\\d{4}[^A-Za-z]*([A-Z][\\w\\s&,.'-]+?(?:${legalSuffixes.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'i'),
      // Year followed by company name with country-specific suffixes (FIXED: capture complete entities)
      new RegExp(`\\d{4}[^A-Za-z]*([A-Z][\\w\\s&,.'-]+?(?:${legalSuffixes.map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')}))`, 'i')
    ];

    for (const pattern of legalEntityPatterns) {
      const match = combinedText.match(pattern);
      if (match && match[1]) {
        let companyName = match[1].trim()
          .replace(/^\s*-\s*/, '')
          .replace(/\s*all rights reserved.*$/i, '')
          .replace(/\s*\.\s*$/, '')
          .replace(/\s*,\s*$/, '')
          .trim();

        // Clean up the extracted name
        companyName = this.cleanCompanyName(companyName);

        // Enhanced validation for footer extraction - allow longer names for complex entities
        if (companyName && 
            companyName.length <= 80 && 
            companyName.length >= 8 &&
            !companyName.includes('{') && 
            !companyName.includes('}') && 
            !companyName.includes('javascript') &&
            !companyName.includes('html') &&
            !companyName.includes('css') &&
            !companyName.includes('padding') &&
            !companyName.includes('margin') &&
            !companyName.includes('width') &&
            !companyName.includes('height') &&
            !companyName.includes('display') &&
            !companyName.includes('position') &&
            !companyName.includes('opacity') &&
            !companyName.includes('overflow') &&
            !companyName.toLowerCase().includes('toggle') &&
            !companyName.toLowerCase().includes('menu') &&
            !companyName.toLowerCase().includes('button') &&
            !companyName.toLowerCase().includes('click') &&
            !companyName.toLowerCase().includes('loading') &&
            !companyName.toLowerCase().includes('class') &&
            !companyName.toLowerCase().includes('forminator') &&
            !companyName.toLowerCase().includes('message') &&
            !companyName.toLowerCase().includes('elementor') &&
            !companyName.toLowerCase().includes('copyright') &&
            !companyName.toLowerCase().includes('copy right') &&
            !companyName.includes('""') &&
            !companyName.includes('=') &&
            !companyName.includes(':') &&
            !/^\d+$/.test(companyName) &&
            companyName.length >= 8 &&
            !companyName.match(/^[a-z]{3,10}$/) &&
            !companyName.toLowerCase().includes('fluid') &&
            !companyName.toLowerCase().includes('legacy') &&
            !companyName.toLowerCase().includes('backg') &&
            !companyName.toLowerCase().includes('auto') &&
            !companyName.includes("'") &&
            !companyName.includes('(') &&
            !companyName.includes(')') &&
            this.isValidCompanyName(companyName) && 
            !this.isMarketingContent(companyName)) {

          return {
            companyName,
            method: 'footer_copyright',
            confidence: this.calculateConfidence(companyName, 'footer_copyright')
          };
        }
      }
    }

    return { companyName: null, method: 'footer_copyright', confidence: 0 };
  }

  private searchFooterForLegalEntity(footerText: string, domainStems: string[], legalSuffixes: string[], country: string | null): { companyName: string; confidence: number } | null {
    // ENHANCED METHOD: Search for expected entity names + legal suffixes (NEW APPROACH)
    const expectedEntityNames = this.generateExpectedEntityNames(domainStems);

    // Method 1: Expected entity names + legal suffixes (HIGHEST PRIORITY)
    for (const expectedName of expectedEntityNames) {
      for (const suffix of legalSuffixes) {
        // Look for expected entity name + legal suffix
        const pattern = new RegExp(`\\b${this.escapeRegex(expectedName)}\\s*${this.escapeRegex(suffix)}\\b`, 'i');
        const match = footerText.match(pattern);

        if (match) {
          const foundEntity = match[0].trim();
          console.log(`ENHANCED SUCCESS: Found "${foundEntity}" using expected name "${expectedName}" + ${country} suffix "${suffix}"`);
          return {
            companyName: foundEntity,
            confidence: 98 // Highest confidence for expected name matches
          };
        }
      }
    }

    // Method 2: Domain stems + legal suffixes (EXISTING APPROACH)
    for (const stem of domainStems) {
      for (const suffix of legalSuffixes) {
        // Pattern 1: Exact stem + suffix match (improved to avoid fragments)
        const exactPattern = new RegExp(`\\b${this.escapeRegex(stem)}(?:[\\s][A-Z][\\w&-]*){0,2}\\s+${this.escapeRegex(suffix)}\\b`, 'gi');
        const exactMatch = footerText.match(exactPattern);
        if (exactMatch) {
          const companyName = this.cleanCompanyName(exactMatch[0]);
          if (companyName.split(' ').length >= 2 && // Require at least 2 words
              this.isValidCompanyName(companyName) && 
              !this.isMarketingContent(companyName)) {
            console.log(`JURISDICTION SUCCESS: Found "${companyName}" using ${country} suffix "${suffix}" for domain stem "${stem}"`);
            return { companyName, confidence: 95 }; // High confidence for exact match
          }
        }

        // Pattern 2: Fuzzy stem match + suffix
        const fuzzyPattern = new RegExp(`\\b\\w*${this.escapeRegex(stem)}\\w*[\\s\\w]*?\\b${this.escapeRegex(suffix)}\\b`, 'gi');
        const fuzzyMatch = footerText.match(fuzzyPattern);
        if (fuzzyMatch) {
          const companyName = this.cleanCompanyName(fuzzyMatch[0]);
          if (this.isValidCompanyName(companyName) && !this.isMarketingContent(companyName)) {
            return { companyName, confidence: 85 }; // Medium confidence for fuzzy match
          }
        }
      }
    }

    // Pattern 3: Look for complete company names with legal suffix (improved matching)
    for (const suffix of legalSuffixes) {
      // More precise pattern: 2-4 words before suffix, avoiding fragments
      const suffixPattern = new RegExp(`\\b(?:[A-Z][\\w&-]*\\s+){1,3}[A-Z][\\w&-]*\\s+${this.escapeRegex(suffix)}\\b`, 'gi');
      const suffixMatches = footerText.match(suffixPattern);
      if (suffixMatches) {
        for (const match of suffixMatches) {
          const companyName = this.cleanCompanyName(match);
          if (companyName.split(' ').length >= 2 && // At least 2 words
              this.isValidCompanyName(companyName) && 
              !this.isMarketingContent(companyName)) {
            console.log(`SUFFIX MATCH: Found complete entity "${companyName}" with ${suffix}`);
            return { companyName, confidence: 75 }; // Lower confidence for generic suffix match
          }
        }
      }
    }

    return null;
  }

  private escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private generateExpectedEntityNames(domainStems: string[]): string[] {
    const expectedNames: string[] = [];

    // Convert domain stems to expected company name formats
    for (const stem of domainStems) {
      // Convert hyphenated stems to space-separated names (e.g., "mcinc-products" → "Mcinc Products")
      if (stem.includes('-')) {
        const spacedName = stem.split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join(' ');
        expectedNames.push(spacedName);
        console.log(`Generated expected entity name: "${spacedName}" from stem "${stem}"`);
      }

      // Convert underscore stems to space-separated names (e.g., "abc_corp" → "Abc Corp")
      if (stem.includes('_')) {
        const spacedName = stem.split('_')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
          .join(' ');
        expectedNames.push(spacedName);
        console.log(`Generated expected entity name: "${spacedName}" from stem "${stem}"`);
      }

      // Add capitalized single word names
      const capitalizedStem = stem.charAt(0).toUpperCase() + stem.slice(1).toLowerCase();
      expectedNames.push(capitalizedStem);
    }

    return Array.from(new Set(expectedNames)); // Remove duplicates
  }

  private classifyFailure(result: ExtractionResult, domain: string): ExtractionResult {
    const attempts = result.extractionAttempts || [];

    // Analyze extraction attempts to determine failure category
    if (result.connectivity === 'unreachable') {
      return {
        ...result,
        failureCategory: 'bad_website_skip',
        technicalDetails: 'Network connectivity failed - DNS, SSL, or server issues',
        recommendation: 'Skip - Website unusable for business research'
      };
    }

    if (result.connectivity === 'protected') {
      return {
        ...result,
        failureCategory: 'protected_manual_review',
        technicalDetails: 'Anti-bot protection detected - Cloudflare, CAPTCHA, or rate limiting',
        recommendation: 'Manual review needed - Use browser or proxy'
      };
    }

    // Check if we found company information but it failed validation
    const foundCompanyNames = attempts.filter(a => a.companyName && a.companyName.length > 0);
    const isTechDomain = /\.(io|ai|tech|app|cloud)$/.test(domain);

    if (foundCompanyNames.length > 0) {
      const bestAttempt = foundCompanyNames.reduce((best, current) => 
        (current.confidence || 0) > (best.confidence || 0) ? current : best
      );

      // Check if it's a tech company that failed legal suffix validation
      if (isTechDomain || /\b(secure|vision|tech|data|cloud|app|digital|software|cyber)\b/i.test(bestAttempt.companyName || '')) {
        return {
          ...result,
          failureCategory: 'good_target_tech_issue',
          technicalDetails: `Company identified as "${bestAttempt.companyName}" but failed validation (${bestAttempt.error || 'legal suffix missing'})`,
          recommendation: 'Manual review - Likely valid tech company without traditional legal entity structure'
        };
      }

      return {
        ...result,
        failureCategory: 'incomplete_low_priority',
        technicalDetails: `Partial extraction found "${bestAttempt.companyName}" with ${bestAttempt.confidence}% confidence`,
        recommendation: 'Low priority - Company name detected but quality concerns'
      };
    }

    // No company information found at all
    const hasBusinessContent = attempts.some(a => 
      a.error?.includes('marketing') || 
      a.error?.includes('generic') ||
      domain.includes('blog') || 
      domain.includes('personal')
    );

    if (hasBusinessContent) {
      return {
        ...result,
        failureCategory: 'no_corporate_presence',
        technicalDetails: 'Website accessible but appears to be personal, blog, or non-business content',
        recommendation: 'Skip - Not a viable business target'
      };
    }

    return {
      ...result,
      failureCategory: 'incomplete_low_priority',
      technicalDetails: 'Website accessible but no company information patterns detected',
      recommendation: 'Low priority - May require specialized extraction methods'
    };
  }

  private async checkConnectivity(domain: string): Promise<'reachable' | 'unreachable' | 'protected' | 'unknown'> {
    try {
      // Quick HTTP HEAD request (faster than GET, saves bandwidth)
      const response = await axios.head(`https://${domain}`, {
        timeout: 2000, // Ultra-fast 2-second timeout for faster bot detection
        headers: { 'User-Agent': this.userAgent },
        validateStatus: () => true, // Accept any status code
        maxRedirects: 2 // Reduced redirects for speed
      });

      // ENHANCED CLOUDFLARE DETECTION - Multi-layer approach
      const isCloudflareProtected = this.detectCloudflareProtection(response);
      if (isCloudflareProtected) {
        console.log(`CLOUDFLARE DETECTED: ${domain} - Protected by anti-bot measures`);
        return 'protected';
      }

      // Check for other anti-bot protection
      if (response.status === 403 || 
          response.data?.includes('challenge') ||
          response.data?.includes('captcha') ||
          response.data?.includes('blocked')) {
        return 'protected';
      }

      return response.status < 500 ? 'reachable' : 'unreachable';
    } catch (error: any) {
      // Network failures indicate unreachable domains
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED' || 
          error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED' || 
          error.code === 'ECONNRESET') {
        return 'unreachable';
      }

      // SSL certificate errors - mark as unreachable for bad certificates
      if (error.code === 'ERR_TLS_CERT_ALTNAME_INVALID' || error.code === 'CERT_HAS_EXPIRED' ||
          error.code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' || error.code === 'SELF_SIGNED_CERT_IN_CHAIN') {
        return 'unreachable';
      }

      // For other errors (like HTTP method not allowed), try HTTP fallback
      try {
        const httpResponse = await axios.head(`http://${domain}`, {
          timeout: 2000, // Ultra-fast HTTP fallback
          headers: { 'User-Agent': this.userAgent },
          validateStatus: () => true,
          maxRedirects: 3
        });

        return httpResponse.status < 500 ? 'reachable' : 'unreachable';
      } catch (httpError: any) {
        // If HTTP also fails with network errors, mark unreachable
        if (httpError.code === 'ENOTFOUND' || httpError.code === 'ECONNREFUSED' || 
            httpError.code === 'ETIMEDOUT' || httpError.code === 'ECONNABORTED' ||
            httpError.code === 'ECONNRESET') {
          return 'unreachable';
        }

        // If it's just method issues, assume reachable
        return 'reachable';
      }
    }
  }
}