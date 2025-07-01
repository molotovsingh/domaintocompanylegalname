import { BatchLogs } from "@/components/batch-logs";
import { DashboardHeader } from "@/components/dashboard-header";

export default function BatchLogsPage() {
  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      <main className="container mx-auto px-4 py-8">
        <BatchLogs />
      </main>
    </div>
  );
}