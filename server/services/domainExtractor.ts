import axios from 'axios';
import * as cheerio from 'cheerio';

export interface ExtractionResult {
  companyName: string | null;
  method: 'html_title' | 'meta_description' | 'domain_parse';
  confidence: number;
  error?: string;
}

export class DomainExtractor {
  private timeout = 10000; // 10 seconds
  private userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36';

  async extractCompanyName(domain: string): Promise<ExtractionResult> {
    try {
      // Ensure domain has protocol
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      
      // Try HTML extraction first
      const htmlResult = await this.extractFromHTML(url);
      if (htmlResult.companyName) {
        return htmlResult;
      }
      
      // Fallback to domain parsing
      return this.extractFromDomain(domain);
    } catch (error) {
      // Fallback to domain parsing on any error
      return this.extractFromDomain(domain);
    }
  }

  private async extractFromHTML(url: string): Promise<ExtractionResult> {
    try {
      const response = await axios.get(url, {
        timeout: this.timeout,
        headers: {
          'User-Agent': this.userAgent,
        },
        maxRedirects: 5,
      });

      const $ = cheerio.load(response.data);
      
      // Try title tag first
      const title = $('title').text().trim();
      if (title) {
        const companyName = this.cleanCompanyName(title);
        if (companyName && this.isValidCompanyName(companyName)) {
          return {
            companyName,
            method: 'html_title',
            confidence: this.calculateConfidence(companyName, 'html_title'),
          };
        }
      }
      
      // Try meta description
      const metaDescription = $('meta[name="description"]').attr('content');
      if (metaDescription) {
        const companyName = this.extractCompanyFromText(metaDescription);
        if (companyName && this.isValidCompanyName(companyName)) {
          return {
            companyName,
            method: 'meta_description',
            confidence: this.calculateConfidence(companyName, 'meta_description'),
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
              confidence: this.calculateConfidence(companyName, 'html_title', url.replace(/^https?:\/\//, '')) - 10,
            };
          }
        }
      }
      
      return { companyName: null, method: 'html_title', confidence: 0 };
    } catch (error) {
      return { 
        companyName: null, 
        method: 'html_title', 
        confidence: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private extractFromDomain(domain: string): ExtractionResult {
    // Remove protocol and www
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];
    
    // Convert to company name format using our known mappings
    const companyName = this.domainToCompanyName(cleanDomain);
    
    return {
      companyName,
      method: 'domain_parse',
      confidence: this.calculateConfidence(companyName, 'domain_parse', cleanDomain),
    };
  }

  private cleanCompanyName(text: string): string {
    // Remove common suffixes and prefixes
    return text
      .replace(/\s*-\s*.*$/, '') // Remove everything after dash
      .replace(/\s*\|\s*.*$/, '') // Remove everything after pipe
      .replace(/\s*:.*$/, '') // Remove everything after colon
      .replace(/^(Home|Welcome to|About)\s*/i, '') // Remove common prefixes
      .replace(/\s*(Inc|LLC|Ltd|Corp|Corporation|Company|Co)\.?$/i, '') // Remove company suffixes
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
      'muyuanfoods.com': 'Muyuan Foods Co. Ltd.',
      'jsbchina.cn': 'Jiangsu Bank Co. Ltd.',
      'citicbank.com': 'China CITIC Bank Corp. Ltd.',
      'haitian.com': 'Haitian International Holdings Ltd.',
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
    if (!name || name.length < 2 || name.length > 100) return false;
    
    // Check for common invalid patterns
    const invalidPatterns = [
      /^(home|about|contact|login|register|sign|error|404|403|500)$/i,
      /^(the|a|an|and|or|but|in|on|at|to|for|of|with|by)$/i,
      /^\d+$/,
      /^[^\w\s]+$/,
    ];
    
    return !invalidPatterns.some(pattern => pattern.test(name.trim()));
  }

  private extractCompanyFromAboutText(text: string): string | null {
    // Look for patterns like "We are XYZ Company" or "XYZ Corp is a leading..."
    const patterns = [
      /(?:we are|about)\s+([A-Z][a-zA-Z\s&.,'-]+(?:Inc\.?|Corp\.?|Corporation|Company|Ltd\.?|Limited|LLC|LP|LLP|plc))/i,
      /^([A-Z][a-zA-Z\s&.,'-]+(?:Inc\.?|Corp\.?|Corporation|Company|Ltd\.?|Limited|LLC|LP|LLP|plc))\s+(?:is|was|provides|offers|specializes)/i,
      /(?:founded|established|created)\s+([A-Z][a-zA-Z\s&.,'-]+(?:Inc\.?|Corp\.?|Corporation|Company|Ltd\.?|Limited|LLC|LP|LLP|plc))/i
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
    const patterns = [
      /(?:this agreement|these terms).*?(?:between you and|with)\s+([A-Z][a-zA-Z\s&.,'-]+(?:Inc\.?|Corp\.?|Corporation|Company|Ltd\.?|Limited|LLC|LP|LLP|plc))/i,
      /(?:copyright|©|all rights reserved).*?(\d{4}).*?([A-Z][a-zA-Z\s&.,'-]+(?:Inc\.?|Corp\.?|Corporation|Company|Ltd\.?|Limited|LLC|LP|LLP|plc))/i,
      /^([A-Z][a-zA-Z\s&.,'-]+(?:Inc\.?|Corp\.?|Corporation|Company|Ltd\.?|Limited|LLC|LP|LLP|plc)).*?(?:owns|operates|maintains)/i
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
    let confidence = 50; // Base confidence
    
    // Method-based confidence
    switch (method) {
      case 'html_title':
        confidence += 30;
        break;
      case 'meta_description':
        confidence += 20;
        break;
      case 'domain_parse':
        confidence += 10;
        break;
    }
    
    // Length-based confidence
    if (companyName.length >= 3 && companyName.length <= 30) {
      confidence += 10;
    }
    
    // Word count confidence
    const wordCount = companyName.split(/\s+/).length;
    if (wordCount >= 1 && wordCount <= 4) {
      confidence += 10;
    }
    
    // Capitalization confidence
    if (/^[A-Z]/.test(companyName)) {
      confidence += 5;
    }
    
    return Math.min(confidence, 100);
  }
}
