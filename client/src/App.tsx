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
import SmokeTestingPage from "@/pages/smoke-testing";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/parsing-rules" component={ParsingRules} />
      <Route path="/jurisdictional-guide" component={JurisdictionalGuide} />
      <Route path="/knowledge-graph" component={KnowledgeGraphPage} />
      <Route path="/smoke-testing" component={SmokeTestingPage} />
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
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;