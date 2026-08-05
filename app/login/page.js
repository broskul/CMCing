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

const PASSWORD_UPDATED_NOTICE = 'Tu contraseña fue actualizada. Ya puedes ingresar con ella.';

function RequiredMarker() {
  return <span className="ml-1 text-rose-600" aria-hidden="true">*</span>;
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [error, setError] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [microsoftLoading, setMicrosoftLoading] = useState(false);
  const [recoveryLoading, setRecoveryLoading] = useState(false);
  const requestedNext = searchParams.get('next') || '/';
  const next = requestedNext.startsWith('/') && !requestedNext.startsWith('//') && !requestedNext.includes('\\')
    ? requestedNext
    : '/';
  const visibleError = error || LOGIN_ERRORS[searchParams.get('error')] || '';

  const handlePasswordRecovery = async (event) => {
    event.preventDefault();
    setRecoveryLoading(true);
    setRecoveryMessage('');

    try {
      const res = await fetch('/api/auth/password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: recoveryEmail }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) throw new Error(data?.error || 'No fue posible procesar la solicitud. Inténtalo nuevamente.');
      setRecoveryMessage(data?.message || 'Si el correo corresponde a una cuenta CMCing habilitada, recibirás instrucciones para definir una nueva contraseña.');
    } catch (recoveryError) {
      setRecoveryMessage(recoveryError.message || 'No fue posible procesar la solicitud. Inténtalo nuevamente.');
    } finally {
      setRecoveryLoading(false);
    }
  };

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
    <div className="panel w-full max-w-md space-y-5 p-7">
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
      <p className="text-center text-[0.76rem] text-neutral-500">También puedes ingresar con tu cuenta corporativa Microsoft 365.</p>
      <div className="flex items-center gap-3" aria-hidden="true">
        <span className="h-px flex-1 bg-neutral-200" />
        <span className="text-[0.72rem] font-medium uppercase tracking-[0.12em] text-neutral-400">o con contraseña</span>
        <span className="h-px flex-1 bg-neutral-200" />
      </div>
      <form onSubmit={handleSubmit} className="space-y-5">
        <label className="block text-[0.86rem] font-medium text-neutral-700">
          Correo<RequiredMarker />
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
          Contraseña<RequiredMarker />
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

      {searchParams.get('notice') === 'password_updated' ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[0.86rem] text-emerald-700">{PASSWORD_UPDATED_NOTICE}</p>
      ) : null}

      <div className="border-t border-neutral-200 pt-5">
        <p className="text-[0.82rem] font-medium text-neutral-700">¿Olvidaste o necesitas cambiar tu contraseña?</p>
        <p className="mt-1 text-[0.76rem] leading-5 text-neutral-500">
          Ingresa el correo con el que accedes a CMCing. Si tu cuenta está habilitada, recibirás un enlace seguro para definir una contraseña.
        </p>
        <form onSubmit={handlePasswordRecovery} className="mt-3 space-y-3">
          <label className="block text-[0.86rem] font-medium text-neutral-700">
            Correo de acceso<RequiredMarker />
            <input
              type="email"
              value={recoveryEmail}
              onChange={(event) => setRecoveryEmail(event.target.value)}
              className="input-base mt-1"
              autoComplete="email"
              required
            />
          </label>
          {recoveryMessage ? <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[0.82rem] leading-5 text-sky-800">{recoveryMessage}</p> : null}
          <button type="submit" disabled={recoveryLoading} className="w-full rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-[0.88rem] font-semibold text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60">
            {recoveryLoading ? 'Enviando instrucciones...' : 'Recuperar contraseña'}
          </button>
        </form>
      </div>
    </div>
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
