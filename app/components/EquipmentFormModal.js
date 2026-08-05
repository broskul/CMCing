'use client';

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from 'react';
import { BarcodeScanner } from './BarcodeScanner';
import { ComboBox } from './ComboBox';

const STATUS_OPTIONS = [
  { id: 'operativo', label: 'Operativo' },
  { id: 'mantenimiento', label: 'Mantenimiento' },
  { id: 'fuera_servicio', label: 'Fuera de servicio' },
];

function normalized(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function uniqueSuggestions(equipos, field, value) {
  const needle = normalized(value);
  if (!needle) return [];
  const seen = new Set();
  return equipos
    .map((equipo) => String(equipo?.[field] || '').trim())
    .filter((item) => item && normalized(item).includes(needle))
    .filter((item) => {
      const key = normalized(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return key !== needle;
    })
    .slice(0, 6);
}

function SuggestionInput({ label, name, value, onChange, equipos, placeholder, required = false, scanner = false, type = 'text', inputMode }) {
  const [focused, setFocused] = useState(false);
  const suggestions = useMemo(() => uniqueSuggestions(equipos, name, value), [equipos, name, value]);

  const update = (nextValue) => onChange({ target: { name, value: nextValue } });

  return (
    <label className="relative block">
      <span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">{label}</span>
      <div className="flex gap-2">
        <input
          name={name}
          type={type}
          value={value || ''}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 120)}
          placeholder={placeholder}
          required={required}
          className="input-base min-w-0 flex-1"
          autoComplete="off"
          inputMode={inputMode}
        />
        {scanner ? <BarcodeScanner label="Escanear" onDetected={update} /> : null}
      </div>
      {focused && suggestions.length ? (
        <div className="absolute z-[70] mt-1 max-h-44 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1 shadow-xl shadow-neutral-950/10">
          <p className="px-2 py-1 text-[0.68rem] font-medium uppercase tracking-wide text-neutral-400">Coincidencias existentes</p>
          {suggestions.map((suggestion) => (
            <button key={suggestion} type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => update(suggestion)} className="block w-full rounded-lg px-2 py-2 text-left text-[0.8rem] text-neutral-800 hover:bg-sky-50">
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </label>
  );
}

function EquipmentImageInput({ imageFile, imageUrl, onFileChange, onUrlChange, existingImageUrl = '' }) {
  const [dragging, setDragging] = useState(false);
  const [filePreview, setFilePreview] = useState('');
  const [inputError, setInputError] = useState('');

  useEffect(() => {
    if (!imageFile) return undefined;
    let active = true;
    const reader = new FileReader();
    reader.onload = () => {
      if (active) setFilePreview(String(reader.result || ''));
    };
    reader.readAsDataURL(imageFile);
    return () => {
      active = false;
      reader.abort();
    };
  }, [imageFile]);

  const preview = imageFile ? filePreview : (imageUrl || existingImageUrl || '');

  const acceptFile = (file) => {
    if (!file) return;
    if (!String(file.type || '').startsWith('image/')) {
      setInputError('Seleccione una imagen válida.');
      return;
    }
    if (Number(file.size || 0) > 12 * 1024 * 1024) {
      setInputError('La imagen supera el máximo de 12 MB.');
      return;
    }
    setInputError('');
    setFilePreview('');
    onUrlChange('');
    onFileChange(file);
  };

  return (
    <section className="entity-form-wide rounded-xl border border-dashed border-neutral-300 bg-neutral-50/70 p-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <label
          className={`flex min-h-28 flex-1 cursor-pointer items-center justify-center rounded-lg border border-dashed px-4 text-center text-[0.8rem] transition ${dragging ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-neutral-300 bg-white text-neutral-600 hover:border-sky-300 hover:bg-sky-50/50'}`}
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files?.[0]); }}
        >
          <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => acceptFile(event.target.files?.[0])} />
          <span><strong className="block text-neutral-800">Subir o arrastrar imagen</strong><span className="mt-1 block">JPG, PNG, WebP o GIF · máximo 12 MB</span></span>
        </label>
        <div className="w-full sm:w-40">
          {preview ? <img src={preview} alt="Vista previa" className="h-28 w-full rounded-lg border border-neutral-200 bg-white object-contain" /> : <div className="flex h-28 items-center justify-center rounded-lg border border-neutral-200 bg-white text-[0.75rem] text-neutral-400">Sin imagen</div>}
        </div>
      </div>
      <label className="mt-3 block text-[0.78rem] font-medium text-neutral-700">
        O pegar URL de imagen
        <input className="input-base mt-1" value={imageUrl} onChange={(event) => { setInputError(''); setFilePreview(''); onFileChange(null); onUrlChange(event.target.value); }} placeholder="https://…" inputMode="url" />
      </label>
      <p className="mt-2 text-[0.72rem] text-neutral-500">La imagen se copiará a almacenamiento privado de CMCing; no se conserva la URL externa.</p>
      {inputError ? <p className="mt-2 text-[0.75rem] text-rose-700">{inputError}</p> : null}
    </section>
  );
}

export function EquipmentFormModal({
  open,
  mode = 'create',
  formData,
  equipos = [],
  propietarios = [],
  onChange,
  onOwnerChange,
  onClose,
  onSubmit,
}) {
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const isEdit = mode === 'edit';
  const ownerValue = formData?.propietarioTipo === 'CMCING' ? 'CMCING' : String(formData?.clienteId || '');

  useEffect(() => {
    if (!open) return;
    setImageFile(null);
    setImageUrl('');
    setSaving(false);
    setError('');
  }, [open, formData?.id]);

  if (!open) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await onSubmit?.({ imageFile, imageUrl });
    } catch (submitError) {
      setError(submitError?.message || 'No se pudo guardar el equipo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="entity-modal-backdrop">
      <div className="entity-modal is-form max-h-[calc(100vh-2rem)] overflow-y-auto">
        <div className="entity-modal-header">
          <div>
            <p>activo</p>
            <h3>{isEdit ? 'Editar equipo' : 'Nuevo equipo'}</h3>
          </div>
          <button type="button" onClick={onClose}>Cerrar</button>
        </div>

        <form className="entity-form" onSubmit={handleSubmit}>
          {error ? <p className="entity-form-wide rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[0.8rem] text-rose-800">{error}</p> : null}

          <div className="entity-form-wide rounded-lg bg-sky-50 px-3 py-2 text-[0.78rem] text-sky-900">
            {isEdit ? <>Código interno <strong>{formData?.codigoInterno || 'No disponible'}</strong>. El propietario queda bloqueado después del alta.</> : <>El código interno se generará automáticamente al guardar, por ejemplo <strong>CMC-00001</strong>.</>}
          </div>

          <label>
            <span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Propietario</span>
            <ComboBox
              options={propietarios}
              value={ownerValue}
              onChange={(id, option) => onOwnerChange?.(id, option)}
              getOptionLabel={(option) => option.nombre}
              getOptionDescription={(option) => option.detalle}
              placeholder="Seleccione cliente o CMCing"
              emptyText="No hay clientes disponibles. Recargue la página o revise el catálogo de clientes."
              required
              disabled={isEdit || Boolean(formData?.propietarioBloqueado)}
              allowClear={false}
            />
          </label>

          <SuggestionInput label="Nombre" name="nombre" value={formData?.nombre} onChange={onChange} equipos={equipos} placeholder="Ej. Computadora de control" required />
          <SuggestionInput label="Fabricante" name="fabricante" value={formData?.fabricante} onChange={onChange} equipos={equipos} placeholder="Ej. Dell" />
          <SuggestionInput label="Modelo" name="modelo" value={formData?.modelo} onChange={onChange} equipos={equipos} placeholder="Ej. OptiPlex 7010" />
          <SuggestionInput label="Part Number" name="partNumber" value={formData?.partNumber} onChange={onChange} equipos={equipos} placeholder="Número de parte del fabricante" scanner />
          <SuggestionInput label="Número de serie" name="serial" value={formData?.serial} onChange={onChange} equipos={equipos} placeholder="Opcional" scanner />
          <SuggestionInput label="EAN (opcional)" name="ean" value={formData?.ean} onChange={onChange} equipos={equipos} placeholder="8, 13 o 14 dígitos" scanner inputMode="numeric" />
          <SuggestionInput label="Ubicación" name="ubicacion" value={formData?.ubicacion} onChange={onChange} equipos={equipos} placeholder="Opcional" />

          <label>
            <span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Estado operativo</span>
            <ComboBox options={STATUS_OPTIONS} value={formData?.estadoOperativo || 'operativo'} onChange={(id) => onChange?.({ target: { name: 'estadoOperativo', value: id } })} allowClear={false} />
          </label>

          <EquipmentImageInput imageFile={imageFile} imageUrl={imageUrl} onFileChange={setImageFile} onUrlChange={setImageUrl} existingImageUrl={formData?.imagenR2Key ? `/api/r2/private?key=${encodeURIComponent(formData.imagenR2Key)}` : formData?.imagenUrl} />

          <label className="entity-form-wide">
            <span className="mb-1 block text-[0.78rem] font-medium text-neutral-700">Observaciones</span>
            <textarea name="observaciones" className="input-base min-h-24" value={formData?.observaciones || ''} onChange={onChange} />
          </label>

          <div className="entity-form-actions">
            <button type="submit" className="primary-action" disabled={saving}>{saving ? 'Guardando…' : 'Guardar equipo'}</button>
            <button type="button" className="secondary-action" onClick={onClose} disabled={saving}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}
