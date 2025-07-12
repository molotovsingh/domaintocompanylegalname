import { List, CheckCircle, Clock, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { ProcessingStats } from "@shared/schema";
import LiveTimestamp from "@/components/live-timestamp";

interface StatsCardsProps {
  stats?: ProcessingStats;
}

export default function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      <Card className="bg-surface shadow-material border border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="bg-primary-custom bg-opacity-10 rounded-lg p-3">
              <List className="text-primary-custom h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Domains</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.totalDomains?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface shadow-material border border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="bg-success bg-opacity-10 rounded-lg p-3">
              <CheckCircle className="text-success h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Processed</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.processedDomains?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface shadow-material border border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center">
            <div className="bg-warning bg-opacity-10 rounded-lg p-3">
              <Clock className="text-warning h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Success Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {stats?.successRate ? `${stats.successRate}%` : '0%'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}