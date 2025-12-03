import { Suspense } from 'react';
import { getLogs, getUniqueLogSources, getUniqueLogLevels } from './actions';
import { LogsClient } from './logs-client';

export const dynamic = 'force-dynamic';

interface LogsPageProps {
  searchParams: {
    page?: string;
    search?: string;
    level?: string;
    source?: string;
    startDate?: string;
    endDate?: string;
  };
}

export default async function LogsPage({ searchParams }: LogsPageProps) {
  const page = Number(searchParams.page) || 1;
  const levelParam = searchParams.level;
  const level = levelParam && levelParam !== 'all'
    ? levelParam.split(',').filter(Boolean)
    : undefined;
  const sourceParam = searchParams.source;
  const source = sourceParam && sourceParam !== 'all'
    ? sourceParam.split(',').filter(Boolean)
    : undefined;
  const startDate = searchParams.startDate ? new Date(searchParams.startDate) : undefined;
  const endDate = searchParams.endDate ? new Date(searchParams.endDate) : undefined;

  const [result, uniqueSources, uniqueLevels] = await Promise.all([
    getLogs({
      page,
      limit: 50, // Show more logs per page
      search: searchParams.search,
      level,
      source,
      startDate,
      endDate,
    }),
    getUniqueLogSources(),
    getUniqueLogLevels(),
  ]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <LogsClient
        initialLogs={result.data}
        initialMeta={result.meta}
        searchParams={searchParams}
        uniqueSources={uniqueSources}
        uniqueLevels={uniqueLevels}
      />
    </Suspense>
  );
}

