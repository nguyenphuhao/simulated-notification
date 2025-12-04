import { Suspense } from 'react';
import { AnalyticsClient } from './analytics-client';

export const dynamic = 'force-dynamic';

interface AnalyticsPageProps {
  searchParams: {
    startDate?: string;
    endDate?: string;
    endpoint?: string;
    method?: string;
  };
}

export default async function AnalyticsPage({
  searchParams,
}: AnalyticsPageProps) {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <AnalyticsClient searchParams={searchParams} />
    </Suspense>
  );
}

