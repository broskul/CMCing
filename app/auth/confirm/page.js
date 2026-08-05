'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { getSupabaseBrowserClient } from '../../lib/supabase-browser';

const ALLOWED_OTP_TYPES = new Set([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

function safeNextPath(value) {
  const candidate = String(value || '').trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return '/';

  try {
    const parsed = new URL(candidate, 'https://cmcing.local');
    if (parsed.origin !== 'https://cmcing.local') return '/';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/';
  }
}

function ConfirmAccess() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = String(searchParams.get('token_hash') || '').trim();
  const type = String(searchParams.get('type') || '').trim().toLowerCase();
  const next = safeNextPath(searchParams.get('next'));
  const validRequest = Boolean(tokenHash) && ALLOWED_OTP_TYPES.has(type);
  const [status, setStatus] = useState(validRequest ? 'ready' : 'invalid');
  const [message, setMessage] = useState(
    validRequest ? '' : 'El enlace está incompleto o no corresponde a un tipo de confirmación válido.'
  );

  const confirm = async () => {
    if (!validRequest || status === 'verifying') return;
    setStatus('verifying');
    setMessage('');

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type,
      });

      if (error) throw new Error('El enlace expiró, ya fue utilizado o no es válido. Solicite uno nuevo.');

      const sessionResponse = await fetch('/api/auth/session', {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });

      const sessionResult = await sessionResponse.json().catch(() => null);
      if (!sessionResponse.ok || !sessionResult?.user) {
        await supabase.auth.signOut({ scope: 'local' });
        throw new Error(sessionResult?.error || 'La cuenta no tiene acceso habilitado a CMCing.');
      }

      const recovery = type === 'recovery';
      setStatus('success');
      setMessage(recovery ? 'Identidad confirmada. Define tu nueva contraseña.' : 'Identidad confirmada. Ingresando a CMCing...');
      router.replace(recovery ? '/auth/update-password' : next);
      router.refresh();
    } catch (error) {
      setStatus('error');
      setMessage(error.message || 'No fue posible confirmar el acceso.');
    }
  };

  return (
    <section className="panel w-full max-w-md space-y-5 p-7" aria-live="polite">
      <div className="flex justify-center">
        <Image src="/brand/logo-cmcing.png" alt="CMCing" width={220} height={80} className="h-14 w-auto object-contain" priority />
      </div>
      <div className="space-y-2 text-center">
        <p className="text-[0.75rem] font-semibold uppercase tracking-[0.16em] text-sky-700">Acceso protegido</p>
        <h1 className="text-[1.45rem] font-semibold text-neutral-900">Confirma tu identidad</h1>
        <p className="text-[0.86rem] leading-6 text-neutral-600">
          Por seguridad, el enlace no se procesa automáticamente. Pulsa el botón para confirmar que eres tú.
        </p>
      </div>

      {message ? (
        <p className={`rounded-lg border px-3 py-2 text-[0.86rem] ${status === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-rose-200 bg-rose-50 text-rose-700'}`}>
          {message}
        </p>
      ) : null}

      <button
        type="button"
        onClick={confirm}
        disabled={!validRequest || status === 'verifying' || status === 'success'}
        className="w-full rounded-lg bg-neutral-900 px-4 py-2.5 text-[0.92rem] font-semibold text-white transition hover:bg-neutral-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === 'verifying' ? 'Confirmando...' : status === 'success' ? 'Confirmado' : type === 'recovery' ? 'Confirmar y crear contraseña' : 'Confirmar y continuar'}
      </button>

      <Link href="/login" className="block text-center text-[0.82rem] font-medium text-sky-700 hover:text-sky-900">
        Volver al ingreso
      </Link>
    </section>
  );
}

export default function ConfirmPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-5">
      <Suspense fallback={<div className="panel p-6">Preparando confirmación...</div>}>
        <ConfirmAccess />
      </Suspense>
    </div>
  );
}
