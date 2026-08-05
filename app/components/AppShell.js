'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';
import AppSidebar from './AppSidebar';

export default function AppShell({ children }) {
  const pathname = usePathname();
  const fieldMode = pathname === '/tecnico' || pathname.startsWith('/tecnico/');

  if (pathname === '/login' || pathname.startsWith('/auth/')) {
    return children;
  }

  return (
    <div className={`app-layout ${fieldMode ? 'app-layout--field' : ''}`}>
      <Suspense fallback={null}>
        <AppSidebar />
      </Suspense>
      <main className={`app-main ${fieldMode ? 'app-main--field' : ''}`}>
        {children}
      </main>
    </div>
  );
}
