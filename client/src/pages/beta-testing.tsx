import React, { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Beaker,
  Shield,
  Database,
  Activity,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  AlertTriangle,
  Loader2,
} from "lucide-react";

interface BetaTestResult {
  domain: string;
  method: string;
  companyName: string | null;
  legalEntityType: string | null; // Added missing field
  country: string | null; // Added missing field
  confidence: number;
  processingTime: number;
  success: boolean;
  error: string | null;
  errorCode: string | null; // Added for better error categorization
  extractionMethod: string | null;
  technicalDetails: string | null;
  sources: string[]; // Added missing field
  llmResponse: {
    content?: string;
    citations?: any[];
    parsedJson?: any;
    rawConfidence?: string | null;
  } | null;
}

interface TestProgress {
  currentMethod: string | null;
  completedMethods: string[];
  totalMethods: number;
}

export default function BetaTesting() {
  const [testDomain, setTestDomain] = useState("");
  const [testMethod, setTestMethod] = useState("perplexity_llm");
  const [testResults, setTestResults] = useState<BetaTestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [testProgress, setTestProgress] = useState<TestProgress>({
    currentMethod: null,
    completedMethods: [],
    totalMethods: 0,
  });
  const [validationError, setValidationError] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const validateDomain = (
    domain: string,
  ): { isValid: boolean; error?: string } => {
    if (!domain || typeof domain !== "string") {
      return { isValid: false, error: "Domain must be a non-empty string" };
    }

    const cleanDomain = domain.replace(/^https?:\/\//, "").split("/")[0];
    const domainRegex =
      /^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9](?:\.[a-zA-Z]{2,})+$/;

    if (!domainRegex.test(cleanDomain)) {
      return { isValid: false, error: "Invalid domain format" };
    }

    if (cleanDomain.length > 253) {
      return {
        isValid: false,
        error: "Domain name too long (max 253 characters)",
      };
    }

    return { isValid: true };
  };

  const runBetaTest = async (
    domain: string,
    method: string,
    signal?: AbortSignal,
  ): Promise<BetaTestResult> => {
    try {
      const startTime = Date.now();
      const response = await fetch("/api/beta/smoke-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain, method }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      const processingTime = Date.now() - startTime;

      return {
        domain,
        method,
        processingTime,
        companyName: result.data?.companyName || result.companyName,
        legalEntityType: result.data?.legalEntityType || result.legalEntityType,
        country: result.data?.country || result.country,
        confidence: result.data?.confidence || result.confidence || 0,
        success: result.success,
        error: result.error,
        errorCode: result.errorCode || null,
        extractionMethod:
          result.data?.extractionMethod || result.extractionMethod,
        technicalDetails:
          result.data?.technicalDetails || result.technicalDetails,
        sources: result.data?.sources || result.sources || [],
        llmResponse: result.data?.llmResponse || result.llmResponse || null,
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error; // Re-throw abort errors
      }

      return {
        domain,
        method,
        processingTime: 0, // Fixed the calculation bug
        companyName: null,
        legalEntityType: null,
        country: null,
        confidence: 0,
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        errorCode: error instanceof Error ? "API_ERROR" : "UNKNOWN_ERROR",
        extractionMethod: null,
        technicalDetails: null,
        sources: [],
        llmResponse: null,
      };
    }
  };

  const runSingleTest = async () => {
    const trimmedDomain = testDomain.trim();
    const validation = validateDomain(trimmedDomain);

    if (!validation.isValid) {
      setValidationError(validation.error || "Invalid domain");
      return;
    }

    setValidationError(null);
    setIsRunning(true);
    setProgress(0);
    setTestResults([]);

    // Create abort controller for this test
    abortControllerRef.current = new AbortController();

    try {
      setProgress(50);
      const result = await runBetaTest(
        trimmedDomain,
        testMethod,
        abortControllerRef.current.signal,
      );
      setTestResults([result]);
      setProgress(100);
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Test failed:", error);
      }
    } finally {
      setIsRunning(false);
      abortControllerRef.current = null;
    }
  };

  const runFullTest = async () => {
    const trimmedDomain = testDomain.trim();
    const validation = validateDomain(trimmedDomain);

    if (!validation.isValid) {
      setValidationError(validation.error || "Invalid domain");
      return;
    }

    setValidationError(null);
    setIsRunning(true);
    setProgress(0);
    setTestResults([]);

    const methods = ["axios_cheerio", "perplexity_llm"];
    const results: BetaTestResult[] = [];

    setTestProgress({
      currentMethod: null,
      completedMethods: [],
      totalMethods: methods.length,
    });

    // Create abort controller for this test suite
    abortControllerRef.current = new AbortController();

    try {
      for (let i = 0; i < methods.length; i++) {
        const method = methods[i];

        setTestProgress((prev) => ({
          ...prev,
          currentMethod: method,
        }));

        setProgress((i / methods.length) * 100);

        const result = await runBetaTest(
          trimmedDomain,
          method,
          abortControllerRef.current.signal,
        );
        results.push(result);
        setTestResults([...results]);

        setTestProgress((prev) => ({
          ...prev,
          completedMethods: [...prev.completedMethods, method],
        }));
      }

      setProgress(100);
    } catch (error) {
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Test suite failed:", error);
      }
    } finally {
      setIsRunning(false);
      setTestProgress({
        currentMethod: null,
        completedMethods: [],
        totalMethods: 0,
      });
      abortControllerRef.current = null;
    }
  };

  const cancelTests = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const formatMethodName = (method: string): string => {
    return method.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center">
            <Beaker className="w-8 h-8 mr-3 text-blue-500" />
            Beta Testing Platform
          </h1>
          <p className="text-muted-foreground mt-2">
            Test experimental extraction methods in isolated environment
          </p>
        </div>
        <div className="flex items-center space-x-4">
          <Badge variant="outline" className="text-sm">
            <Database className="w-4 h-4 mr-1" />
            Isolated Database
          </Badge>
          <Badge variant="outline" className="text-sm">
            <Shield className="w-4 h-4 mr-1" />
            Port 3001
          </Badge>
          <Badge className="bg-green-500 text-white">
            <Activity className="w-4 h-4 mr-1" />
            Auto-Started
          </Badge>
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          <strong>Beta Environment:</strong> All tests run in complete isolation
          from production data. Beta server starts automatically with the main
          application.
        </AlertDescription>
      </Alert>

      {/* Validation Error */}
      {validationError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Validation Error:</strong> {validationError}
          </AlertDescription>
        </Alert>
      )}

      {/* Test Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Domain Extraction Test</CardTitle>
          <CardDescription>
            Test domain extraction using experimental methods including
            Perplexity LLM
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="Enter domain (e.g., example.com)"
              value={testDomain}
              onChange={(e) => {
                setTestDomain(e.target.value);
                if (validationError) setValidationError(null);
              }}
              onKeyPress={(e) =>
                e.key === "Enter" && !isRunning && runSingleTest()
              }
              disabled={isRunning}
              className="flex-1"
            />
            <Select
              value={testMethod}
              onValueChange={setTestMethod}
              disabled={isRunning}
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="axios_cheerio">Axios/Cheerio</SelectItem>
                <SelectItem value="perplexity_llm">Perplexity LLM</SelectItem>
              </SelectContent>
            </Select>

            {!isRunning ? (
              <>
                <Button onClick={runSingleTest} disabled={!testDomain.trim()}>
                  <Play className="w-4 h-4 mr-2" />
                  Test
                </Button>
                <Button
                  onClick={runFullTest}
                  disabled={!testDomain.trim()}
                  variant="outline"
                >
                  <Zap className="w-4 h-4 mr-2" />
                  All Methods
                </Button>
              </>
            ) : (
              <Button onClick={cancelTests} variant="destructive">
                <XCircle className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            )}
          </div>

          {isRunning && (
            <div className="space-y-2">
              <div className="text-sm text-muted-foreground">
                {testProgress.currentMethod ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Testing {formatMethodName(testProgress.currentMethod)}...
                  </div>
                ) : (
                  "Preparing tests..."
                )}
              </div>
              <Progress value={progress} className="w-full" />
              {testProgress.totalMethods > 1 && (
                <div className="text-xs text-muted-foreground">
                  {testProgress.completedMethods.length} of{" "}
                  {testProgress.totalMethods} methods completed
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Results */}
      {testResults.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Test Results</CardTitle>
            <CardDescription>
              Extraction results for {testResults[0]?.domain}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {testResults.map((result, index) => (
                <Card key={index} className="overflow-hidden">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Badge
                          variant="outline"
                          className="text-sm font-medium"
                        >
                          {formatMethodName(result.method)}
                        </Badge>
                        <div className="flex items-center gap-2">
                          {result.success ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span
                            className={`text-sm font-medium ${result.success ? "text-green-600" : "text-red-600"}`}
                          >
                            {result.success ? "Success" : "Failed"}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <Clock className="w-4 h-4" />
                        {result.processingTime}ms
                      </div>
                    </div>

                    <div className="space-y-3">
                      {/* Enhanced Perplexity LLM display */}
                      {result.method === "perplexity_llm" &&
                      result.llmResponse?.parsedJson ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <span className="text-sm font-medium text-muted-foreground">
                                Company Name:
                              </span>
                              <p className="text-base font-medium">
                                {result.llmResponse.parsedJson.company_name || 
                                 result.companyName || "Not found"}
                              </p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-muted-foreground">
                                Legal Entity Type:
                              </span>
                              <p className="text-sm">
                                {result.llmResponse.parsedJson.legal_entity_type || 
                                 result.legalEntityType || "Not specified"}
                              </p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-muted-foreground">
                                Country:
                              </span>
                              <p className="text-sm">
                                {result.llmResponse.parsedJson.country || 
                                 result.country || "Not specified"}
                              </p>
                            </div>
                            <div>
                              <span className="text-sm font-medium text-muted-foreground">
                                LLM Confidence:
                              </span>
                              <p className="text-sm capitalize">
                                {result.llmResponse.parsedJson.confidence || 
                                 result.llmResponse.rawConfidence || "Not specified"}
                              </p>
                            </div>
                            {result.extractionMethod && (
                              <div>
                                <span className="text-sm font-medium text-muted-foreground">
                                  Extraction Method:
                                </span>
                                <p className="text-sm">
                                  {result.extractionMethod}
                                </p>
                              </div>
                            )}
                            <div>
                              <span className="text-sm font-medium text-muted-foreground">
                                Processing Confidence:
                              </span>
                              <p className="text-sm">
                                {result.confidence || 
                                 result.llmResponse?.parsedJson?.confidence_score ||
                                 (result.llmResponse?.parsedJson?.confidence === 'high' ? 95 : 
                                  result.llmResponse?.parsedJson?.confidence === 'medium' ? 70 : 
                                  result.llmResponse?.parsedJson?.confidence === 'low' ? 40 : 0)}%
                              </p>
                            </div>
                          </div>

                          {/* Enhanced sources display */}
                          {result.sources && result.sources.length > 0 && (
                            <div>
                              <span className="text-sm font-medium text-muted-foreground">
                                Sources Found ({result.sources.length}):
                              </span>
                              <div className="text-sm mt-2 space-y-1 bg-gray-50 p-3 rounded">
                                {result.sources
                                  .slice(0, 3)
                                  .map((source: string, idx: number) => (
                                    <div
                                      key={idx}
                                      className="text-xs text-muted-foreground break-words"
                                    >
                                      • {source}
                                    </div>
                                  ))}
                                {result.sources.length > 3 && (
                                  <div className="text-xs text-muted-foreground italic">
                                    ... and {result.sources.length - 3} more
                                    sources
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Standard display for other methods */
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">
                              Company:
                            </span>
                            <p className="text-base font-medium">
                              {result.companyName || "Not found"}
                            </p>
                          </div>
                          {result.extractionMethod && (
                            <div>
                              <span className="text-sm font-medium text-muted-foreground">
                                Extraction Method:
                              </span>
                              <p className="text-sm">
                                {result.extractionMethod}
                              </p>
                            </div>
                          )}
                          <div>
                            <span className="text-sm font-medium text-muted-foreground">
                              Confidence:
                            </span>
                            <p className="text-sm">{result.confidence}%</p>
                          </div>
                        </div>
                      )}

                      {/* Error display with error codes */}
                      {result.error && (
                        <Alert variant="destructive">
                          <XCircle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>
                              Error
                              {result.errorCode ? ` (${result.errorCode})` : ""}
                              :
                            </strong>{" "}
                            {result.error}
                          </AlertDescription>
                        </Alert>
                      )}

                      {result.technicalDetails && (
                        <Alert>
                          <AlertDescription>
                            <strong>Technical Details:</strong>{" "}
                            {result.technicalDetails}
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Enhanced JSON display for debugging */}
                      {result.method === "perplexity_llm" && (
                        <details className="mt-4">
                          <summary className="cursor-pointer text-sm font-medium text-blue-900 hover:text-blue-700">
                            View Complete JSON Response
                          </summary>
                          <div className="mt-2 p-4 bg-blue-50 rounded-lg">
                            {result.llmResponse?.parsedJson ? (
                              <pre className="text-sm text-blue-800 whitespace-pre-wrap overflow-auto max-h-96 bg-white p-3 rounded border">
                                {JSON.stringify(
                                  result.llmResponse.parsedJson,
                                  null,
                                  2,
                                )}
                              </pre>
                            ) : (
                              <div>
                                <h5 className="font-medium text-blue-900 mb-2">Raw Extraction Data:</h5>
                                <pre className="text-sm text-blue-800 whitespace-pre-wrap overflow-auto max-h-96 bg-white p-3 rounded border">
                                  {typeof result.technicalDetails === 'string' 
                                    ? result.technicalDetails 
                                    : JSON.stringify(result.technicalDetails || {}, null, 2)}
                                </pre>
                              </div>
                            )}
                            {result.llmResponse?.citations &&
                              result.llmResponse.citations.length > 0 && (
                                <div className="mt-3">
                                  <h5 className="font-medium text-blue-900 mb-1">
                                    Citations (
                                    {result.llmResponse.citations.length}):
                                  </h5>
                                  <div className="text-xs text-blue-700 space-y-1 max-h-32 overflow-y-auto">
                                    {result.llmResponse.citations.map(
                                      (citation: string, idx: number) => (
                                        <div key={idx} className="truncate">
                                          • {citation}
                                        </div>
                                      ),
                                    )}
                                  </div>
                                </div>
                              )}
                          </div>
                        </details>
                      )}

                      {/* Raw response for failed JSON parsing */}
                      {result.method === "perplexity_llm" &&
                        !result.llmResponse?.parsedJson &&
                        result.llmResponse?.content && (
                          <details className="mt-4">
                            <summary className="cursor-pointer text-sm font-medium text-yellow-900 hover:text-yellow-700">
                              View Raw Response (JSON Parsing Failed)
                            </summary>
                            <div className="mt-2 p-4 bg-yellow-50 rounded-lg">
                              <pre className="text-xs text-yellow-800 whitespace-pre-wrap overflow-auto max-h-64 bg-white p-3 rounded border">
                                {result.llmResponse.content}
                              </pre>
                              <p className="text-sm text-yellow-800 mt-2">
                                LLM returned response but JSON extraction
                                failed. Check the raw content above.
                              </p>
                            </div>
                          </details>
                        )}

                      {/* Debug: Show all available data for any method */}
                      <details className="mt-4">
                        <summary className="cursor-pointer text-sm font-medium text-gray-600 hover:text-gray-800">
                          Debug: View All Result Data
                        </summary>
                        <div className="mt-2 p-4 bg-gray-50 rounded-lg">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap overflow-auto max-h-64 bg-white p-3 rounded border">
                            {JSON.stringify(result, null, 2)}
                          </pre>
                        </div>
                      </details>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Enhanced Statistics */}
      {testResults.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-blue-600">
                {Math.round(
                  testResults.reduce((acc, r) => acc + r.processingTime, 0) /
                    testResults.length,
                )}
                ms
              </div>
              <div className="text-sm text-muted-foreground">
                Average Processing Time
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-green-600">
                {testResults.filter((r) => r.success).length}/
                {testResults.length}
              </div>
              <div className="text-sm text-muted-foreground">Success Rate</div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold text-purple-600">
                {Math.round(
                  testResults.reduce((acc, r) => acc + r.confidence, 0) /
                    testResults.length,
                )}
                %
              </div>
              <div className="text-sm text-muted-foreground">
                Average Confidence
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}