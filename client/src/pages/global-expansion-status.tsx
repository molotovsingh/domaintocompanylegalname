
import React from 'react';
import { getGlobalExpansionStatus } from '@shared/jurisdictions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Globe } from 'lucide-react';
import { Link } from 'wouter';

export default function GlobalExpansionStatus() {
  const status = getGlobalExpansionStatus();

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
                <div className="bg-gradient-to-r from-purple-500 to-pink-600 text-white rounded-lg p-2">
                  <Globe className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Global Expansion Status</h1>
                  <p className="text-sm text-gray-600">Worldwide jurisdiction expansion progress</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        <header className="border-b pb-4">
          <h1 className="text-3xl font-bold">Global Jurisdiction Expansion</h1>
          <p className="text-gray-600 mt-2">
            Expanding domain intelligence to all 123 jurisdictions worldwide
          </p>
        </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Current Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-green-600 mb-2">
              {status.currentJurisdictions}
            </div>
            <div className="text-sm text-gray-600">
              of {status.targetJurisdictions} jurisdictions
            </div>
            <Progress value={status.completionPercentage} className="mt-4" />
            <div className="text-xs text-gray-500 mt-2">
              {status.completionPercentage}% Complete
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Entity Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-blue-600 mb-2">
              {status.estimatedEntityTypes.toLocaleString()}
            </div>
            <div className="text-sm text-gray-600">
              Estimated legal entity types
            </div>
            <div className="text-xs text-gray-500 mt-2">
              ~25 per jurisdiction average
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Global Coverage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-purple-600 mb-2">
              123
            </div>
            <div className="text-sm text-gray-600">
              Target jurisdictions
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Complete global coverage
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Next Priority Regions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {status.nextPriorityRegions.map((region, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <span className="font-medium">{region}</span>
                <span className="text-sm text-gray-500">Phase {index + 2}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Architecture Benefits for Global Scale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded">
              <h4 className="font-semibold text-green-600">Modular Jurisdiction System</h4>
              <p className="text-sm text-gray-600 mt-1">
                JSON-based architecture scales infinitely for new jurisdictions
              </p>
            </div>
            <div className="p-4 border rounded">
              <h4 className="font-semibold text-blue-600">GLEIF Global Integration</h4>
              <p className="text-sm text-gray-600 mt-1">
                Multi-jurisdiction entity search and validation
              </p>
            </div>
            <div className="p-4 border rounded">
              <h4 className="font-semibold text-purple-600">Million-Domain Processing</h4>
              <p className="text-sm text-gray-600 mt-1">
                Optimized for global-scale batch processing
              </p>
            </div>
            <div className="p-4 border rounded">
              <h4 className="font-semibold text-orange-600">Real-time Updates</h4>
              <p className="text-sm text-gray-600 mt-1">
                Machine-friendly updates across all components
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      </main>
    </div>
  );
}
