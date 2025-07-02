import { AlertTriangle, AlertCircle, Info, Zap, Settings, GitBranch, Shield } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { BottleneckAnalysis } from "@shared/schema";

interface BottleneckAnalysisProps {
  bottlenecks?: BottleneckAnalysis[];
}

const severityConfig = {
  low: { 
    color: "bg-blue-100 text-blue-800 border-blue-200", 
    icon: Info,
    iconColor: "text-blue-600"
  },
  medium: { 
    color: "bg-yellow-100 text-yellow-800 border-yellow-200", 
    icon: AlertCircle,
    iconColor: "text-yellow-600"
  },
  high: { 
    color: "bg-orange-100 text-orange-800 border-orange-200", 
    icon: AlertTriangle,
    iconColor: "text-orange-600"
  },
  critical: { 
    color: "bg-red-100 text-red-800 border-red-200", 
    icon: AlertTriangle,
    iconColor: "text-red-600"
  }
};

const typeIcons = {
  network_timeout: GitBranch,
  anti_bot_protection: Shield,
  high_concurrency: Zap,
  stuck_domains: Settings,
  low_success_rate: AlertTriangle,
  memory_pressure: Info
};

export default function BottleneckAnalysisComponent({ bottlenecks = [] }: BottleneckAnalysisProps) {
  if (!bottlenecks || bottlenecks.length === 0) {
    return (
      <Card className="bg-surface shadow-material border border-gray-200">
        <CardHeader>
          <CardTitle className="text-lg font-medium text-gray-900 flex items-center">
            <Zap className="text-green-500 mr-2 h-5 w-5" />
            Performance Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6 bg-green-50 rounded-lg">
            <Info className="h-8 w-8 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-gray-700 font-medium">No Performance Issues Detected</p>
            <p className="text-xs text-gray-600 mt-1">
              System is operating within optimal parameters
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical');
  const highBottlenecks = bottlenecks.filter(b => b.severity === 'high');
  const mediumBottlenecks = bottlenecks.filter(b => b.severity === 'medium');

  return (
    <Card className="bg-surface shadow-material border border-gray-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-medium text-gray-900 flex items-center">
            <AlertTriangle className="text-orange-500 mr-2 h-5 w-5" />
            Performance Bottlenecks
          </CardTitle>
          <div className="flex gap-2">
            {criticalBottlenecks.length > 0 && (
              <Badge variant="destructive">{criticalBottlenecks.length} Critical</Badge>
            )}
            {highBottlenecks.length > 0 && (
              <Badge className="bg-orange-100 text-orange-800">{highBottlenecks.length} High</Badge>
            )}
            {mediumBottlenecks.length > 0 && (
              <Badge variant="secondary">{mediumBottlenecks.length} Medium</Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {bottlenecks.map((bottleneck, index) => {
          const config = severityConfig[bottleneck.severity];
          const SeverityIcon = config.icon;
          const TypeIcon = typeIcons[bottleneck.type] || Settings;
          
          return (
            <Collapsible key={index}>
              <div className={`border rounded-lg p-4 ${config.color}`}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full p-0 h-auto justify-start hover:bg-transparent">
                    <div className="flex items-start space-x-3 w-full">
                      <div className="flex-shrink-0 flex items-center space-x-2">
                        <SeverityIcon className={`h-5 w-5 ${config.iconColor}`} />
                        <TypeIcon className={`h-4 w-4 ${config.iconColor}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium text-gray-900">{bottleneck.title}</h3>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {bottleneck.severity.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{bottleneck.description}</p>
                        <p className="text-xs text-gray-500 mt-1 font-medium">
                          Impact: {bottleneck.impact}
                        </p>
                      </div>
                    </div>
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="mt-4 space-y-4">
                  {/* Key Metrics */}
                  {Object.keys(bottleneck.metrics).length > 0 && (
                    <div className="bg-white bg-opacity-50 rounded p-3">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Key Metrics</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {Object.entries(bottleneck.metrics).map(([key, value]) => (
                          <div key={key} className="text-xs">
                            <span className="text-gray-500 capitalize">
                              {key.replace(/([A-Z])/g, ' $1').toLowerCase()}:
                            </span>
                            <span className="ml-1 font-medium text-gray-700">
                              {typeof value === 'number' ? value.toLocaleString() : value}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Actionable Recommendations */}
                  <div className="bg-white bg-opacity-50 rounded p-3">
                    <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center">
                      <Zap className="h-4 w-4 mr-1" />
                      Actionable Recommendations
                    </h4>
                    <ul className="space-y-2">
                      {bottleneck.recommendations.map((recommendation, recIndex) => (
                        <li key={recIndex} className="flex items-start space-x-2 text-xs">
                          <span className="text-green-600 font-bold">•</span>
                          <span className="text-gray-700">{recommendation}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  
                  {/* Priority Actions for Critical Issues */}
                  {bottleneck.severity === 'critical' && (
                    <div className="bg-red-50 border border-red-200 rounded p-3">
                      <h4 className="text-sm font-medium text-red-800 mb-2">
                        🚨 Immediate Action Required
                      </h4>
                      <p className="text-xs text-red-700">
                        This critical issue is significantly impacting processing performance. 
                        Implement the top recommendations immediately to restore optimal throughput.
                      </p>
                    </div>
                  )}
                </CollapsibleContent>
              </div>
            </Collapsible>
          );
        })}
        
        {/* Performance Summary */}
        <div className="mt-6 p-4 bg-gray-50 rounded-lg">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Performance Optimization Summary</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-gray-500">Total Issues:</span>
              <span className="ml-1 font-medium">{bottlenecks.length}</span>
            </div>
            <div>
              <span className="text-gray-500">Highest Priority:</span>
              <span className="ml-1 font-medium capitalize">
                {criticalBottlenecks.length > 0 ? 'Critical' : 
                 highBottlenecks.length > 0 ? 'High' : 
                 mediumBottlenecks.length > 0 ? 'Medium' : 'Low'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Est. Impact:</span>
              <span className="ml-1 font-medium">
                {criticalBottlenecks.length > 0 ? '50-80% throughput loss' :
                 highBottlenecks.length > 0 ? '20-50% throughput loss' : 
                 'Minor performance impact'}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}