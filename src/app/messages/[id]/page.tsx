import { getMessageById } from '../actions';
import { notFound } from 'next/navigation';
import { MessageDetailClient } from './message-detail-client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

interface MessageDetailPageProps {
  params: {
    id: string;
  };
}

export default async function MessageDetailPage({ params }: MessageDetailPageProps) {
  try {
    const message = await getMessageById(params.id);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/messages">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">Message Details</h1>
            <p className="text-muted-foreground mt-1">View detailed information about this request</p>
          </div>
        </div>
        <MessageDetailClient message={message} />
      </div>
    );
  } catch (error) {
    notFound();
  }
}

