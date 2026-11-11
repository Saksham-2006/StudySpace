import { Suspense } from "react";
import AnalyticsDashboard from "@/components/admin/AnalyticsDashboard";
import { getAdminAnalytics } from "@/lib/services/admin";

export const instant = false;

async function AnalyticsContent() {
  const analytics = await getAdminAnalytics();
  return <AnalyticsDashboard analytics={analytics} />;
}

export default function AdminAnalyticsPage() {
  return (
    <Suspense fallback={<div>Loading analytics data...</div>}>
      <AnalyticsContent />
    </Suspense>
  );
}
