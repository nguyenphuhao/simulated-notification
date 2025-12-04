import { Suspense } from 'react';
import { getForwardConfigById } from '../../actions';
import { EditForwardConfigClient } from './edit-forward-config-client';

interface EditForwardConfigPageProps {
  params: {
    id: string;
  };
}

export default async function EditForwardConfigPage({
  params,
}: EditForwardConfigPageProps) {
  const result = await getForwardConfigById(params.id);

  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EditForwardConfigClient initialConfig={result.data} />
    </Suspense>
  );
}

