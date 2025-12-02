import { Suspense } from 'react';
import { NewMockClient } from './new-mock-client';

export const dynamic = 'force-dynamic';

export default function NewMockPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create Mock Endpoint</h1>
        <p className="text-muted-foreground mt-1">
          Create a new mock API endpoint with custom response
        </p>
      </div>
      <NewMockClient />
    </div>
  );
}

