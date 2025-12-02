import { getErrorLogById } from '../actions';
import { notFound } from 'next/navigation';
import { ErrorLogDetailClient } from './error-log-detail-client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface ErrorLogDetailPageProps {
  params: {
    id: string;
  };
}

export default async function ErrorLogDetailPage({ params }: ErrorLogDetailPageProps) {
  try {
    const errorLog = await getErrorLogById(params.id);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/errors">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Error Log Details</h1>
            <p className="text-muted-foreground mt-1">View detailed information about this error</p>
          </div>
        </div>
        <ErrorLogDetailClient errorLog={errorLog} />
      </div>
    );
  } catch (error) {
    notFound();
  }
}

