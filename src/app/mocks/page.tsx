import { Suspense } from 'react';
import { getMockEndpoints } from './actions';
import { MocksClient } from './mocks-client';

export const dynamic = 'force-dynamic';

interface MocksPageProps {
  searchParams: {
    page?: string;
    search?: string;
    method?: string;
    isActive?: string;
  };
}

export default async function MocksPage({ searchParams }: MocksPageProps) {
  const page = Number(searchParams.page) || 1;
  const method =
    searchParams.method && searchParams.method !== 'all'
      ? searchParams.method
      : undefined;
  const isActiveParam = searchParams.isActive;
  const isActive =
    isActiveParam === 'true'
      ? true
      : isActiveParam === 'false'
      ? false
      : undefined;

  const result = await getMockEndpoints({
    page,
    limit: 20,
    search: searchParams.search,
    method,
    isActive,
  });

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MocksClient
        initialEndpoints={result.data}
        initialMeta={result.meta}
        searchParams={searchParams}
      />
    </Suspense>
  );
}

