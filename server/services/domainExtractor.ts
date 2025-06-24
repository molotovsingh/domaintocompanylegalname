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
      // ALWAYS check domain mappings first (overrides cache)
      const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].toLowerCase();
      const knownMappings = this.getKnownCompanyMappings();
      
      if (knownMappings[cleanDomain]) {
        return {
          companyName: knownMappings[cleanDomain],
          method: 'domain_parse',
          confidence: 95,
        };
      }

      // Try HTML extraction for unknown domains
      const url = domain.startsWith('http') ? domain : `https://${domain}`;
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

  private getKnownCompanyMappings(): Record<string, string> {
    return {
      // German Companies (corrected mappings)
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
      
      // Mexican Companies (when needed)
      // Major Mexican companies can be added here with proper legal entity suffixes
      // Examples: 'cemex.com': 'CEMEX S.A.B. de C.V.', 'femsa.com': 'FEMSA S.A. de C.V.', etc.
      
      // Brazilian Companies (when needed)
      // Major Brazilian companies can be added here with proper legal entity suffixes
      // Examples: 'petrobras.com': 'Petróleo Brasileiro S.A.', 'vale.com': 'Vale S.A.', etc.
      
      // Irish Companies (when needed)
      // Major Irish companies can be added here with proper legal entity suffixes
      // Examples: 'ryanair.com': 'Ryanair DAC', 'aib.ie': 'Allied Irish Banks PLC', etc.
      
      // Italian Companies (when needed)
      // Major Italian companies can be added here with proper legal entity suffixes
      // Examples: 'eni.com': 'Eni S.p.A.', 'telecomitalia.it': 'Telecom Italia S.p.A.', etc.
    };
  }

  private async extractFromHTML(url: string): Promise<ExtractionResult> {
    try {
      // First try the main page
      const mainResult = await this.extractFromPage(url);
      if (mainResult.companyName && this.isValidCompanyName(mainResult.companyName)) {
        return mainResult;
      }
      
      // If main page didn't work, try sub-pages
      const baseUrl = url.replace(/\/$/, '');
      const subPages = ['/about', '/about-us', '/company', '/terms', '/legal'];
      
      for (const subPath of subPages) {
        try {
          const subPageUrl = `${baseUrl}${subPath}`;
          const subResult = await this.extractFromPage(subPageUrl);
          if (subResult.companyName && this.isValidCompanyName(subResult.companyName)) {
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
    
    // Try About Us/Legal pages for unknown domains
    const subPageResult = await this.extractFromSubPages(url);
    if (subPageResult) {
      return subPageResult;
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
    
    // Convert to company name format using our known mappings
    const companyName = this.domainToCompanyName(cleanDomain);
    
    return {
      companyName,
      method: 'domain_parse',
      confidence: this.calculateConfidence(companyName, 'domain_parse', cleanDomain),
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
    if (!name || name.length < 2) return false;
    
    const invalidPatterns = [
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
    const legalSuffixes = /\b(Inc\.?|Incorporated|LLC|L\.L\.C\.|Corp\.?|Corporation|Ltd\.?|Limited|Company|Co\.?|Group|Holdings|P\.C\.|PC|PLLC|P\.L\.L\.C\.|LP|L\.P\.|LLP|L\.L\.P\.|LLLP|L\.L\.L\.P\.|Co-op|Cooperative|Trust|Association|Ltée|plc|PLC|DAC|CLG|UC|ULC|Society|GmbH|AG|UG|KG|OHG|GbR|e\.K\.|eG|SE|Stiftung|e\.V\.|gGmbH|gAG|Pvt\.?\s*Ltd\.?|Private\s*Limited|SARL|SA|SAS|SNC|SCS|SCA|EURL|SC|SCOP|GIE|SEM|Fondation|Ltda\.?|Limitada|SLU|EIRELI|MEI|Coop|Cooperativa|SCA|OSC|Fundação|Associação|S\.p\.A\.|S\.r\.l\.|S\.r\.l\.s\.|S\.n\.c\.|S\.a\.s\.|S\.a\.p\.a\.|Soc\.\s*Coop\.|Società\s*Cooperativa|Fondazione|S\.A\.|S\.A\.\s*de\s*C\.V\.|S\.\s*de\s*R\.L\.|S\.\s*de\s*R\.L\.\s*de\s*C\.V\.|S\.\s*en\s*C\.|S\.\s*en\s*C\.\s*por\s*A\.|S\.C\.|A\.C\.|I\.A\.P\.|S\.A\.P\.I\.|S\.A\.P\.I\.\s*de\s*C\.V\.)\b/i;
    return legalSuffixes.test(companyName);
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
    let confidence = 50; // Base confidence
    
    // Method-based confidence
    switch (method) {
      case 'html_about':
        confidence += 35; // High confidence for about sections
        break;
      case 'html_legal':
        confidence += 40; // Highest confidence for legal content
        break;
      case 'html_subpage':
        confidence += 30; // Good confidence for sub-pages
        break;
      // html_title method removed - unreliable source
      case 'meta_description':
        confidence += 20;
        break;
      case 'domain_parse':
        confidence += 10;
        break;
    }
    
    // Legal suffix bonus (strong indicator of proper company name)
    if (/\b(Inc\.?|Incorporated|LLC|L\.L\.C\.|Corp\.?|Corporation|Ltd\.?|Limited|Company|Co\.?|Group|Holdings|P\.C\.|PC|PLLC|P\.L\.L\.C\.|LP|L\.P\.|LLP|L\.L\.P\.|LLLP|L\.L\.L\.P\.|Co-op|Cooperative|Trust|Association|Ltée|plc|PLC|DAC|CLG|UC|ULC|Society|GmbH|AG|UG|KG|OHG|GbR|e\.K\.|eG|SE|Stiftung|e\.V\.|gGmbH|gAG|SARL|SA|SAS|SNC|SCS|SCA|EURL|SC|SCOP|GIE|SEM|Fondation|Ltda\.?|Limitada|SLU|EIRELI|MEI|Coop|Cooperativa|SCA|OSC|Fundação|Associação|S\.p\.A\.|S\.r\.l\.|S\.r\.l\.s\.|S\.n\.c\.|S\.a\.s\.|S\.a\.p\.a\.|Soc\.\s*Coop\.|Società\s*Cooperativa|Fondazione|S\.A\.|S\.A\.\s*de\s*C\.V\.|S\.\s*de\s*R\.L\.|S\.\s*de\s*R\.L\.\s*de\s*C\.V\.|S\.\s*en\s*C\.|S\.\s*en\s*C\.\s*por\s*A\.|S\.C\.|A\.C\.|I\.A\.P\.|S\.A\.P\.I\.|S\.A\.P\.I\.\s*de\s*C\.V\.)\b/i.test(companyName)) {
      confidence += 15;
    }
    
    // CRITICAL PENALTY: Missing legal suffix for corporate entities (global issue)
    // Absence of suffix either indicates extraction error or nonprofit status
    if (!this.hasLegalSuffix(companyName)) {
      // Check if this appears to be a for-profit corporate entity
      const isNonprofit = /\b(foundation|institute|university|hospital|school|college|museum|library|charity|association|society|council|federation|union|ministry|department|agency|bureau|commission|authority|board|center|centre)\b/i.test(companyName);
      const isPersonalName = /^[A-Z][a-z]+\s+[A-Z][a-z]+$/i.test(companyName);
      
      if (!isNonprofit && !isPersonalName && companyName.length > 2) {
        // Major penalty for missing legal suffix in corporate entities
        // Apply regardless of extraction method - this is a universal quality requirement
        confidence -= 25; // Severe penalty - this is a critical quality issue
      }
    }
    
    // Length-based confidence
    if (companyName.length >= 3 && companyName.length <= 40) {
      confidence += 10;
    }
    
    // Word count confidence
    const wordCount = companyName.split(/\s+/).length;
    if (wordCount >= 1 && wordCount <= 5) {
      confidence += 10;
    }
    
    // Capitalization confidence
    if (/^[A-Z]/.test(companyName)) {
      confidence += 5;
    }
    
    // Penalty for non-company-like content
    if (/\b(solutions|technology|systems|services|platform|global|worldwide|leading|premier)\b/i.test(companyName)) {
      confidence -= 20;
    }
    
    return Math.min(confidence, 100);
  }
}
