import { Suspense } from 'react';
import { getForwardConfigs } from './actions';
import { ForwardConfigsClient } from './forward-configs-client';

export const dynamic = 'force-dynamic';

interface ForwardConfigsPageProps {
  searchParams: {
    enabled?: string;
  };
}

export default async function ForwardConfigsPage({
  searchParams,
}: ForwardConfigsPageProps) {
  const enabled =
    searchParams.enabled !== undefined
      ? searchParams.enabled === 'true'
      : undefined;

  const result = await getForwardConfigs({
    enabled,
  });

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ForwardConfigsClient
        initialConfigs={result.data}
        searchParams={searchParams}
      />
    </Suspense>
  );
}

