
import React, { Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';

interface CodeChange {
  id: string;
  timestamp: string;
  formattedTime: string;
  type: 'feature' | 'fix' | 'enhancement' | 'system';
  description: string;
  files: string[];
  agent: 'assistant';
}

const getBadgeColor = (type: string) => {
  switch (type) {
    case 'feature': return 'bg-blue-500 text-white';
    case 'fix': return 'bg-purple-500 text-white';
    case 'enhancement': return 'bg-orange-500 text-white';
    case 'system': return 'bg-green-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

const getBgColor = (type: string) => {
  switch (type) {
    case 'feature': return 'bg-blue-50';
    case 'fix': return 'bg-purple-50';
    case 'enhancement': return 'bg-orange-50';
    case 'system': return 'bg-green-50';
    default: return 'bg-gray-50';
  }
};

const getTextColor = (type: string) => {
  switch (type) {
    case 'feature': return 'text-blue-600';
    case 'fix': return 'text-purple-600';
    case 'enhancement': return 'text-orange-600';
    case 'system': return 'text-green-600';
    default: return 'text-gray-600';
  }
};

function RecentChangesContent() {
  const { data: changesData, error, isLoading } = useQuery({
    queryKey: ["changes"],
    queryFn: async () => {
      const response = await fetch('/api/changes');
      if (!response.ok) {
        throw new Error('Failed to fetch changes');
      }
      return response.json();
    },
    refetchInterval: 600000, // 10 minutes
    staleTime: 300000, // 5 minutes
    retry: 1,
    refetchOnWindowFocus: false,
    suspense: false, // Disable suspense to prevent React warnings
  });

  const changes = changesData?.changes || [];

  if (isLoading) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p>Loading recent changes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-6 text-red-600">
        <p>Error loading changes: {error.message}</p>
      </div>
    );
  }

  if (changes.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground">
        <p>No recent code changes</p>
        <p className="text-sm mt-1">Changes made by the AI assistant will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {changes.slice(0, 6).map((change: CodeChange) => (
        <div key={change.id} className={`flex items-start space-x-3 p-3 rounded-lg ${getBgColor(change.type)}`}>
          <Badge className={getBadgeColor(change.type)}>
            {change.type.charAt(0).toUpperCase() + change.type.slice(1)}
          </Badge>
          <div className="flex-1">
            <div className="font-medium">{change.description}</div>
            {change.files.length > 0 && (
              <div className="text-sm text-muted-foreground mt-1">
                Modified: {change.files.slice(0, 3).join(', ')}
                {change.files.length > 3 && ` +${change.files.length - 3} more`}
              </div>
            )}
            <div className={`text-xs mt-1 ${getTextColor(change.type)}`}>
              {change.formattedTime}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RecentChanges() {
  return (
    <Suspense fallback={
      <div className="text-center py-6 text-muted-foreground">
        <p>Loading recent changes...</p>
      </div>
    }>
      <RecentChangesContent />
    </Suspense>
  );
}
