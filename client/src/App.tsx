import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Dashboard from "@/pages/dashboard";
import Analytics from "@/pages/analytics";
import ParsingRules from "@/pages/parsing-rules";
import JurisdictionalGuide from "@/pages/jurisdictional-guide";
import KnowledgeGraphPage from "@/pages/knowledge-graph";
import SmokeTesting from "@/pages/smoke-testing";
import GlobalExpansionStatus from './pages/global-expansion-status';
import BetaTestingPage from './pages/beta-testing';
import BetaTestingV2 from './pages/beta-testing-v2';
import BetaDataProcessingPage from './pages/beta-data-processing';
import GLEIFTestingPage from './pages/gleif-testing';
import PerplexityTestingPage from './pages/perplexity-testing';
import ScrapingTestingPage from './pages/scraping-testing';
import { BetaV2GleifSearch } from './pages/BetaV2GleifSearch';
import BetaV2DataProcessing from './pages/BetaV2DataProcessing';
import NotFound from "@/pages/not-found";
import { lazy, Suspense } from "react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/knowledge-graph" component={KnowledgeGraphPage} />
      <Route path="/parsing-rules" component={ParsingRules} />
      <Route path="/jurisdictional-guide" component={JurisdictionalGuide} />
      <Route path="/beta-testing" component={BetaTestingPage} />
      <Route path="/beta-testing-v2" component={BetaTestingV2} />
      <Route path="/beta-data-processing" component={BetaDataProcessingPage} />
      <Route path="/beta-v2/gleif-search" component={BetaV2GleifSearch} />
      <Route path="/beta-v2/data-processing" component={BetaV2DataProcessing} />
      <Route path="/recent-changes" component={lazy(() => import("./pages/recent-changes"))} />
      <Route path="/settings" component={lazy(() => import("./pages/settings"))} />
      <Route path="/openrouter-settings" component={lazy(() => import("./pages/openrouter-settings"))} />
      <Route path="/openrouter-models" component={lazy(() => import("./pages/openrouter-models"))} />
      <Route component={NotFound} />
    </Switch>
  );
}

import * as React from "react";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Suspense fallback={<div className="flex items-center justify-center h-screen">Loading...</div>}>
          <Router />
        </Suspense>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;