import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Globe, Building2, CheckCircle, AlertTriangle } from "lucide-react";

export default function JurisdictionalGuide() {
  const jurisdictions = [
    {
      region: "North America",
      countries: [
        {
          name: "United States",
          flag: "🇺🇸",
          commonSuffixes: ["Inc.", "Corp.", "LLC", "Ltd."],
          specializedSuffixes: ["P.C.", "PLLC", "LP", "LLP", "Co-op", "Trust"],
          examples: ["Apple Inc.", "Microsoft Corporation", "Google LLC"],
          notes: "Professional corporations (P.C.) common for lawyers/doctors"
        },
        {
          name: "Canada",
          flag: "🇨🇦",
          commonSuffixes: ["Inc.", "Ltd.", "Corp."],
          specializedSuffixes: ["LP", "LLP", "Co-op", "Trust", "Ltée"],
          examples: ["Shopify Inc.", "Royal Bank of Canada", "Bombardier Inc."],
          notes: "Quebec uses French variants like 'Ltée' for Limitée"
        },
        {
          name: "Mexico",
          flag: "🇲🇽",
          commonSuffixes: ["S.A.", "S.A. de C.V.", "S. de R.L."],
          specializedSuffixes: ["S.C.", "A.C.", "I.A.P.", "S.A.P.I."],
          examples: ["CEMEX S.A.B. de C.V.", "Grupo Bimbo S.A.B. de C.V."],
          notes: "C.V. = Capital Variable, A.C. = Asociación Civil (nonprofit)"
        }
      ]
    },
    {
      region: "Europe",
      countries: [
        {
          name: "Germany",
          flag: "🇩🇪",
          commonSuffixes: ["GmbH", "AG", "SE"],
          specializedSuffixes: ["UG", "KG", "e.V.", "Stiftung", "eG"],
          examples: ["SAP SE", "Volkswagen AG", "Siemens AG"],
          notes: "e.V. = nonprofit association, Stiftung = foundation"
        },
        {
          name: "France",
          flag: "🇫🇷",
          commonSuffixes: ["SA", "SARL", "SAS"],
          specializedSuffixes: ["SNC", "EURL", "SCOP", "GIE", "Fondation"],
          examples: ["LVMH SA", "Carrefour SA", "Total SE"],
          notes: "SE = European company, SCOP = worker cooperative"
        },
        {
          name: "Ireland",
          flag: "🇮🇪",
          commonSuffixes: ["Ltd", "DAC", "PLC"],
          specializedSuffixes: ["CLG", "UC", "ULC", "Society", "Trust"],
          examples: ["Ryanair DAC", "Allied Irish Banks PLC"],
          notes: "DAC = Designated Activity Company, CLG = nonprofit limited by guarantee"
        },
        {
          name: "Italy",
          flag: "🇮🇹",
          commonSuffixes: ["S.p.A.", "S.r.l.", "S.r.l.s."],
          specializedSuffixes: ["S.n.c.", "S.a.s.", "Soc. Coop.", "Fondazione"],
          examples: ["Eni S.p.A.", "Ferrari N.V.", "Telecom Italia S.p.A."],
          notes: "S.r.l.s. = simplified startup version, Soc. Coop. = cooperative"
        }
      ]
    },
    {
      region: "South America",
      countries: [
        {
          name: "Brazil",
          flag: "🇧🇷",
          commonSuffixes: ["Ltda.", "S.A.", "SLU"],
          specializedSuffixes: ["EIRELI", "MEI", "Cooperativa", "Fundação"],
          examples: ["Petrobras S.A.", "Vale S.A.", "Itaú Unibanco S.A."],
          notes: "SLU replaced EIRELI in 2019, MEI = micro-entrepreneur"
        }
      ]
    },
    {
      region: "Asia",
      countries: [
        {
          name: "India",
          flag: "🇮🇳",
          commonSuffixes: ["Ltd", "Pvt Ltd", "Private Limited"],
          specializedSuffixes: ["LLP", "Trust", "Society"],
          examples: ["Tata Consultancy Services Ltd", "Infosys Ltd", "Wipro Ltd"],
          notes: "Pvt Ltd = private company, Public Ltd = publicly traded"
        }
      ]
    }
  ];

  const validationRules = [
    {
      rule: "Legal Suffix Requirement",
      description: "Corporate entities must have proper legal suffixes",
      penalty: "-25% confidence penalty for missing suffixes",
      examples: ["❌ Apple", "✅ Apple Inc.", "❌ Microsoft", "✅ Microsoft Corporation"]
    },
    {
      rule: "Nonprofit Exemption",
      description: "Legitimate nonprofits don't require corporate suffixes",
      penalty: "No penalty applied",
      examples: ["✅ Harvard University", "✅ Mayo Clinic", "✅ Red Cross"]
    },
    {
      rule: "Domain Mapping Priority",
      description: "Known companies use authoritative legal names",
      penalty: "95% confidence for mapped companies",
      examples: ["rewe.de → REWE Group", "bmw.com → BMW AG"]
    },
    {
      rule: "Marketing Content Rejection",
      description: "Descriptive phrases and taglines are blocked",
      penalty: "Complete rejection of marketing content",
      examples: ["❌ 'Our business is'", "❌ 'Leading provider'", "❌ 'Grocery Store'"]
    }
  ];

  return (
    <div className="container mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center gap-2">
          <Globe className="h-8 w-8 text-blue-600" />
          <h1 className="text-3xl font-bold">Jurisdictional Knowledge Guide</h1>
        </div>
        <p className="text-lg text-gray-600 max-w-3xl mx-auto">
          Our system recognizes legal entity structures across 9 major jurisdictions, covering 170+ corporate suffixes 
          and ensuring proper legal entity validation for international business names.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Supported Jurisdictions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {jurisdictions.map((region) => (
              <div key={region.region}>
                <h3 className="text-xl font-semibold mb-4 text-blue-600">{region.region}</h3>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {region.countries.map((country) => (
                    <Card key={country.name} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                          <span className="text-2xl">{country.flag}</span>
                          {country.name}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <p className="font-medium text-sm text-gray-600 mb-1">Common Suffixes</p>
                          <div className="flex flex-wrap gap-1">
                            {country.commonSuffixes.map((suffix) => (
                              <Badge key={suffix} variant="default" className="text-xs">
                                {suffix}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-600 mb-1">Specialized</p>
                          <div className="flex flex-wrap gap-1">
                            {country.specializedSuffixes.map((suffix) => (
                              <Badge key={suffix} variant="secondary" className="text-xs">
                                {suffix}
                              </Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="font-medium text-sm text-gray-600 mb-1">Examples</p>
                          <div className="text-xs space-y-1">
                            {country.examples.map((example) => (
                              <div key={example} className="bg-gray-50 px-2 py-1 rounded">
                                {example}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="pt-2 border-t">
                          <p className="text-xs text-gray-500 italic">{country.notes}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Validation Rules & Penalties
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {validationRules.map((rule, index) => (
              <div key={index}>
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    {rule.rule === "Legal Suffix Requirement" && <AlertTriangle className="h-4 w-4 text-orange-500" />}
                    {rule.rule === "Nonprofit Exemption" && <CheckCircle className="h-4 w-4 text-green-500" />}
                    {rule.rule === "Domain Mapping Priority" && <Building2 className="h-4 w-4 text-blue-500" />}
                    {rule.rule === "Marketing Content Rejection" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold">{rule.rule}</h4>
                    <p className="text-gray-600 mb-2">{rule.description}</p>
                    <Badge variant={rule.penalty.includes("penalty") ? "destructive" : "default"} className="mb-3">
                      {rule.penalty}
                    </Badge>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <p className="text-sm font-medium mb-2">Examples:</p>
                      <div className="space-y-1">
                        {rule.examples.map((example, i) => (
                          <div key={i} className="text-sm font-mono">
                            {example}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
                {index < validationRules.length - 1 && <Separator className="mt-6" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-blue-50 border-blue-200">
        <CardHeader>
          <CardTitle className="text-blue-800">Key Principles</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <p className="text-sm text-blue-800">
              <strong>Corporate entities require legal suffixes</strong> - Companies without proper suffixes appear incomplete and unprofessional
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <p className="text-sm text-blue-800">
              <strong>Nonprofits are exempt</strong> - Universities, hospitals, foundations legitimately don't use corporate suffixes
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <p className="text-sm text-blue-800">
              <strong>Domain mappings are authoritative</strong> - Known companies use verified legal entity names at 95% confidence
            </p>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <p className="text-sm text-blue-800">
              <strong>Marketing content is rejected</strong> - Descriptive phrases and taglines are completely blocked
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}