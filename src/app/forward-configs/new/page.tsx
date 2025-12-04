import { Suspense } from 'react';
import { NewForwardConfigClient } from './new-forward-config-client';

export const dynamic = 'force-dynamic';

export default function NewForwardConfigPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewForwardConfigClient />
    </Suspense>
  );
}

