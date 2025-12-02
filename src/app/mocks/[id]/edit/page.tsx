import { getMockEndpointById } from '../../actions';
import { notFound } from 'next/navigation';
import { EditMockClient } from './edit-mock-client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

interface EditMockPageProps {
  params: {
    id: string;
  };
}

export default async function EditMockPage({ params }: EditMockPageProps) {
  try {
    const endpoint = await getMockEndpointById(params.id);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href={`/mocks/${params.id}`}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Edit Mock Endpoint</h1>
            <p className="text-muted-foreground mt-1">
              Update endpoint configuration
            </p>
          </div>
        </div>
        <EditMockClient endpoint={endpoint} />
      </div>
    );
  } catch (error) {
    notFound();
  }
}

