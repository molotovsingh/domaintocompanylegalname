
import GLEIFKnowledgeGraph from "@/components/gleif-knowledge-graph";
import { Link } from "wouter";
import { ArrowLeft, Network } from "lucide-react";

export default function KnowledgeGraphPage() {
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
                <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-lg p-2">
                  <Network className="h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold text-gray-900">GLEIF Knowledge Graph</h1>
                  <p className="text-sm text-gray-600">Interactive entity intelligence visualization</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <GLEIFKnowledgeGraph />
      </main>
    </div>
  );
}
