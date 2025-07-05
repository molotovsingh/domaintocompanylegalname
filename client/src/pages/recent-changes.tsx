
import React from 'react';
import { Globe, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import RecentChanges from '@/components/recent-changes';

export default function RecentChangesPage() {
  return (
    <div className="min-h-screen bg-background font-sans">
      {/* Header */}
      <header className="bg-surface shadow-material border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-3">
              <Link href="/">
                <Button variant="ghost" size="sm" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Dashboard
                </Button>
              </Link>
              <div className="bg-primary-custom text-white rounded-lg p-2">
                <Globe className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-medium text-gray-900">Recent Code Changes</h1>
                <p className="text-sm text-gray-600">Track AI assistant modifications to your codebase</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Code Changes Log</CardTitle>
            <CardDescription>
              All modifications made by the AI assistant are tracked here with timestamps and file details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RecentChanges />
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
