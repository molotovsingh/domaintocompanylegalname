import { JURISDICTIONS, type JurisdictionData, type LegalEntityCategory } from "@shared/jurisdictions";

function EntityCard({ title, entity }: { title: string; entity: LegalEntityCategory }) {
  return (
    <div className="bg-gray-50 p-3 rounded">
      <div className="font-medium text-sm mb-1">{title}</div>
      <div className="text-xs text-gray-600 mb-2">{entity.description}</div>
      <div className="flex flex-wrap gap-1">
        {entity.suffixes.map((suffix, idx) => (
          <span 
            key={idx} 
            className={`px-2 py-1 rounded text-xs ${
              entity.mandatory 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {suffix}
          </span>
        ))}
      </div>
      {entity.confidence && (
        <div className="text-xs text-gray-500 mt-1">
          Confidence: {entity.confidence}%
        </div>
      )}
    </div>
  );
}

function JurisdictionSection({ jurisdictionKey, data }: { jurisdictionKey: string; data: JurisdictionData }) {
  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">{data.name}</h2>
        <div className="flex gap-1">
          {data.tlds.map((tld, idx) => (
            <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
              {tld}
            </span>
          ))}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {Object.entries(data.entities).map(([key, entity]) => (
          <EntityCard 
            key={key} 
            title={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())} 
            entity={entity} 
          />
        ))}
      </div>
      
      <div className="bg-yellow-50 p-3 rounded">
        <h4 className="font-medium text-sm mb-2">Key Rules</h4>
        <ul className="text-xs text-gray-700 space-y-1">
          {data.rules.map((rule, idx) => (
            <li key={idx} className="flex items-start">
              <span className="text-yellow-600 mr-2">•</span>
              {rule}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export default function JurisdictionalGuide() {
  const jurisdictionCount = Object.keys(JURISDICTIONS).length;
  const totalSuffixes = Object.values(JURISDICTIONS)
    .flatMap(j => Object.values(j.entities))
    .flatMap(e => e.suffixes).length;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <header className="border-b pb-4">
        <h1 className="text-2xl font-bold">Jurisdictional Knowledge Reference</h1>
        <p className="text-gray-600 mt-2">
          Comprehensive legal entity recognition across {jurisdictionCount} jurisdictions with {totalSuffixes}+ corporate suffixes and validation rules.
        </p>
        <div className="mt-3 flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-blue-100 rounded"></span>
            <span>Mandatory Suffixes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-gray-100 rounded"></span>
            <span>Optional Suffixes</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-green-100 rounded"></span>
            <span>Supported TLDs</span>
          </div>
        </div>
      </header>

      <div className="space-y-6">
        {Object.entries(JURISDICTIONS).map(([key, data]) => (
          <JurisdictionSection key={key} jurisdictionKey={key} data={data} />
        ))}
      </div>
    </div>
  );
}