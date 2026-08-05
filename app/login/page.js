'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

const LOGIN_ERRORS = {
  auth_configuration: 'La autenticación aún no está configurada para este entorno.',
  email_not_allowed: 'Use una cuenta corporativa @cmcing.cl autorizada.',
  microsoft_unavailable: 'Microsoft 365 no está disponible en este momento.',
  oauth_exchange: 'Microsoft no pudo completar el inicio de sesión. Intente nuevamente.',
  oauth_identity: 'Microsoft no entregó una identidad válida.',
  oauth_missing_code: 'La respuesta de Microsoft está incompleta. Intente nuevamente.',
  profile_inactive: 'Su cuenta CMCing está deshabilitada.',
  profile_missing: 'Su cuenta Microsoft todavía no tiene un perfil habilitado en CMCing.',
  profile_conflict: 'La cuenta está vinculada a otra identidad. Contacte a un administrador.',
  profile_error: 'No fue posible validar su perfil CMCing.',
  profile_required: 'Su cuenta no tiene acceso habilitado a esta aplicación.',
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);
  const requestedNext = searchParams.get('next') || '/';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') && !requestedNext.includes('\\')
    ? requestedNext
    : '/';
  const visibleError = error || LOGIN_ERRORS[searchParams.get('error')] || '';

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

      router.replace(next);
      router.refresh();
    } catch (loginError) {
      setError(loginError.message);
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = () => {
    setMicrosoftLoading(true);
    setError('');
    window.location.assign(`/api/auth/microsoft?next=${encodeURIComponent(next)}`);
  };

  return (
    <form onSubmit={handleSubmit} className="panel w-full max-w-md space-y-5 p-7">
      <div className="flex justify-center">
        <Image src="/brand/logo-cmcing.png" alt="CMCing" width={220} height={80} className="h-14 w-auto object-contain" priority />
      </div>
      <div>
        <h1 className="text-center text-[1.45rem] font-semibold text-neutral-900">Ingreso CMCing</h1>
      </div>
      <button
        type="button"
        onClick={handleMicrosoftLogin}
        disabled={microsoftLoading || loading}
        className="w-full rounded-lg bg-[#0f6cbd] px-4 py-2.5 text-[0.92rem] font-semibold text-white transition hover:bg-[#115ea3] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {microsoftLoading ? 'Conectando con Microsoft...' : 'Continuar con Microsoft 365'}
      </button>
      <p className="text-center text-[0.76rem] text-neutral-500">Acceso corporativo para cuentas @cmcing.cl</p>
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-[0.72rem] font-medium uppercase tracking-[0.12em] text-neutral-400">acceso administrativo</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>
      <label className="block text-[0.86rem] font-medium text-neutral-700">
        Correo
        <input
          type="email"
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
      {visibleError ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[0.86rem] text-rose-700">{visibleError}</p> : null}
      <button type="submit" disabled={loading || microsoftLoading} className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-[0.92rem] font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60">
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
