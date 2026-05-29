'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import AppSidebar from './AppSidebar';

export default function AppShell({ children }) {
  const pathname = usePathname();

  if (pathname === '/login') {
    return children;
  }

  return (
    <div className="app-layout">
      <Suspense fallback={null}>
        <AppSidebar />
      </Suspense>
      <main className="app-main">
        {children}
      </main>
    </div>
  );
}
