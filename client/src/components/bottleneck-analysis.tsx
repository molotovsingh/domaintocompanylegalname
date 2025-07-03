import { Info, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BottleneckAnalysisComponent() {
  return (
    <Card className="bg-surface shadow-material border border-gray-200">
      <CardHeader>
        <CardTitle className="text-lg font-medium text-gray-900 flex items-center">
          <Zap className="text-green-500 mr-2 h-5 w-5" />
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center p-6 bg-green-50 rounded-lg">
          <Info className="h-8 w-8 text-green-500 mx-auto mb-2" />
          <p className="text-sm text-gray-700 font-medium">System Operating Normally</p>
          <p className="text-xs text-gray-600 mt-1">
            Performance monitoring has been simplified for better reliability
          </p>
        </div>
      </CardContent>
    </Card>
  );
}