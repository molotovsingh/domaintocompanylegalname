
import axios from 'axios';
import * as cheerio from 'cheerio';

interface AxiosCheerioResult {
  companyName: string | null;
  confidence: number;
  success: boolean;
  error: string | null;
  extractionMethod: string | null;
  technicalDetails: string | null;
  processingTime: number;
}

export class AxiosCheerioExtractor {
  private axiosConfig = {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };

  async extractFromDomain(domain: string): Promise<AxiosCheerioResult> {
    const startTime = Date.now();

    try {
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
      const response = await axios.get(url, this.axiosConfig);
      const $ = cheerio.load(response.data);

      // Extract company name using various selectors
      let companyName: string | null = null;
      let extractionMethod: string | null = null;
      let confidence = 0;

      // Strategy 1: Meta tags
      const metaTags = [
        'meta[property="og:site_name"]',
        'meta[name="application-name"]',
        'meta[name="author"]',
        'meta[property="og:title"]'
      ];

      for (const selector of metaTags) {
        const content = $(selector).attr('content');
        if (content && content.trim()) {
          companyName = content.trim();
          extractionMethod = `meta_tag_${selector}`;
          confidence = 85;
          break;
        }
      }

      // Strategy 2: Title tag
      if (!companyName) {
        const title = $('title').text().trim();
        if (title && title !== 'Example Domain') {
          companyName = title.split('|')[0].split('-')[0].trim();
          extractionMethod = 'title_tag';
          confidence = 70;
        }
      }

      // Strategy 3: Header selectors
      if (!companyName) {
        const headerSelectors = ['h1', '.logo', '#logo', '.brand', '.company-name'];
        for (const selector of headerSelectors) {
          const text = $(selector).first().text().trim();
          if (text && text.length > 2 && text.length < 100) {
            companyName = text;
            extractionMethod = `header_${selector}`;
            confidence = 65;
            break;
          }
        }
      }

      const processingTime = Date.now() - startTime;

      return {
        companyName,
        confidence,
        success: !!companyName,
        error: null,
        extractionMethod,
        technicalDetails: `HTTP ${response.status}, Content-Length: ${response.data.length}, Processing: ${processingTime}ms`,
        processingTime
      };

    } catch (error: any) {
      const processingTime = Date.now() - startTime;
      
      return {
        companyName: null,
        confidence: 0,
        success: false,
        error: error.message,
        extractionMethod: null,
        technicalDetails: `Error after ${processingTime}ms: ${error.message}`,
        processingTime
      };
    }
  }
}
