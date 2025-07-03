export interface LegalEntityCategory {
  suffixes: string[];
  description: string;
  confidence?: number;
  mandatory?: boolean;
}

export interface JurisdictionData {
  name: string;
  tlds: string[];
  entities: Record<string, LegalEntityCategory>;
  rules: string[];
  notes?: string[];
}

export const JURISDICTIONS: Record<string, JurisdictionData> = {
  us: {
    name: "United States",
    tlds: [".com", ".org", ".net", ".us"],
    entities: {
      corporations: {
        suffixes: ["Inc.", "Incorporated", "Corp.", "Corporation", "Company", "Co."],
        description: "Standard corporate entities",
        confidence: 95,
        mandatory: true
      },
      llc: {
        suffixes: ["LLC", "L.L.C.", "Limited"],
        description: "Limited liability companies",
        confidence: 95,
        mandatory: true
      },
      professional: {
        suffixes: ["P.C.", "PC", "PLLC", "P.L.L.C."],
        description: "Professional corporations and LLCs",
        confidence: 95,
        mandatory: true
      },
      partnerships: {
        suffixes: ["LP", "L.P.", "LLP", "L.L.P.", "LLLP", "L.L.L.P."],
        description: "Limited partnerships and liability partnerships",
        confidence: 95,
        mandatory: true
      },
      cooperatives: {
        suffixes: ["Co-op", "Cooperative"],
        description: "Cooperative organizations",
        confidence: 90,
        mandatory: false
      },
      other: {
        suffixes: ["Trust", "Holdings", "Group"],
        description: "Other business structures",
        confidence: 85,
        mandatory: false
      }
    },
    rules: [
      "Professional corporations (P.C.) required for licensed professionals (lawyers, doctors, accountants)",
      "Nonprofits (universities, hospitals, foundations) exempt from corporate suffixes",
      "State-specific variations exist for registration requirements"
    ]
  },

  canada: {
    name: "Canada",
    tlds: [".ca", ".com"],
    entities: {
      standard: {
        suffixes: ["Inc.", "Incorporated", "Ltd.", "Limited", "Corp.", "Corporation"],
        description: "Standard Canadian corporations",
        confidence: 95,
        mandatory: true
      },
      partnerships: {
        suffixes: ["LP", "L.P.", "LLP", "L.L.P."],
        description: "Limited partnerships",
        confidence: 95,
        mandatory: true
      },
      quebec: {
        suffixes: ["Ltée", "Limitée", "Inc.", "Incorporée"],
        description: "Quebec French variants",
        confidence: 95,
        mandatory: true
      },
      professional: {
        suffixes: ["P.C."],
        description: "Professional corporations",
        confidence: 95,
        mandatory: true
      },
      other: {
        suffixes: ["Co-op", "Cooperative", "Trust", "Society"],
        description: "Cooperatives and other entities",
        confidence: 85,
        mandatory: false
      }
    },
    rules: [
      "Quebec uses French variants (Ltée, Incorporée)",
      "Federal vs. provincial incorporation affects suffix requirements",
      "Professional corporations regulated by provincial law societies"
    ]
  },

  germany: {
    name: "Germany",
    tlds: [".de", ".com"],
    entities: {
      limited_liability: {
        suffixes: ["GmbH", "UG"],
        description: "Limited liability companies (Gesellschaft mit beschränkter Haftung, Unternehmergesellschaft)",
        confidence: 95,
        mandatory: true
      },
      stock_companies: {
        suffixes: ["AG", "SE"],
        description: "Stock companies (Aktiengesellschaft, Societas Europaea)",
        confidence: 95,
        mandatory: true
      },
      partnerships: {
        suffixes: ["KG", "OHG", "GbR", "GmbH & Co. KG"],
        description: "Partnerships (Kommanditgesellschaft, Offene Handelsgesellschaft)",
        confidence: 95,
        mandatory: true
      },
      nonprofit: {
        suffixes: ["e.V.", "gGmbH", "Stiftung", "gAG"],
        description: "Nonprofit entities (eingetragener Verein, gemeinnützige GmbH)",
        confidence: 90,
        mandatory: false
      },
      cooperative: {
        suffixes: ["eG"],
        description: "Registered cooperatives (eingetragene Genossenschaft)",
        confidence: 95,
        mandatory: true
      },
      other: {
        suffixes: ["e.K."],
        description: "Registered merchants (eingetragener Kaufmann)",
        confidence: 85,
        mandatory: false
      }
    },
    rules: [
      "GmbH requires minimum €25,000 capital, UG allows €1 minimum",
      "AG requires €50,000 minimum capital for stock companies",
      "e.V. for nonprofits, must have at least 7 founding members"
    ]
  },

  france: {
    name: "France",
    tlds: [".fr", ".com"],
    entities: {
      corporations: {
        suffixes: ["SA", "SE"],
        description: "Stock companies (Société Anonyme, Société Européenne)",
        confidence: 95,
        mandatory: true
      },
      limited_liability: {
        suffixes: ["SARL", "EURL", "SAS"],
        description: "Limited liability companies",
        confidence: 95,
        mandatory: true
      },
      partnerships: {
        suffixes: ["SNC", "SCS", "SCA"],
        description: "General and limited partnerships",
        confidence: 95,
        mandatory: true
      },
      cooperative: {
        suffixes: ["SC", "SCOP"],
        description: "Cooperative societies",
        confidence: 90,
        mandatory: true
      },
      nonprofit: {
        suffixes: ["Fondation", "Association"],
        description: "Foundations and associations",
        confidence: 85,
        mandatory: false
      },
      other: {
        suffixes: ["GIE", "SEM"],
        description: "Economic interest groups and mixed economy companies",
        confidence: 85,
        mandatory: false
      }
    },
    rules: [
      "SA requires minimum €37,000 capital",
      "SARL requires minimum €1 capital since 2003",
      "SAS provides more management flexibility than SA"
    ]
  },

  mexico: {
    name: "Mexico",
    tlds: [".mx", ".com.mx", ".com"],
    entities: {
      corporations: {
        suffixes: ["S.A.", "S.A. de C.V."],
        description: "Stock companies (Sociedad Anónima)",
        confidence: 95,
        mandatory: true
      },
      limited_liability: {
        suffixes: ["S. de R.L.", "S. de R.L. de C.V."],
        description: "Limited liability companies",
        confidence: 95,
        mandatory: true
      },
      partnerships: {
        suffixes: ["S. en C.", "S. en C. por A."],
        description: "Partnerships (Sociedad en Comandita)",
        confidence: 95,
        mandatory: true
      },
      cooperative: {
        suffixes: ["S.C."],
        description: "Cooperative societies",
        confidence: 90,
        mandatory: true
      },
      nonprofit: {
        suffixes: ["A.C.", "I.A.P."],
        description: "Civil associations and private assistance institutions",
        confidence: 85,
        mandatory: false
      },
      other: {
        suffixes: ["S.A.P.I.", "S.A.P.I. de C.V."],
        description: "Investment promotion companies",
        confidence: 95,
        mandatory: true
      }
    },
    rules: [
      "C.V. (Capital Variable) allows variable capital structure",
      "S.A. requires minimum 2 shareholders",
      "A.C. for nonprofit civil associations, I.A.P. for private assistance"
    ]
  },

  brazil: {
    name: "Brazil",
    tlds: [".br", ".com.br"],
    entities: {
      limited_liability: {
        suffixes: ["Ltda.", "Limitada", "SLU"],
        description: "Limited liability companies",
        confidence: 95,
        mandatory: true
      },
      stock_companies: {
        suffixes: ["S.A."],
        description: "Stock companies (Sociedade Anônima)",
        confidence: 95,
        mandatory: true
      },
      partnerships: {
        suffixes: ["SCA"],
        description: "Limited partnerships by shares",
        confidence: 95,
        mandatory: true
      },
      micro: {
        suffixes: ["MEI"],
        description: "Individual microentrepreneur",
        confidence: 90,
        mandatory: true
      },
      cooperative: {
        suffixes: ["Cooperativa", "Coop"],
        description: "Cooperative societies",
        confidence: 90,
        mandatory: false
      },
      nonprofit: {
        suffixes: ["Fundação", "Associação", "OSC"],
        description: "Foundations and civil society organizations",
        confidence: 85,
        mandatory: false
      }
    },
    rules: [
      "SLU replaced EIRELI in 2019 for single-member companies",
      "MEI for micro-entrepreneurs with simplified regulations",
      "Fundação requires government approval and endowment"
    ]
  },

  ireland: {
    name: "Ireland",
    tlds: [".ie", ".com"],
    entities: {
      private: {
        suffixes: ["Ltd", "Limited", "DAC"],
        description: "Private companies (Designated Activity Company)",
        confidence: 95,
        mandatory: true
      },
      public: {
        suffixes: ["PLC", "Public Limited Company"],
        description: "Public limited companies",
        confidence: 95,
        mandatory: true
      },
      nonprofit: {
        suffixes: ["CLG"],
        description: "Company limited by guarantee",
        confidence: 90,
        mandatory: true
      },
      unlimited: {
        suffixes: ["UC", "ULC"],
        description: "Unlimited companies",
        confidence: 95,
        mandatory: true
      },
      partnerships: {
        suffixes: ["LP"],
        description: "Limited partnerships",
        confidence: 95,
        mandatory: true
      },
      other: {
        suffixes: ["Society", "Trust", "Cooperative"],
        description: "Other entity types",
        confidence: 85,
        mandatory: false
      }
    },
    rules: [
      "DAC has specific object clauses (replaced unlimited objects)",
      "CLG for nonprofits without share capital",
      "ULC has unlimited liability but tax advantages for subsidiaries"
    ]
  },

  italy: {
    name: "Italy",
    tlds: [".it", ".com"],
    entities: {
      stock_companies: {
        suffixes: ["S.p.A."],
        description: "Stock companies (Società per Azioni)",
        confidence: 95,
        mandatory: true
      },
      limited_liability: {
        suffixes: ["S.r.l.", "S.r.l.s."],
        description: "Limited liability companies",
        confidence: 95,
        mandatory: true
      },
      partnerships: {
        suffixes: ["S.n.c.", "S.a.s.", "S.a.p.a."],
        description: "General and limited partnerships",
        confidence: 95,
        mandatory: true
      },
      cooperative: {
        suffixes: ["Soc. Coop.", "Società Cooperativa"],
        description: "Cooperative societies",
        confidence: 90,
        mandatory: true
      },
      nonprofit: {
        suffixes: ["Fondazione", "Associazione"],
        description: "Foundations and associations",
        confidence: 85,
        mandatory: false
      },
      other: {
        suffixes: ["Trust"],
        description: "Trusts (recognized under Hague Convention)",
        confidence: 85,
        mandatory: false
      }
    },
    rules: [
      "S.r.l.s. is simplified startup version with reduced capital requirements",
      "S.p.A. requires minimum €50,000 capital",
      "Trust recognized under Hague Convention but not Italian Civil Code entity"
    ]
  },

  taiwan: {
    name: "Taiwan",
    tlds: [".tw", ".com.tw", ".com"],
    entities: {
      corporations: {
        suffixes: ["Co., Ltd.", "Ltd.", "Corporation", "Corp.", "Inc."],
        description: "Standard corporations",
        confidence: 95,
        mandatory: true
      },
      partnerships: {
        suffixes: ["LP", "LLP"],
        description: "Limited partnerships",
        confidence: 95,
        mandatory: true
      },
      branch: {
        suffixes: ["Branch", "Taiwan Branch"],
        description: "Foreign company branches",
        confidence: 90,
        mandatory: true
      },
      nonprofit: {
        suffixes: ["Foundation", "Association"],
        description: "Nonprofit organizations",
        confidence: 85,
        mandatory: false
      },
      cooperative: {
        suffixes: ["Cooperative"],
        description: "Cooperative enterprises",
        confidence: 90,
        mandatory: false
      }
    },
    rules: [
      "Company Act requires corporate suffix for limited companies",
      "Foreign companies must register branch offices",
      "Minimum capital requirements vary by business type"
    ]
  },

  russia: {
    name: "Russia",
    tlds: [".ru", ".рф", ".com"],
    entities: {
      limited_liability: {
        suffixes: ["OOO", "ООО"],
        description: "Limited liability companies (Общество с ограниченной ответственностью)",
        confidence: 95,
        mandatory: true
      },
      joint_stock: {
        suffixes: ["AO", "АО", "PAO", "ПАО"],
        description: "Joint stock companies (Акционерное общество, Публичное АО)",
        confidence: 95,
        mandatory: true
      },
      individual: {
        suffixes: ["IP", "ИП"],
        description: "Individual entrepreneurs (Индивидуальный предприниматель)",
        confidence: 90,
        mandatory: true
      },
      nonprofit: {
        suffixes: ["ANO", "АНО"],
        description: "Autonomous nonprofit organizations",
        confidence: 85,
        mandatory: false
      },
      other: {
        suffixes: ["TNV", "PT", "PK", "Kooperativ", "Fond"],
        description: "Partnerships, cooperatives, and funds",
        confidence: 85,
        mandatory: false
      }
    },
    rules: [
      "Cyrillic and Latin alphabet variants both recognized",
      "PAO for publicly traded companies, AO for private",
      "IP for individual entrepreneurs with simplified taxation"
    ]
  },

  srilanka: {
    name: "Sri Lanka",
    tlds: [".lk", ".com"],
    entities: {
      private_limited: {
        suffixes: ["Pvt Ltd", "(Private) Limited", "Private Limited"],
        description: "Private limited companies",
        confidence: 95,
        mandatory: true
      },
      public_limited: {
        suffixes: ["PLC", "Public Limited Company"],
        description: "Public limited companies",
        confidence: 95,
        mandatory: true
      },
      limited: {
        suffixes: ["Ltd", "Limited"],
        description: "Limited companies",
        confidence: 95,
        mandatory: true
      },
      nonprofit: {
        suffixes: ["Trust", "Society"],
        description: "Trusts and registered societies",
        confidence: 85,
        mandatory: false
      },
      cooperative: {
        suffixes: ["Cooperative", "Co-op"],
        description: "Cooperative societies",
        confidence: 90,
        mandatory: false
      }
    },
    rules: [
      "Companies Act No. 7 of 2007 governs corporate structures",
      "Pvt Ltd cannot trade shares publicly (max 50 shareholders)",
      "PLC can list on Colombo Stock Exchange",
      "Trusts recognized under Trusts Ordinance but not separate legal entities"
    ]
  },

  singapore: {
    name: "Singapore",
    tlds: [".sg", ".com.sg", ".org.sg"],
    entities: {
      private_limited: {
        suffixes: ["Pte Ltd", "Private Limited"],
        description: "Most common business form, with limited liability for shareholders, not publicly traded",
        confidence: 95,
        mandatory: true
      },
      public_limited: {
        suffixes: ["Ltd", "Limited"],
        description: "Company with shares that can be publicly traded, with limited liability",
        confidence: 95,
        mandatory: true
      },
      llp: {
        suffixes: ["LLP"],
        description: "Partnership with limited liability for all partners, common for professional firms",
        confidence: 90,
        mandatory: true
      },
      limited_partnership: {
        suffixes: ["LP"],
        description: "Partnership with general and limited partners, general partners have unlimited liability",
        confidence: 85,
        mandatory: true
      },
      society: {
        suffixes: ["Society"],
        description: "Nonprofit entity for cultural, social, or charitable purposes, registered under the Societies Act",
        confidence: 80,
        mandatory: false
      },
      cooperative: {
        suffixes: ["Co-operative", "Co-op"],
        description: "Member-owned organization for mutual benefit, common in consumer or housing sectors",
        confidence: 85,
        mandatory: false
      },
      trust: {
        suffixes: ["Trust", "Charitable Trust"],
        description: "Legal arrangement for asset management, estate planning, or charitable purposes",
        confidence: 90,
        mandatory: false
      }
    },
    rules: [
      "Companies Act requires Pte Ltd, Ltd, or LLP suffixes for companies and partnerships",
      "Private companies must use 'Pte Ltd' or 'Private Limited'",
      "Public companies must use 'Ltd' or 'Limited'",
      "Limited Liability Partnerships must use 'LLP'",
      "Trusts typically include 'Trust' in the name for identification"
    ],
    notes: [
      "Entities registered with Accounting and Corporate Regulatory Authority (ACRA)",
      "Societies registered under the Societies Act for nonprofit purposes",
      "Cooperative societies governed by the Co-operative Societies Act",
      "Business-friendly environment allows foreign companies as branch offices"
    ]
  },

  cz: {
    name: "Czech Republic",
    tlds: [".cz"],
    entities: {
      limited_liability: {
        suffixes: ["s.r.o.", "spol. s r.o.", "společnost s ručením omezeným"],
        description: "Limited liability company, the most common form for small to medium businesses",
        confidence: 95,
        mandatory: true
      },
      joint_stock: {
        suffixes: ["a.s.", "akciová společnost"],
        description: "Joint-stock company, used for larger or publicly traded businesses with limited liability",
        confidence: 95,
        mandatory: true
      },
      general_partnership: {
        suffixes: ["v.o.s.", "veřejná obchodní společnost"],
        description: "General partnership with unlimited liability for all partners",
        confidence: 95,
        mandatory: true
      },
      limited_partnership: {
        suffixes: ["k.s.", "komanditní společnost"],
        description: "Limited partnership with general and limited partners, general partners have unlimited liability",
        confidence: 95,
        mandatory: true
      },
      cooperative: {
        suffixes: ["družstvo"],
        description: "Cooperative, member-owned for mutual benefit, common in agriculture or housing",
        confidence: 90,
        mandatory: false
      },
      foundation: {
        suffixes: ["nadace"],
        description: "Foundation, used for charitable, cultural, or public-benefit purposes, similar to a trust",
        confidence: 85,
        mandatory: false
      },
      endowment_fund: {
        suffixes: ["nadační fond"],
        description: "Endowment fund, a flexible nonprofit entity for charitable or social purposes",
        confidence: 85,
        mandatory: false
      },
      trust_fund: {
        suffixes: ["svěřenský fond", "trust"],
        description: "Trust fund, a trust-like arrangement for asset management or estate planning, not a standalone entity",
        confidence: 80,
        mandatory: false
      },
      association: {
        suffixes: ["spolek"],
        description: "Association, a nonprofit entity for cultural, social, or community purposes",
        confidence: 85,
        mandatory: false
      },
      institute: {
        suffixes: ["ústav"],
        description: "Institute, a nonprofit entity for educational, scientific, or cultural purposes",
        confidence: 85,
        mandatory: false
      }
    },
    rules: [
      "Suffixes like s.r.o., a.s., v.o.s., or k.s. are mandatory in the entity's name to indicate its legal structure under the Corporations Act (Act No. 90/2012 Coll.)",
      "Limited liability companies (s.r.o.) are the most common form for small to medium businesses",
      "Joint-stock companies (a.s.) are used for larger or publicly traded businesses",
      "Trusts ('svěřenský fond') were introduced in the Czech Civil Code (Act No. 89/2012 Coll.) in 2014 for asset management or estate planning but are not legal entities",
      "Foundations ('nadace') and endowment funds ('nadační fond') serve purposes similar to trusts, often for charitable or cultural activities",
      "Nonprofit entities like 'spolek' (associations) and 'ústav' (institutes) are common for community or cultural purposes",
      "Cooperatives ('družstvo') are regulated under the Corporations Act, with names often including 'družstvo'"
    ],
    notes: [
      "Entities are registered with the Commercial Register (Obchodní rejstřík) managed by regional courts, except for certain nonprofits registered with other authorities",
      "The Czech Republic's civil law system, similar to Germany or Italy, limits common law trusts, but the 2014 reforms introduced trust-like structures",
      "Public institutions, such as state-owned enterprises or universities, lack standardized suffixes and are identified by name or context",
      "Czech legal entities follow European Union standards while maintaining distinct national characteristics"
    ]
  }
};

// Helper function to get all suffixes for a jurisdiction
export function getJurisdictionSuffixes(jurisdictionKey: string): string[] {
  const jurisdiction = JURISDICTIONS[jurisdictionKey];
  if (!jurisdiction) return [];
  
  return Object.values(jurisdiction.entities)
    .flatMap(entity => entity.suffixes);
}

// Helper function to get all TLDs mapped to jurisdictions
export function getTLDMapping(): Record<string, string> {
  const mapping: Record<string, string> = {};
  
  for (const [key, jurisdiction] of Object.entries(JURISDICTIONS)) {
    for (const tld of jurisdiction.tlds) {
      mapping[tld] = key;
    }
  }
  
  return mapping;
}

// Helper function to get jurisdiction by TLD
export function getJurisdictionByTLD(domain: string): string | null {
  const tldMapping = getTLDMapping();
  
  for (const [tld, jurisdiction] of Object.entries(tldMapping)) {
    if (domain.endsWith(tld)) {
      return jurisdiction;
    }
  }
  
  return null;
}

/**
 * Global Jurisdiction Expansion Framework
 * Target: 123 jurisdictions for complete global coverage
 */
export interface GlobalExpansionStatus {
  currentJurisdictions: number;
  targetJurisdictions: number;
  completionPercentage: number;
  nextPriorityRegions: string[];
  estimatedEntityTypes: number;
}

export function getGlobalExpansionStatus(): GlobalExpansionStatus {
  const current = Object.keys(JURISDICTIONS).length;
  const target = 123;
  
  return {
    currentJurisdictions: current,
    targetJurisdictions: target,
    completionPercentage: Math.round((current / target) * 100),
    nextPriorityRegions: [
      'European Union (remaining 14 countries)',
      'Asian-Pacific (remaining 18 countries)', 
      'Middle East & Africa (remaining 35 countries)',
      'Americas (remaining 23 countries)',
      'Caribbean & Pacific Islands (remaining 20 countries)'
    ],
    estimatedEntityTypes: Math.round(target * 25) // ~25 entity types per jurisdiction
  };
}