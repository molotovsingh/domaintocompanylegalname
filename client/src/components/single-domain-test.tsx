import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface TestResult {
  domain: string;
  status: string;
  companyName: string | null;
  extractionMethod: string | null;
  confidenceScore: number | null;
  processingTimeMs: number;
  failureCategory: string | null;
  errorMessage: string | null;
  recommendation: string | null;
}

interface SingleDomainTestProps {
  onTestCompleted?: () => void;
}

export default function SingleDomainTest({ onTestCompleted }: SingleDomainTestProps) {
  const [domain, setDomain] = useState("");
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const testDomainMutation = useMutation({
    mutationFn: async (testDomain: string): Promise<TestResult> => {
      const response = await fetch('/api/test-domain', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain: testDomain }),
      });

      if (!response.ok) {
        throw new Error('Failed to test domain');
      }

      return response.json();
    },
    onSuccess: (result) => {
      setTestResult(result);
      toast({
        title: "Domain test completed",
        description: `Processed ${result.domain} in ${result.processingTimeMs}ms`,
      });
      // Refresh stats and batches to include the new test
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/batches"] });
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
      // Notify parent component about the completed test
      onTestCompleted?.();
    },
    onError: (error) => {
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) {
      toast({
        title: "Invalid input",
        description: "Please enter a domain name",
        variant: "destructive",
      });
      return;
    }

    const cleanDomain = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, '');
    testDomainMutation.mutate(cleanDomain);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const getBusinessCategory = (result: TestResult) => {
    if (result.status === 'success' && result.confidenceScore && result.confidenceScore >= 85) {
      return { label: 'Success', color: 'bg-green-100 text-green-800' };
    }

    if (result.failureCategory === 'connectivity_issue') {
      return { label: 'Protected - Manual Review', color: 'bg-yellow-100 text-yellow-800' };
    }

    if (result.failureCategory === 'extraction_failed') {
      return { label: 'Good Target - Tech Issue', color: 'bg-blue-100 text-blue-800' };
    }

    if (result.status === 'failed') {
      return { label: 'Bad Website - Skip', color: 'bg-red-100 text-red-800' };
    }

    return { label: 'Incomplete - Low Priority', color: 'bg-gray-100 text-gray-800' };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Search className="h-5 w-5" />
          Single Domain Test
        </CardTitle>
        <CardDescription>
          Test extraction on a single domain for quick validation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter domain (e.g., example.com)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={testDomainMutation.isPending}
            className="flex-1"
          />
          <Button 
            type="submit" 
            disabled={testDomainMutation.isPending || !domain.trim()}
          >
            {testDomainMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              'Test'
            )}
          </Button>
        </form>

        {testResult && (
          <div className="border rounded-lg p-4 space-y-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(testResult.status)}
                <span className="font-medium">{testResult.domain}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={getStatusColor(testResult.status)}>
                  {testResult.status}
                </Badge>
                <Badge className={getBusinessCategory(testResult).color}>
                  {getBusinessCategory(testResult).label}
                </Badge>
              </div>
            </div>

            {testResult.companyName && (
              <div>
                <span className="text-sm font-medium text-gray-700">Company Name: </span>
                <span className="text-sm">{testResult.companyName}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Method: </span>
                <span>{testResult.extractionMethod || 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Confidence: </span>
                <span>{testResult.confidenceScore ? `${testResult.confidenceScore}%` : 'N/A'}</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Processing Time: </span>
                <span>{testResult.processingTimeMs}ms</span>
              </div>
              <div>
                <span className="font-medium text-gray-700">Category: </span>
                <span>{testResult.failureCategory || 'success'}</span>
              </div>
            </div>

            {testResult.errorMessage && (
              <div className="text-sm">
                <span className="font-medium text-gray-700">Error: </span>
                <span className="text-red-600">{testResult.errorMessage}</span>
              </div>
            )}

            {testResult.recommendation && (
              <div className="text-sm">
                <span className="font-medium text-gray-700">Recommendation: </span>
                <span>{testResult.recommendation}</span>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}