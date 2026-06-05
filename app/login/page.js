'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo iniciar sesión.');
      }

      router.replace(searchParams.get('next') || '/');
      router.refresh();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="panel w-full max-w-md space-y-5 p-7">
      <div className="flex justify-center">
        <Image src="/brand/logo-cmcing.png" alt="CMCiing" width={220} height={80} className="h-14 w-auto object-contain" priority />
      </div>
      <div>
        <h1 className="text-center text-[1.45rem] font-semibold text-neutral-900">Ingreso CMCing</h1>
      </div>
      <label className="block text-[0.86rem] font-medium text-neutral-700">
        Usuario
        <input
          type="text"
          value={form.email}
          onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          className="input-base mt-1"
          autoComplete="username"
          required
        />
      </label>
      <label className="block text-[0.86rem] font-medium text-neutral-700">
        Contraseña
        <input
          type="password"
          value={form.password}
          onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
          className="input-base mt-1"
          autoComplete="current-password"
          required
        />
      </label>
      {error ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[0.86rem] text-rose-700">{error}</p> : null}
      <button type="submit" disabled={loading} className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-[0.92rem] font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60">
        {loading ? 'Ingresando...' : 'Ingresar'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <Suspense fallback={<div className="panel p-6">Cargando...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
