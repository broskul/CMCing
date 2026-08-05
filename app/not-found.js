import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen p-4 md:p-7">
      <section className="panel mx-auto max-w-2xl p-7 text-center">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-sky-700">Navegación 360</p>
        <h1 className="mt-2 text-2xl font-semibold text-neutral-950">Este destino no existe</h1>
        <p className="mt-3 text-sm text-neutral-600">Vuelve al resumen o usa Ctrl K para llegar a cualquier módulo disponible.</p>
        <Link href="/" className="primary-action mt-6 inline-flex">Ir al resumen</Link>
      </section>
    </div>
  );
}
