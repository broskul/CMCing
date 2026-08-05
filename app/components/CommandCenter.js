'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

export default function CommandCenter({ items, recentItems = [], onClose, onNavigate }) {
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const needle = normalize(query.trim());
    const source = needle ? items : (recentItems.length ? recentItems : items);
    if (!needle) return source.slice(0, 10);
    return source.filter((item) => normalize(`${item.label} ${item.group} ${item.keywords || ''}`).includes(needle)).slice(0, 12);
  }, [items, query, recentItems]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const safeActiveIndex = Math.min(activeIndex, Math.max(results.length - 1, 0));

  const choose = (item) => {
    if (!item) return;
    onNavigate(item);
    onClose();
  };

  return (
    <div className="command-center" role="dialog" aria-modal="true" aria-label="Navegación 360">
      <button type="button" className="command-center__backdrop" onClick={onClose} aria-label="Cerrar búsqueda" />
      <section className="command-center__panel">
        <div className="command-center__input-row">
          <span aria-hidden="true" className="command-center__symbol">⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, Math.max(results.length - 1, 0)));
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                choose(results[safeActiveIndex]);
              }
            }}
            placeholder="Ir a OT, actividad, cliente, equipo o módulo…"
            aria-label="Buscar en CMCing"
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-center__caption">{query ? 'Resultados' : recentItems.length ? 'Recientes' : 'Navegación 360'}</div>
        <div className="command-center__results" role="listbox">
          {results.length ? results.map((item, index) => (
            <button
              type="button"
              role="option"
              aria-selected={index === safeActiveIndex}
              key={item.href}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => choose(item)}
              className={index === safeActiveIndex ? 'is-active' : ''}
            >
              <span className="command-center__mark" aria-hidden="true">{item.short || '360'}</span>
              <span><strong>{item.label}</strong><small>{item.group}</small></span>
              <span aria-hidden="true">→</span>
            </button>
          )) : <p className="command-center__empty">No encontramos un destino con ese nombre.</p>}
        </div>
        <footer><span>↑↓ navegar</span><span>Enter abrir</span><span>Ctrl K desde cualquier pantalla</span></footer>
      </section>
    </div>
  );
}
