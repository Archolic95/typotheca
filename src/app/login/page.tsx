'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';

function LoginInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'checking' | 'success' | 'error'>('checking');

  useEffect(() => {
    const key = searchParams.get('key');
    if (!key) { setStatus('error'); return; }

    // Set admin cookie via API
    fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key }) })
      .then(res => {
        if (res.ok) { setStatus('success'); setTimeout(() => router.push('/gallery'), 500); }
        else setStatus('error');
      })
      .catch(() => setStatus('error'));
  }, [searchParams, router]);

  return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-center">
        {status === 'checking' && <p className="text-neutral-400 text-sm">Authenticating...</p>}
        {status === 'success' && <p className="text-emerald-400 text-sm">Authenticated. Redirecting...</p>}
        {status === 'error' && <p className="text-red-400 text-sm">Invalid or missing key.</p>}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return <Suspense fallback={<div className="min-h-screen bg-black" />}><LoginInner /></Suspense>;
}
