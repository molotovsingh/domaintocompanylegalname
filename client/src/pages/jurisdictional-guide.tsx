export default function JurisdictionalGuide() {
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold">Jurisdictional Knowledge Reference</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive legal entity recognition across 11 jurisdictions including Taiwan and Russia with 190+ corporate suffixes and validation rules.
        </p>
      </header>

      <section>
        <h2 className="text-xl font-semibold mb-4">United States</h2>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <h3 className="font-medium mb-2">Corporate Entities</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Corporations:</strong> Inc., Incorporated, Corp., Corporation, Company, Co.
            </div>
            <div>
              <strong>Limited Liability:</strong> LLC, L.L.C., Limited
            </div>
            <div>
              <strong>Professional:</strong> P.C., PC (Professional Corporation), PLLC, P.L.L.C. (Professional Limited Liability Company)
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mt-3">
            <div>
              <strong>Partnerships:</strong> LP, L.P. (Limited Partnership), LLP, L.L.P. (Limited Liability Partnership), LLLP, L.L.L.P. (Limited Liability Limited Partnership)
            </div>
            <div>
              <strong>Cooperatives:</strong> Co-op, Cooperative
            </div>
            <div>
              <strong>Other:</strong> Trust, Holdings, Group
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <strong>Key Rules:</strong> Professional corporations (P.C.) required for licensed professionals (lawyers, doctors, accountants). 
          Nonprofits (universities, hospitals, foundations) exempt from corporate suffixes. State-specific variations exist.
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Canada</h2>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <h3 className="font-medium mb-2">Corporate Entities</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Standard:</strong> Inc., Incorporated, Ltd., Limited, Corp., Corporation
            </div>
            <div>
              <strong>Partnerships:</strong> LP, L.P., LLP, L.L.P.
            </div>
            <div>
              <strong>Quebec (French):</strong> Ltée (Limitée), Inc. (Incorporée)
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mt-3">
            <div>
              <strong>Professional:</strong> P.C. (Professional Corporation)
            </div>
            <div>
              <strong>Cooperative:</strong> Co-op, Cooperative
            </div>
            <div>
              <strong>Other:</strong> Trust, Society
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <strong>Key Rules:</strong> Quebec uses French variants (Ltée). Federal vs. provincial incorporation affects suffix requirements. 
          Professional corporations regulated by provincial law societies.
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Germany</h2>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <h3 className="font-medium mb-2">Corporate Entities</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Limited Liability:</strong> GmbH (Gesellschaft mit beschränkter Haftung), UG (Unternehmergesellschaft - mini-GmbH)
            </div>
            <div>
              <strong>Stock Companies:</strong> AG (Aktiengesellschaft), SE (Societas Europaea - European Company)
            </div>
            <div>
              <strong>Partnerships:</strong> KG (Kommanditgesellschaft), OHG (Offene Handelsgesellschaft), GbR (Gesellschaft bürgerlichen Rechts)
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mt-3">
            <div>
              <strong>Nonprofit:</strong> e.V. (eingetragener Verein), gGmbH (gemeinnützige GmbH), Stiftung (Foundation)
            </div>
            <div>
              <strong>Cooperative:</strong> eG (eingetragene Genossenschaft)
            </div>
            <div>
              <strong>Other:</strong> e.K. (eingetragener Kaufmann), gAG (gemeinnützige AG)
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <strong>Key Rules:</strong> GmbH requires €25,000 minimum capital, UG allows €1 minimum (but profits must build reserves). 
          SE allows European-wide operations. e.V. and Stiftung are tax-exempt nonprofits.
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">France</h2>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <h3 className="font-medium mb-2">Corporate Entities</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Stock Companies:</strong> SA (Société Anonyme), SAS (Société par Actions Simplifiée), SASU (SAS Unipersonnelle)
            </div>
            <div>
              <strong>Limited Liability:</strong> SARL (Société à Responsabilité Limitée), EURL (Entreprise Unipersonnelle à Responsabilité Limitée)
            </div>
            <div>
              <strong>Partnerships:</strong> SNC (Société en Nom Collectif), SCS (Société en Commandite Simple), SCA (Société en Commandite par Actions)
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mt-3">
            <div>
              <strong>Professional:</strong> SEL (Société d'Exercice Libéral), SC (Société Civile)
            </div>
            <div>
              <strong>Cooperative:</strong> SCOP (Société Coopérative de Production), SCIC (Société Coopérative d'Intérêt Collectif)
            </div>
            <div>
              <strong>Other:</strong> GIE (Groupement d'Intérêt Économique), SEM (Société d'Économie Mixte), Fondation, SE
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <strong>Key Rules:</strong> SA requires €37,000 minimum capital for public companies. SAS more flexible than SA. 
          SCOP is worker-owned cooperative. SE allows European operations.
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Mexico</h2>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <h3 className="font-medium mb-2">Corporate Entities</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Stock Companies:</strong> S.A. (Sociedad Anónima), S.A. de C.V. (de Capital Variable), S.A.B. (Bursátil), S.A.P.I. (Promotora de Inversión)
            </div>
            <div>
              <strong>Limited Liability:</strong> S. de R.L. (Sociedad de Responsabilidad Limitada), S. de R.L. de C.V.
            </div>
            <div>
              <strong>Partnerships:</strong> S. en C. (Sociedad en Comandita), S. en C. por A. (por Acciones)
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mt-3">
            <div>
              <strong>Civil:</strong> S.C. (Sociedad Civil)
            </div>
            <div>
              <strong>Nonprofit:</strong> A.C. (Asociación Civil), I.A.P. (Institución de Asistencia Privada)
            </div>
            <div>
              <strong>Investment:</strong> S.A.P.I. de C.V.
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <strong>Key Rules:</strong> C.V. (Capital Variable) allows flexible capital structure. S.A.B. for publicly traded companies. 
          A.C. and I.A.P. are tax-exempt nonprofits with different regulatory requirements.
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">India</h2>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <h3 className="font-medium mb-2">Corporate Entities</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Private Companies:</strong> Pvt Ltd, Private Limited, (Pvt.) Ltd.
            </div>
            <div>
              <strong>Public Companies:</strong> Ltd, Limited, Public Ltd
            </div>
            <div>
              <strong>Partnerships:</strong> LLP (Limited Liability Partnership)
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mt-3">
            <div>
              <strong>Nonprofit:</strong> Trust, Society, Section 8 Company
            </div>
            <div>
              <strong>Cooperative:</strong> Co-operative Society
            </div>
            <div>
              <strong>Other:</strong> OPC (One Person Company), Producer Company
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <strong>Key Rules:</strong> Pvt Ltd cannot trade shares publicly (max 200 shareholders). 
          Public Ltd can list on stock exchanges. Section 8 companies are nonprofits under Companies Act 2013.
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Brazil</h2>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <h3 className="font-medium mb-2">Corporate Entities</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Limited Liability:</strong> Ltda. (Limitada), SLU (Sociedade Limitada Unipessoal), EIRELI (Empresa Individual - being phased out)
            </div>
            <div>
              <strong>Stock Companies:</strong> S.A. (Sociedade Anônima)
            </div>
            <div>
              <strong>Partnerships:</strong> SCA (Sociedade em Comandita por Ações)
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mt-3">
            <div>
              <strong>Micro:</strong> MEI (Microempreendedor Individual)
            </div>
            <div>
              <strong>Cooperative:</strong> Cooperativa, Coop
            </div>
            <div>
              <strong>Nonprofit:</strong> Fundação, Associação, OSC (Organização da Sociedade Civil)
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <strong>Key Rules:</strong> SLU replaced EIRELI in 2019 for single-member companies. MEI for micro-entrepreneurs with simplified regulations. 
          Fundação requires government approval and endowment.
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Ireland</h2>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <h3 className="font-medium mb-2">Corporate Entities (Companies Act 2014)</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Private:</strong> Ltd, Limited, DAC (Designated Activity Company)
            </div>
            <div>
              <strong>Public:</strong> PLC, Public Limited Company
            </div>
            <div>
              <strong>Nonprofit:</strong> CLG (Company Limited by Guarantee)
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mt-3">
            <div>
              <strong>Unlimited:</strong> UC, ULC (Unlimited Company)
            </div>
            <div>
              <strong>Partnership:</strong> LP (Limited Partnership)
            </div>
            <div>
              <strong>Other:</strong> Society, Trust, Cooperative
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <strong>Key Rules:</strong> DAC has specific object clauses (replaced unlimited objects). CLG for nonprofits without share capital. 
          ULC has unlimited liability but tax advantages for subsidiaries.
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4">Italy</h2>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <h3 className="font-medium mb-2">Corporate Entities (Italian Civil Code)</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Stock Companies:</strong> S.p.A. (Società per Azioni)
            </div>
            <div>
              <strong>Limited Liability:</strong> S.r.l. (Società a Responsabilità Limitata), S.r.l.s. (Semplificata - simplified startup)
            </div>
            <div>
              <strong>Partnerships:</strong> S.n.c. (Società in Nome Collettivo), S.a.s. (Società in Accomandita Semplice), S.a.p.a. (per Azioni)
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mt-3">
            <div>
              <strong>Cooperative:</strong> Soc. Coop., Società Cooperativa
            </div>
            <div>
              <strong>Nonprofit:</strong> Fondazione, Associazione
            </div>
            <div>
              <strong>Other:</strong> Trust (recognized under Hague Convention)
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <strong>Key Rules:</strong> S.r.l.s. introduced in 2012 for startups with reduced capital requirements. 
          Cooperatives often include "a r.l." (responsabilità limitata) for limited liability.
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-blue-600">🇹🇼 Taiwan</h2>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <h3 className="font-medium mb-2">Corporate Entities (Company Act)</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Limited Companies:</strong> Co., Ltd., Company Limited, Ltd.
            </div>
            <div>
              <strong>Corporations:</strong> Inc., Incorporated, Corporation
            </div>
            <div>
              <strong>Technology:</strong> Corp., Technology Co., Ltd.
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mt-3">
            <div>
              <strong>Manufacturing:</strong> Industrial Co., Electronics Co.
            </div>
            <div>
              <strong>Cooperatives:</strong> Cooperative, Co-op
            </div>
            <div>
              <strong>Nonprofit:</strong> Foundation, Association, Branch
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <strong>Key Rules:</strong> Most common form is "Co., Ltd." Technology companies often use "Corp." 
          Manufacturing companies typically include industry descriptor. Foundation Act governs nonprofit entities.
        </div>
      </section>

      <section>
        <h2 className="text-xl font-semibold mb-4 text-red-600">🇷🇺 Russia</h2>
        <div className="bg-gray-50 p-4 rounded mb-4">
          <h3 className="font-medium mb-2">Corporate Entities (Russian Civil Code)</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <strong>Limited Liability:</strong> OOO, ООО (Obshchestvo s Ogranichennoy Otvetstvennostyu)
            </div>
            <div>
              <strong>Joint-Stock:</strong> AO, АО (Aktsionernoe Obshchestvo), PAO, ПАО (Publichnoe Aktsionernoe Obshchestvo)
            </div>
            <div>
              <strong>Individual Entrepreneur:</strong> IP, ИП (Individualny Predprinimatel)
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-sm mt-3">
            <div>
              <strong>Partnerships:</strong> TNV (Tovarishchestvo na Vere), PT (Polnoe Tovarishchestvo)
            </div>
            <div>
              <strong>Cooperative:</strong> PK (Proizvodstvenny Kooperativ), Kooperativ
            </div>
            <div>
              <strong>Nonprofit:</strong> ANO, АНО (Avtonomnaya Nekommercheskaya Organizatsiya), Fond, Obshchestvennaya Organizatsiya
            </div>
          </div>
        </div>
        <div className="text-sm text-gray-600">
          <strong>Key Rules:</strong> OOO is the most common form for small-medium businesses. PAO reserved for publicly traded companies (2014 reform). 
          State institutions lack standardized suffixes. Suffixes mandatory under Russian Civil Code. Both Latin and Cyrillic variants recognized.
        </div>
      </section>

      <section className="border-t pt-6">
        <h2 className="text-xl font-semibold mb-4">Validation Algorithm</h2>
        
        <div className="space-y-4">
          <div>
            <h3 className="font-medium text-red-600">Global Penalty System (-25% confidence)</h3>
            <p className="text-sm text-gray-600 mb-2">
              Applied to any extracted company name lacking proper legal entity suffix. Principle: Missing suffixes indicate either extraction errors or nonprofit status.
            </p>
            <div className="bg-red-50 p-3 rounded text-sm">
              <strong>Examples:</strong> "Apple" → Penalized | "Apple Inc." → Valid | "Microsoft" → Penalized | "Microsoft Corporation" → Valid
            </div>
          </div>

          <div>
            <h3 className="font-medium text-green-600">Nonprofit Exemptions (No penalty)</h3>
            <p className="text-sm text-gray-600 mb-2">
              Universities, hospitals, foundations, government agencies, religious organizations legitimately operate without corporate suffixes.
            </p>
            <div className="bg-green-50 p-3 rounded text-sm">
              <strong>Examples:</strong> "Harvard University", "Mayo Clinic", "Red Cross", "Department of Commerce"
            </div>
          </div>

          <div>
            <h3 className="font-medium text-blue-600">Domain Mapping Priority (95% confidence)</h3>
            <p className="text-sm text-gray-600 mb-2">
              Known companies use pre-verified legal entity names, overriding all extraction methods and cached results.
            </p>
            <div className="bg-blue-50 p-3 rounded text-sm">
              <strong>Examples:</strong> apple.com → "Apple Inc.", bmw.com → "BMW AG", toyota.com → "Toyota Motor Corporation"
            </div>
          </div>

          <div>
            <h3 className="font-medium text-orange-600">Marketing Content Rejection (Complete block)</h3>
            <p className="text-sm text-gray-600 mb-2">
              Descriptive phrases, taglines, and generic business descriptions are completely rejected as invalid extractions.
            </p>
            <div className="bg-orange-50 p-3 rounded text-sm">
              <strong>Blocked patterns:</strong> "Our business is", "Leading provider", "Grocery Store", "Client Challenge", "Innovation Partner"
            </div>
          </div>
        </div>

        <div className="mt-6 p-4 bg-gray-100 rounded">
          <h3 className="font-medium mb-2">Processing Priority</h3>
          <ol className="text-sm space-y-1">
            <li>1. <strong>Domain Mappings</strong> - Authoritative legal names (95% confidence)</li>
            <li>2. <strong>About Us/Company Pages</strong> - Structured corporate information</li>
            <li>3. <strong>Legal/Terms Pages</strong> - Official legal entity names</li>
            <li>4. <strong>Domain Parsing</strong> - Fallback extraction from domain name</li>
          </ol>
          <p className="text-xs text-gray-500 mt-2">
            HTML title extraction completely removed due to marketing content contamination.
          </p>
        </div>
      </section>
    </div>
  );
}