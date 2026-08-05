'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSupabaseBrowserClient } from '../../lib/supabase-browser';

const PASSWORD_HINT = 'Mínimo 12 caracteres, con minúscula, mayúscula, número y símbolo.';

function RequiredMarker() {
  return <span className="ml-1 text-rose-600" aria-hidden="true">*</span>;
}

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({ password: '', confirmPassword: '' });
  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;

    const verifyRecoverySession = async () => {
      try {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw new Error('El enlace de recuperación no está activo. Solicita uno nuevo desde el ingreso.');
        if (active) setStatus('ready');
      } catch (recoveryError) {
        if (!active) return;
        setStatus('invalid');
        setMessage(recoveryError.message || 'El enlace de recuperación no está activo. Solicita uno nuevo desde el ingreso.');
      }
    };

    verifyRecoverySession();
    return () => { active = false; };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (status !== 'ready') return;
    setStatus('saving');
    setMessage('');

    try {
      const res = await fetch('/api/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || 'No fue posible actualizar la contraseña.');

      router.replace('/login?notice=password_updated');
      router.refresh();
    } catch (updateError) {
      setStatus('ready');
      setMessage(updateError.message || 'No fue posible actualizar la contraseña.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <section className="panel w-full max-w-md space-y-5 p-7" aria-live="polite">
        <div className="flex justify-center">
          <Image src="/brand/logo-cmcing.png" alt="CMCing" width={220} height={80} className="h-14 w-auto object-contain" priority />
        </div>
        <div className="space-y-2 text-center">
          <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-sky-700">Acceso protegido</p>
          <h1 className="text-[1.45rem] font-semibold text-neutral-900">Define tu nueva contraseña</h1>
          <p className="text-[0.86rem] leading-6 text-neutral-600">Podrás usar esta contraseña para ingresar a CMCing, además de Microsoft 365 si tu cuenta corporativa está vinculada.</p>
        </div>

        {message ? <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[0.86rem] text-rose-700">{message}</p> : null}

        {status === 'checking' ? <p className="text-center text-[0.86rem] text-neutral-500">Validando el enlace de recuperación...</p> : null}

        {status === 'ready' || status === 'saving' ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-[0.86rem] font-medium text-neutral-700">
              Nueva contraseña<RequiredMarker />
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((previous) => ({ ...previous, password: event.target.value }))}
                className="input-base mt-1"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </label>
            <label className="block text-[0.86rem] font-medium text-neutral-700">
              Repite la nueva contraseña<RequiredMarker />
              <input
                type="password"
                value={form.confirmPassword}
                onChange={(event) => setForm((previous) => ({ ...previous, confirmPassword: event.target.value }))}
                className="input-base mt-1"
                autoComplete="new-password"
                minLength={12}
                required
              />
            </label>
            <p className="text-[0.76rem] leading-5 text-neutral-500">{PASSWORD_HINT}</p>
            <button type="submit" disabled={status === 'saving'} className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-[0.92rem] font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60">
              {status === 'saving' ? 'Actualizando contraseña...' : 'Guardar nueva contraseña'}
            </button>
          </form>
        ) : null}

        <Link href="/login" className="block text-center text-[0.82rem] font-medium text-sky-700 hover:text-sky-900">Volver al ingreso</Link>
      </section>
    </div>
  );
}
