import { Suspense } from 'react';
import { NewForwardConfigClient } from './new-forward-config-client';

export default function NewForwardConfigPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <NewForwardConfigClient />
    </Suspense>
  );
}

