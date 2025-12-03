import { getLogById } from '../actions';
import { notFound } from 'next/navigation';
import { LogDetailClient } from './log-detail-client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface LogDetailPageProps {
  params: {
    id: string;
  };
}

export default async function LogDetailPage({ params }: LogDetailPageProps) {
  try {
    const log = await getLogById(params.id);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/logs">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Log Details</h1>
            <p className="text-muted-foreground mt-1">View detailed information about this log entry</p>
          </div>
        </div>
        <LogDetailClient log={log} />
      </div>
    );
  } catch (error) {
    notFound();
  }
}

