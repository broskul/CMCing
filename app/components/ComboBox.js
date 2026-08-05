'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

function defaultLabel(option) {
  return option?.label || option?.nombre || option?.titulo || option?.descripcion || String(option?.id || '');
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function ComboBox({
  options = [],
  value = '',
  onChange,
  getOptionLabel = defaultLabel,
  getOptionDescription,
  getOptionSearchText,
  placeholder = 'Buscar o seleccionar...',
  disabled = false,
  required = false,
  className = '',
  onCreateOption,
  createOptionLabel = 'Crear nuevo',
  emptyText = 'No hay coincidencias.',
  allowClear = true,
}) {
  const rawId = useId();
  const listId = `combo-${rawId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const normalizedOptions = useMemo(() => options.map((option) => ({
    option,
    id: String(option.id),
    label: String(getOptionLabel(option) || ''),
    description: getOptionDescription ? String(getOptionDescription(option) || '') : '',
    searchText: getOptionSearchText ? String(getOptionSearchText(option) || '') : '',
  })), [getOptionDescription, getOptionLabel, getOptionSearchText, options]);
  const selected = normalizedOptions.find((item) => item.id === String(value || ''));
  const filtered = useMemo(() => {
    const needle = normalizeSearch(query);
    if (!needle) return normalizedOptions;
    return normalizedOptions.filter((item) => normalizeSearch(`${item.label} ${item.description} ${item.searchText} ${item.id}`).includes(needle));
  }, [normalizedOptions, query]);

  useEffect(() => {
    const closeWhenOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', closeWhenOutside);
    return () => document.removeEventListener('pointerdown', closeWhenOutside);
  }, []);

  const safeActiveIndex = Math.min(activeIndex, Math.max(filtered.length - 1, 0));

  const choose = (item) => {
    onChange?.(item.id, item.option);
    setQuery('');
    setOpen(false);
    inputRef.current?.focus();
  };

  const clear = () => {
    onChange?.('', null);
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  };

  const create = () => {
    setOpen(false);
    onCreateOption?.(query.trim());
    setQuery('');
  };

  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && open) {
      event.preventDefault();
      if (filtered[safeActiveIndex]) choose(filtered[safeActiveIndex]);
      else if (onCreateOption) create();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setQuery('');
    } else if (event.key === 'Backspace' && !query && selected && allowClear) {
      clear();
    }
  };

  const displayValue = open ? query : (selected?.label || '');

  return (
    <div ref={rootRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && filtered[safeActiveIndex] ? `${listId}-${filtered[safeActiveIndex].id}` : undefined}
          value={displayValue}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => {
            setQuery('');
            setActiveIndex(0);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder={selected?.label || placeholder}
          disabled={disabled}
          required={required && !value}
          className={`input-base pr-20 ${className}`}
          autoComplete="off"
        />
        <div className="absolute inset-y-0 right-1 flex items-center gap-0.5">
          {allowClear && selected && !disabled ? (
            <button type="button" onClick={clear} className="rounded-md px-2 py-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-800" aria-label={`Quitar ${selected.label}`}>×</button>
          ) : null}
          <button type="button" onClick={() => { setOpen((current) => !current); inputRef.current?.focus(); }} disabled={disabled} className="rounded-md px-2 py-1 text-neutral-500 transition hover:bg-neutral-100 disabled:opacity-40" aria-label={open ? 'Cerrar listado' : 'Abrir listado'} aria-expanded={open}>⌄</button>
        </div>
      </div>

      {open && !disabled ? (
        <div id={listId} role="listbox" className="combo-popover absolute z-50 mt-1 max-h-72 w-full min-w-[15rem] overflow-y-auto rounded-xl border border-neutral-200 bg-white p-1.5 shadow-xl shadow-neutral-950/10">
          {filtered.map((item, index) => (
            <button
              id={`${listId}-${item.id}`}
              key={item.id}
              type="button"
              role="option"
              aria-selected={item.id === String(value || '')}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(item)}
              className={`flex w-full items-start justify-between gap-3 rounded-lg px-3 py-2 text-left text-[0.82rem] transition ${index === safeActiveIndex ? 'bg-sky-50 text-sky-950' : 'text-neutral-800 hover:bg-neutral-50'}`}
            >
              <span><span className="block font-medium">{item.label}</span>{item.description ? <span className="mt-0.5 block text-[0.7rem] text-neutral-500">{item.description}</span> : null}</span>
              {item.id === String(value || '') ? <span aria-hidden="true" className="font-semibold text-sky-700">✓</span> : null}
            </button>
          ))}
          {!filtered.length ? <p className="px-3 py-3 text-[0.78rem] text-neutral-500">{emptyText}</p> : null}
          {onCreateOption ? (
            <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={create} className="mt-1 flex w-full items-center gap-2 rounded-lg border-t border-neutral-100 px-3 py-2.5 text-left text-[0.8rem] font-semibold text-sky-700 transition hover:bg-sky-50">
              <span aria-hidden="true">＋</span>{createOptionLabel}{query.trim() ? ` “${query.trim()}”` : ''}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function MultiComboBox({
  options = [],
  values = [],
  onChange,
  getOptionLabel = defaultLabel,
  getOptionDescription,
  placeholder = 'Agregar...',
  disabled = false,
  emptyText = 'Sin elementos asignados.',
  onCreateOption,
  createOptionLabel,
}) {
  const selectedIds = values.map(String);
  const available = options.filter((option) => !selectedIds.includes(String(option.id)));
  const selectedOptions = selectedIds
    .map((id) => options.find((option) => String(option.id) === id))
    .filter(Boolean);

  const addValue = (id) => {
    if (!id || selectedIds.includes(String(id))) return;
    onChange?.([...selectedIds, String(id)]);
  };

  const removeValue = (id) => {
    onChange?.(selectedIds.filter((selectedId) => selectedId !== String(id)));
  };

  return (
    <div className="space-y-2">
      <ComboBox
        options={available}
        value=""
        onChange={addValue}
        getOptionLabel={getOptionLabel}
        getOptionDescription={getOptionDescription}
        placeholder={placeholder}
        disabled={disabled || (available.length === 0 && !onCreateOption)}
        allowClear={false}
        onCreateOption={onCreateOption}
        createOptionLabel={createOptionLabel}
      />
      <div className="flex min-h-8 flex-wrap gap-2">
        {selectedOptions.length ? selectedOptions.map((option) => (
          <span key={option.id} className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[0.78rem] font-medium text-sky-800">
            {getOptionLabel(option)}
            {!disabled ? (
              <button type="button" onClick={() => removeValue(option.id)} className="text-sky-500 hover:text-sky-900" aria-label={`Quitar ${getOptionLabel(option)}`}>×</button>
            ) : null}
          </span>
        )) : <span className="text-[0.78rem] text-neutral-500">{emptyText}</span>}
      </div>
    </div>
  );
}
