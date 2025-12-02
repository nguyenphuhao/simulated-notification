import { getMessages, getUniqueIpAddresses } from './actions';
import { MessagesClient } from './messages-client';
import { MessageCategory } from '@/lib/types';

interface MessagesPageProps {
  searchParams: {
    page?: string;
    search?: string;
    category?: string;
    provider?: string;
    method?: string;
    ipAddress?: string;
  };
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const page = Number(searchParams.page) || 1;
  const category = searchParams.category && searchParams.category !== 'all' 
    ? (searchParams.category as MessageCategory) 
    : undefined;
  const provider = searchParams.provider && searchParams.provider !== 'all' 
    ? searchParams.provider 
    : undefined;
  const method = searchParams.method && searchParams.method !== 'all' 
    ? searchParams.method 
    : undefined;
  const ipAddress = searchParams.ipAddress && searchParams.ipAddress !== 'all'
    ? searchParams.ipAddress
    : undefined;

  const [result, uniqueIps] = await Promise.all([
    getMessages({
      page,
      limit: 20,
      search: searchParams.search,
      category,
      provider,
      method,
      ipAddress,
    }),
    getUniqueIpAddresses(),
  ]);

  return (
    <MessagesClient
      initialMessages={result.data}
      initialMeta={result.meta}
      searchParams={searchParams}
      uniqueIpAddresses={uniqueIps}
    />
  );
}

