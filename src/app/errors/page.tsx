import { Suspense } from 'react';
import { getErrorLogs, getUniqueSources, getErrorLogStats } from './actions';
import { ErrorLogsClient } from './error-logs-client';
import { ErrorLevel } from './actions';

export const dynamic = 'force-dynamic';

interface ErrorLogsPageProps {
  searchParams: {
    page?: string;
    search?: string;
    level?: ErrorLevel;
    source?: string;
  };
}

export default async function ErrorLogsPage({ searchParams }: ErrorLogsPageProps) {
  const page = Number(searchParams.page) || 1;
  const search = searchParams.search || undefined;
  const level = searchParams.level || undefined;
  const source = searchParams.source || undefined;

  const [result, uniqueSources, stats] = await Promise.all([
    getErrorLogs({
      page,
      limit: 20,
      search,
      level,
      source,
    }),
    getUniqueSources(),
    getErrorLogStats(),
  ]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ErrorLogsClient
        initialLogs={result.data}
        initialMeta={result.meta}
        searchParams={searchParams}
        uniqueSources={uniqueSources}
        stats={stats}
      />
    </Suspense>
  );
}

