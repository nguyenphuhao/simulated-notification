import { Suspense } from 'react';
import { getMessages, getUniqueIpAddresses, getUniqueProviders, getUniqueMethods } from './actions';
import { MessagesClient } from './messages-client';
import { MessageCategory } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface MessagesPageProps {
  searchParams: {
    page?: string;
    search?: string;
    category?: string;
    provider?: string;
    method?: string;
    ipAddress?: string;
    startDate?: string;
    endDate?: string;
  };
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const page = Number(searchParams.page) || 1;
  const categoryParam = searchParams.category;
  const category = categoryParam && categoryParam !== 'all'
    ? categoryParam.split(',').filter(Boolean) as MessageCategory[]
    : undefined;
  const providerParam = searchParams.provider;
  const provider = providerParam && providerParam !== 'all'
    ? providerParam.split(',').filter(Boolean)
    : undefined;
  const methodParam = searchParams.method;
  const method = methodParam && methodParam !== 'all'
    ? methodParam.split(',').filter(Boolean)
    : undefined;
  const ipAddress = searchParams.ipAddress && searchParams.ipAddress !== 'all'
    ? searchParams.ipAddress
    : undefined;
  const startDate = searchParams.startDate ? new Date(searchParams.startDate) : undefined;
  const endDate = searchParams.endDate ? new Date(searchParams.endDate) : undefined;

  const [result, uniqueIps, uniqueProviders, uniqueMethods] = await Promise.all([
    getMessages({
      page,
      limit: 20,
      search: searchParams.search,
      category,
      provider,
      method,
      ipAddress,
      startDate,
      endDate,
    }),
    getUniqueIpAddresses(),
    getUniqueProviders(),
    getUniqueMethods(),
  ]);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MessagesClient
        initialMessages={result.data}
        initialMeta={result.meta}
        searchParams={searchParams}
        uniqueIpAddresses={uniqueIps}
        uniqueProviders={uniqueProviders}
        uniqueMethods={uniqueMethods}
      />
    </Suspense>
  );
}

