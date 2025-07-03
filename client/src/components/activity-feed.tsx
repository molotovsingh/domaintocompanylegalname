import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { Activity } from "@shared/schema";

export default function ActivityFeed() {
  const { data: activities = [] } = useQuery({
    queryKey: ["/api/activities"],
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  const getStatusColor = (type: string) => {
    switch (type) {
      case 'batch_upload':
      case 'batch_complete':
        return 'bg-success';
      case 'error':
        return 'bg-error';
      case 'worker_status':
        return 'bg-warning';
      default:
        return 'bg-primary-custom';
    }
  };

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} minutes ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    return `${Math.floor(diffInSeconds / 86400)} days ago`;
  };

  return (
    <Card className="mt-8 bg-surface shadow-material border border-gray-200">
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-lg font-medium text-gray-900 flex items-center">
          <History className="text-primary-custom mr-2 h-5 w-5" />
          Recent Activity
        </h2>
        <p className="text-sm text-gray-600 mt-1">Live feed of processing events and system notifications</p>
      </div>
      <CardContent className="p-6">
        <div className="space-y-4 max-h-80 overflow-y-auto">
          {activities.length > 0 ? (
            activities.map((activity: Activity) => (
              <div key={activity.id} className="flex items-start space-x-3">
                <div
                  className={`flex-shrink-0 w-2 h-2 ${getStatusColor(activity.type)} rounded-full mt-2`}
                ></div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500">{formatTimeAgo(activity.createdAt)}</p>
                </div>
                {activity.details && (
                  <div className="text-xs text-gray-500">
                    {(() => {
                      try {
                        const details = JSON.parse(activity.details);
                        return details.domainCount ? 
                          `${details.domainCount.toLocaleString()} domains` : 
                          details.processed ? 
                            `${details.processed.toLocaleString()} processed` : 
                            null;
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <History className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No recent activity</h3>
              <p className="text-sm text-gray-600">Activity will appear here as you process domains</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
