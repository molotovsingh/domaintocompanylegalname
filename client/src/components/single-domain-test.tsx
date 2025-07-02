import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, CheckCircle, XCircle, Globe } from "lucide-react";

interface SingleDomainTestProps {
  onTestCompleted?: () => void;
}

export default function SingleDomainTest({ onTestCompleted }: SingleDomainTestProps) {
  const [domain, setDomain] = React.useState("");
  const [lastResult, setLastResult] = React.useState<any>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const testDomainMutation = useMutation({
    mutationFn: async (domainToTest: string) => {
      const response = await fetch("/api/test-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domainToTest }),
      });

      if (!response.ok) {
        throw new Error("Failed to test domain");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setLastResult(data);
      toast({
        title: "Test completed",
        description: `Successfully processed ${domain}`,
      });

      if (onTestCompleted) {
        onTestCompleted();
      }

      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/results"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Test failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (domain.trim()) {
      testDomainMutation.mutate(domain.trim());
    }
  };

  return (
    <Card className="bg-surface shadow-material border border-gray-200">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Search className="text-primary-custom mr-2 h-5 w-5" />
          Single Domain Test
        </CardTitle>
        <p className="text-sm text-gray-600">Test extraction on a single domain</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="text"
            placeholder="Enter domain (e.g., google.com)"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            disabled={testDomainMutation.isPending}
          />
          <Button
            type="submit"
            disabled={!domain.trim() || testDomainMutation.isPending}
            className="w-full"
          >
            {testDomainMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              <>
                <Search className="mr-2 h-4 w-4" />
                Test Domain
              </>
            )}
          </Button>
        </form>

        {lastResult && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">
                <Globe className="inline mr-1 h-3 w-3" />
                {lastResult.domain}
              </span>
              {lastResult.status === 'success' ? (
                <Badge className="bg-green-100 text-green-800">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Success
                </Badge>
              ) : (
                <Badge variant="destructive">
                  <XCircle className="mr-1 h-3 w-3" />
                  Failed
                </Badge>
              )}
            </div>

            {lastResult.status === 'success' && (
              <div className="space-y-1 text-sm">
                <div>
                  <span className="text-gray-600">Company:</span>
                  <span className="ml-2 font-medium">{lastResult.companyName || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Method:</span>
                  <span className="ml-2">{lastResult.extractionMethod || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Confidence:</span>
                  <span className="ml-2">{lastResult.confidenceScore || 0}%</span>
                </div>
                <div>
                  <span className="text-gray-600">Time:</span>
                  <span className="ml-2">{lastResult.processingTimeMs || 0}ms</span>
                </div>
              </div>
            )}

            {lastResult.error && (
              <div className="text-sm text-red-600 mt-2">
                Error: {lastResult.error}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}