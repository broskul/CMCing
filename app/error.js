'use client';

import { useEffect } from 'react';

export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    console.error('Error de interfaz CMCing:', error);
  }, [error]);

  return (
    <div className="min-h-screen p-4 md:p-7">
      <section className="panel mx-auto max-w-2xl p-7 text-center">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-rose-700">Interrupción controlada</p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-950">No pudimos cargar esta vista</h1>
        <p className="mt-3 text-sm text-neutral-600">Tu trabajo guardado localmente se mantiene. Puedes reintentar sin perder el contexto actual.</p>
        <button type="button" onClick={reset} className="primary-action mt-6">Reintentar</button>
      </section>
    </div>
  );
}
