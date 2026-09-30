'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { getAuthToken } from '@/lib/auth/token';

async function checkBackend() {
  const { data } = await apiClient.get('/api/config');
  return data;
}

/** Render the DebugPanel component. */
export default function DebugPanel() {
  const token = getAuthToken();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['debug', 'config'],
    queryFn: checkBackend,
    retry: 0
  });

  return (
    <div className="fixed bottom-6 right-6 z-50 w-64 rounded-2xl border bg-white p-4 text-xs shadow-sm ">
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Debug</p>
      <div className="mt-3 space-y-2">
        <div className="flex items-center justify-between">
          <span>Token</span>
          <span className={token ? 'text-emerald-600' : 'text-rose-500'}>
            {token ? 'Present' : 'Missing'}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Backend</span>
          <span className={isError ? 'text-rose-500' : 'text-emerald-600'}>
            {isLoading ? 'Checking' : isError ? 'Offline' : 'Online'}
          </span>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          className="w-full rounded-full border border-border bg-white px-3 py-1"
        >
          Ping backend
        </button>
        {data && <pre className="max-h-24 overflow-auto text-[10px] text-muted-foreground">OK</pre>}
      </div>
    </div>
  );
}

