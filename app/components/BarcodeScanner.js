'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export function normalizeScannedCode(value) {
  return String(value || '').trim().replace(/[\u0000-\u001f]+/g, '');
}

export function BarcodeScanner({ onDetected, label = 'Escanear código', className = '' }) {
  const videoRef = useRef(null);
  const deliveredRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [manualValue, setManualValue] = useState('');

  const deliver = useCallback((value) => {
    const code = normalizeScannedCode(value);
    if (!code || deliveredRef.current) return;
    deliveredRef.current = true;
    onDetected?.(code);
    setOpen(false);
  }, [onDetected]);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    let controls = null;
    deliveredRef.current = false;
    setStatus('Abriendo cámara…');

    const start = async () => {
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
        if (cancelled || !videoRef.current) return;
        const reader = new BrowserMultiFormatReader();
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } }, audio: false },
          videoRef.current,
          (result) => {
            if (result) deliver(result.getText());
          },
        );
        if (!cancelled) setStatus('Enfoque el código dentro del recuadro.');
      } catch (error) {
        if (!cancelled) {
          setStatus(error?.name === 'NotAllowedError'
            ? 'Permita el acceso a la cámara para escanear.'
            : 'No fue posible abrir la cámara. Puede ingresar el código manualmente.');
        }
      }
    };

    start();
    return () => {
      cancelled = true;
      controls?.stop();
    };
  }, [deliver, open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={`rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-2 text-[0.75rem] font-semibold text-sky-800 transition hover:bg-sky-100 ${className}`}>
        {label}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80] flex items-end bg-neutral-950/45 p-3 sm:items-center sm:justify-center" role="dialog" aria-modal="true" aria-label="Lector de código de barras">
          <div className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.15em] text-sky-700">Lector</p>
                <h3 className="mt-0.5 text-[1rem] font-semibold text-neutral-900">Código de barras</h3>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-[0.8rem] font-medium text-neutral-600 hover:bg-neutral-100">Cerrar</button>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl bg-neutral-950">
              <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline />
            </div>
            <p className="mt-2 text-[0.78rem] text-neutral-600">{status}</p>
            <div className="mt-4 border-t border-neutral-200 pt-3">
              <label className="block text-[0.76rem] font-medium text-neutral-700">
                Ingresar código manualmente
                <div className="mt-1 flex gap-2">
                  <input className="input-base min-w-0" value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="EAN, serial o Part Number" />
                  <button type="button" onClick={() => deliver(manualValue)} className="secondary-action shrink-0">Usar</button>
                </div>
              </label>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
