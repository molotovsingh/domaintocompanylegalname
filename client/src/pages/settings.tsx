
import { Link } from 'wouter';
import { Settings, Zap, Database, Activity } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-gray-600 hover:text-gray-800">
                ← Back to Dashboard
              </Link>
              <div className="flex items-center space-x-3">
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg p-2">
                  <Settings className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
                  <p className="text-sm text-gray-600">Configure your application settings</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          
          {/* OpenRouter Settings */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-purple-600" />
                <CardTitle>OpenRouter</CardTitle>
              </div>
              <CardDescription>
                Configure AI models and API settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Set up OpenRouter API key, configure models, and test integration.
                </p>
                <div className="flex space-x-2">
                  <Link href="/openrouter-settings">
                    <Button size="sm">Configure</Button>
                  </Link>
                  <Link href="/openrouter-models">
                    <Button variant="outline" size="sm">Models</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Database Settings */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Database className="h-5 w-5 text-green-600" />
                <CardTitle>Database</CardTitle>
              </div>
              <CardDescription>
                Database configuration and maintenance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Database connections, migrations, and maintenance tools.
                </p>
                <Button variant="outline" size="sm" disabled>
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Analytics Settings */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <CardTitle>Analytics</CardTitle>
              </div>
              <CardDescription>
                Performance monitoring and reporting
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Configure analytics, monitoring, and performance tracking.
                </p>
                <Button variant="outline" size="sm" disabled>
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>

        </div>
      </main>
    </div>
  );
}
