import { EXTRACTION_METHODS, CONFIDENCE_MODIFIERS, VALIDATION_RULES, PROCESSING_TIMEOUTS, getEnabledMethods } from "@shared/parsing-rules";
import { ArrowLeft, Settings } from 'lucide-react';
import { Link } from 'wouter';

function MethodCard({ method }: { method: any }) {
  return (
    <div className="bg-gray-50 p-4 rounded">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-medium">{method.name}</h3>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-1 rounded text-xs ${method.enabled ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {method.enabled ? 'Enabled' : 'Disabled'}
          </span>
          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
            Priority: {method.priority}
          </span>
        </div>
      </div>
      
      <p className="text-sm text-gray-600 mb-3">{method.description}</p>
      
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <span className="font-medium">Base Confidence:</span> {method.confidence}%
        </div>
        {method.timeout && (
          <div>
            <span className="font-medium">Timeout:</span> {method.timeout / 1000}s
          </div>
        )}
      </div>
      
      {method.validation && (
        <div className="mt-3 p-2 bg-yellow-50 rounded">
          <div className="font-medium text-xs mb-1">Validation Rules:</div>
          <div className="text-xs text-gray-600 space-y-1">
            {method.validation.minLength && <div>Min Length: {method.validation.minLength}</div>}
            {method.validation.maxLength && <div>Max Length: {method.validation.maxLength}</div>}
            {method.validation.requiredWords && <div>Required Words: {method.validation.requiredWords}</div>}
            {method.validation.blacklist && (
              <div>Blacklist: {method.validation.blacklist.slice(0, 3).join(', ')}{method.validation.blacklist.length > 3 ? '...' : ''}</div>
            )}
          </div>
        </div>
      )}
      
      {method.selectors && (
        <div className="mt-3 p-2 bg-blue-50 rounded">
          <div className="font-medium text-xs mb-1">CSS Selectors:</div>
          <div className="text-xs text-gray-600">
            {method.selectors.slice(0, 2).join(', ')}{method.selectors.length > 2 ? '...' : ''}
          </div>
        </div>
      )}
      
      {method.patterns && (
        <div className="mt-3 p-2 bg-purple-50 rounded">
          <div className="font-medium text-xs mb-1">Regex Patterns:</div>
          <div className="text-xs text-gray-600">
            {method.patterns.length} pattern{method.patterns.length !== 1 ? 's' : ''} configured
          </div>
        </div>
      )}
    </div>
  );
}

function ConfigSection({ title, config, unit = '' }: { title: string; config: any; unit?: string }) {
  return (
    <div className="bg-gray-50 p-4 rounded">
      <h3 className="font-medium mb-3">{title}</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
        {Object.entries(config).map(([key, value]) => (
          <div key={key} className="flex justify-between">
            <span className="text-gray-600">{key.replace(/([A-Z])/g, ' $1').toLowerCase()}:</span>
            <span className="font-medium">{String(value)}{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ParsingRules() {
  const enabledMethods = getEnabledMethods();
  const totalMethods = Object.keys(EXTRACTION_METHODS).length;
  const enabledCount = enabledMethods.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
                <ArrowLeft className="h-4 w-4" />
                Back to Dashboard
              </Link>
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-r from-gray-500 to-slate-600 text-white rounded-lg p-2">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Parsing Rules</h1>
                  <p className="text-sm text-gray-600">Extraction methods and validation configuration</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        <header className="border-b pb-4">
          <h1 className="text-2xl font-bold">Parsing Rules Configuration</h1>
          <p className="text-gray-600 mt-2">
            Machine-friendly extraction methods, confidence modifiers, and validation rules for domain intelligence processing.
          </p>
          <div className="mt-3 flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-green-100 rounded"></span>
              <span>Enabled ({enabledCount}/{totalMethods})</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-red-100 rounded"></span>
              <span>Disabled</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-blue-100 rounded"></span>
              <span>Priority Order</span>
            </div>
          </div>
        </header>

      <section>
        <h2 className="text-xl font-semibold mb-4">Extraction Methods</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.values(EXTRACTION_METHODS)
            .sort((a, b) => a.priority - b.priority)
            .map((method, idx) => (
              <MethodCard key={idx} method={method} />
            ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConfigSection 
          title="Confidence Modifiers" 
          config={CONFIDENCE_MODIFIERS}
          unit="%"
        />
        
        <ConfigSection 
          title="Processing Timeouts" 
          config={Object.fromEntries(
            Object.entries(PROCESSING_TIMEOUTS).map(([k, v]) => [k, v / 1000])
          )}
          unit="s"
        />
      </div>

      <section>
        <h2 className="text-xl font-semibold mb-4">Validation Rules</h2>
        <div className="bg-gray-50 p-4 rounded space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-gray-600">Min Confidence:</span>
              <span className="font-medium ml-2">{VALIDATION_RULES.minConfidenceThreshold}%</span>
            </div>
            <div>
              <span className="text-gray-600">Min Length:</span>
              <span className="font-medium ml-2">{VALIDATION_RULES.minCompanyNameLength}</span>
            </div>
            <div>
              <span className="text-gray-600">Max Length:</span>
              <span className="font-medium ml-2">{VALIDATION_RULES.maxCompanyNameLength}</span>
            </div>
            <div>
              <span className="text-gray-600">Max Marketing Words:</span>
              <span className="font-medium ml-2">{VALIDATION_RULES.maxMarketingWords}</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <h4 className="font-medium text-sm mb-2">Allowed Nonprofit Patterns</h4>
              <div className="flex flex-wrap gap-1">
                {VALIDATION_RULES.allowedNonprofitPatterns.map((pattern, idx) => (
                  <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                    {pattern}
                  </span>
                ))}
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-sm mb-2">Blacklisted Patterns</h4>
              <div className="flex flex-wrap gap-1">
                {VALIDATION_RULES.blacklistedPatterns.slice(0, 10).map((pattern, idx) => (
                  <span key={idx} className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded">
                    {pattern}
                  </span>
                ))}
                {VALIDATION_RULES.blacklistedPatterns.length > 10 && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs rounded">
                    +{VALIDATION_RULES.blacklistedPatterns.length - 10} more
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-blue-50 p-4 rounded">
        <h3 className="font-medium mb-2">Machine-Friendly Updates</h3>
        <p className="text-sm text-gray-700">
          All parsing rules are centralized in <code className="bg-white px-1 rounded">shared/parsing-rules.ts</code>. 
          Updates to extraction methods, confidence modifiers, or validation rules automatically propagate throughout the system.
        </p>
        <div className="mt-2 text-xs text-gray-600">
          <strong>Quick Updates:</strong> Modify timeout values, enable/disable methods, adjust confidence thresholds, 
          add new extraction patterns, or update validation rules without touching extraction logic.
        </div>
      </section>
      </main>
    </div>
  );
}