"use client";

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function MusicPage() {
  const router = useRouter();

  useEffect(() => {
    router.push('/');
  }, [router]);

  return (
    <div className="container py-8">
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Page Temporarily Disabled</h1>
          <p className="text-muted-foreground">Redirecting to home page...</p>
        </div>
      </div>
    </div>
  );
}
