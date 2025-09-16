"use client";

import React from 'react';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/header';
import { Sidebar } from '@/components/layout/sidebar';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const hideChrome = pathname?.startsWith('/auth');

  if (hideChrome) {
    // No header/sidebar on auth pages (e.g., /auth/login)
    return (
      <main className="min-h-screen">
        {children}
      </main>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto py-2">
          {children}
        </main>
      </div>
    </div>
  );
}
