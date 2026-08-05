export default function Loading() {
  return (
    <div className="min-h-screen p-4 md:p-7" aria-busy="true" aria-live="polite">
      <div className="mx-auto max-w-7xl space-y-4">
        <div className="panel h-32 animate-pulse bg-white/70" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="panel h-28 animate-pulse bg-white/70" />
          <div className="panel h-28 animate-pulse bg-white/70" />
          <div className="panel h-28 animate-pulse bg-white/70" />
        </div>
        <p className="sr-only">Cargando CMCing 360…</p>
      </div>
    </div>
  );
}
