'use client';

export default function GlobalError({ reset }) {
  return (
    <html lang="es">
      <body className="app-shell">
        <main className="grid min-h-screen place-items-center bg-slate-50 p-5">
          <section className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-xl">
            <h1 className="text-2xl font-semibold text-slate-950">CMCing necesita volver a cargar</h1>
            <p className="mt-3 text-sm text-slate-600">La aplicación detuvo esta vista para proteger la operación.</p>
            <button type="button" onClick={reset} className="mt-6 rounded-xl bg-slate-950 px-5 py-3 font-semibold text-white">Volver a intentar</button>
          </section>
        </main>
      </body>
    </html>
  );
}
