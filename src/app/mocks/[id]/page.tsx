import { getMockEndpointById, getMockRequests } from '../actions';
import { notFound } from 'next/navigation';
import { MockDetailClient } from './mock-detail-client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface MockDetailPageProps {
  params: {
    id: string;
  };
  searchParams: {
    page?: string;
  };
}

export default async function MockDetailPage({
  params,
  searchParams,
}: MockDetailPageProps) {
  try {
    const page = Number(searchParams.page) || 1;
    const [endpoint, requestsResult] = await Promise.all([
      getMockEndpointById(params.id),
      getMockRequests({
        mockEndpointId: params.id,
        page,
        limit: 20,
      }),
    ]);

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/mocks">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Mock Endpoint Details</h1>
            <p className="text-muted-foreground mt-1">
              View endpoint configuration and request history
            </p>
          </div>
        </div>
        <MockDetailClient
          endpoint={endpoint}
          initialRequests={requestsResult.data}
          initialMeta={requestsResult.meta}
        />
      </div>
    );
  } catch (error) {
    notFound();
  }
}

