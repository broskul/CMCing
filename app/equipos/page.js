'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from 'react';

const EMPTY_EQUIPO_FORM = {
  sku: '',
  codigoInterno: '',
  nombre: '',
  modelo: '',
  serial: '',
  fabricante: '',
  ubicacion: '',
  estadoOperativo: 'operativo',
  criticidad: 'media',
  clienteId: '',
  imagenUrl: '',
  observaciones: '',
};

const ESTADO_OPTIONS = [
  { value: 'operativo', label: 'Operativo' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
  { value: 'fuera_servicio', label: 'Fuera de servicio' },
];

const CRITICIDAD_OPTIONS = [
  { value: 'baja', label: 'Baja' },
  { value: 'media', label: 'Media' },
  { value: 'alta', label: 'Alta' },
  { value: 'critica', label: 'Crítica' },
];

const statusTone = {
  operativo: 'is-good',
  operativa: 'is-good',
  disponible: 'is-good',
  mantenimiento: 'is-warning',
  mantencion: 'is-warning',
  revision: 'is-warning',
  fuera_servicio: 'is-danger',
  inactivo: 'is-danger',
};

const criticidadTone = {
  baja: 'is-good',
  media: 'is-warning',
  alta: 'is-danger',
  critica: 'is-danger',
};

function compactText(value, fallback = '-') {
  if (value === null || typeof value === 'undefined' || value === '') return fallback;
  return String(value);
}

function normalizeKey(value) {
  return compactText(value, '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '_');
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return compactText(value);
  return date.toLocaleDateString('es-CL', { dateStyle: 'medium' });
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return compactText(value);
  return date.toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });
}

function formatMoney(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: 'CLP',
    maximumFractionDigits: 0,
  }).format(number);
}

function getEquipoCode(equipo) {
  return equipo?.sku || equipo?.codigoInterno || (equipo?.id ? `EQ-${equipo.id}` : 'Equipo');
}

function getInitials(value) {
  return compactText(value, 'Equipo')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

function getImageSrc(value) {
  const src = compactText(value, '').trim();
  if (!src || src.startsWith('r2://')) return '';
  return src;
}

function uniqueById(items) {
  const seen = new Set();
  return (items || []).filter((item) => {
    if (!item?.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function buildRelatedServices(visitas = []) {
  const grouped = new Map();

  visitas.forEach((visita) => {
    const servicio = visita.servicio || null;
    const key = servicio?.id || visita.servicioId || 'sin-servicio';
    if (!grouped.has(key)) {
      grouped.set(key, {
        id: servicio?.id || visita.servicioId || null,
        descripcion: servicio?.descripcion || 'Servicio sin nombre',
        tipo: servicio?.tipo || '',
        precio: servicio?.precio || 0,
        visitas: [],
        tecnicos: [],
        ultimaFecha: null,
      });
    }

    const item = grouped.get(key);
    item.visitas.push(visita);
    if (visita.tecnico) item.tecnicos = uniqueById([...item.tecnicos, visita.tecnico]);
    const candidateDate = visita.fechaCierre || visita.fecha;
    if (!item.ultimaFecha || new Date(candidateDate).getTime() > new Date(item.ultimaFecha).getTime()) {
      item.ultimaFecha = candidateDate;
    }
  });

  return [...grouped.values()].sort((a, b) => new Date(b.ultimaFecha || 0).getTime() - new Date(a.ultimaFecha || 0).getTime());
}

function EntityBadge({ value, tone = '' }) {
  return <span className={`entity-badge ${tone}`}>{compactText(value)}</span>;
}

function Fact({ label, value }) {
  return (
    <div className="entity-fact">
      <dt>{label}</dt>
      <dd>{compactText(value)}</dd>
    </div>
  );
}

function EntityLink({ children, onClick }) {
  return (
    <button type="button" className="entity-link" onClick={onClick}>
      {children}
    </button>
  );
}

function EquipoImage({ equipo, large = false }) {
  const [hasError, setHasError] = useState(false);
  const src = getImageSrc(equipo?.imagenUrl);

  return (
    <div className={large ? 'asset-photo is-large' : 'asset-photo'}>
      {src && !hasError ? (
        <img
          src={src}
          alt={compactText(equipo?.nombre, 'Equipo')}
          loading="lazy"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="asset-photo-fallback">{getInitials(equipo?.nombre || equipo?.modelo || equipo?.serial)}</div>
      )}
    </div>
  );
}

function RelationList({ title, items, emptyLabel, renderItem }) {
  return (
    <section className="relation-section">
      <h4>{title}</h4>
      {items.length ? (
        <div className="relation-list">
          {items.map(renderItem)}
        </div>
      ) : (
        <p className="relation-empty">{emptyLabel}</p>
      )}
    </section>
  );
}

function RelationModal({ relation, data, onClose, onOpen }) {
  if (!relation) return null;

  const { clientes, equipos, servicios, tecnicos, visitas } = data;
  const id = Number(relation.id);
  const type = relation.type;
  const cliente = type === 'cliente' ? clientes.find((item) => item.id === id) : null;
  const equipo = type === 'equipo' ? equipos.find((item) => item.id === id) : null;
  const servicio = type === 'servicio' ? servicios.find((item) => item.id === id) : null;
  const tecnico = type === 'tecnico' ? tecnicos.find((item) => item.id === id) : null;
  const visita = type === 'visita' ? visitas.find((item) => item.id === id) : null;

  const title = cliente?.nombre
    || equipo?.nombre
    || servicio?.descripcion
    || tecnico?.nombre
    || visita?.descripcion
    || `Detalle ${type}`;

  const visitasRelacionadas = visitas.filter((item) => {
    if (type === 'cliente') return item.clienteId === id;
    if (type === 'equipo') return (item.equipos || []).some((linked) => linked.id === id) || item.equipoId === id;
    if (type === 'servicio') return item.servicioId === id;
    if (type === 'tecnico') return item.tecnicoId === id;
    return false;
  });

  const serviciosRelacionados = uniqueById(visitasRelacionadas.map((item) => item.servicio).filter(Boolean));
  const tecnicosRelacionados = uniqueById(visitasRelacionadas.map((item) => item.tecnico).filter(Boolean));
  const equiposRelacionados = uniqueById(visitasRelacionadas.flatMap((item) => item.equipos || (item.equipo ? [item.equipo] : [])).filter(Boolean));

  return (
    <div className="entity-modal-backdrop">
      <div className="entity-modal">
        <div className="entity-modal-header">
          <div>
            <p>{type}</p>
            <h3>{compactText(title)}</h3>
          </div>
          <button type="button" onClick={onClose}>Cerrar</button>
        </div>

        {type === 'visita' && visita ? (
          <div className="relation-summary">
            <Fact label="Fecha" value={formatDateTime(visita.fecha)} />
            <Fact label="Estado" value={visita.estado} />
            <Fact label="Descripción" value={visita.descripcion} />
            <Fact label="Notas" value={visita.notasTecnicas} />
            <div className="relation-chip-row">
              {visita.cliente ? <EntityLink onClick={() => onOpen('cliente', visita.cliente.id)}>{visita.cliente.nombre}</EntityLink> : null}
              {visita.servicio ? <EntityLink onClick={() => onOpen('servicio', visita.servicio.id)}>{visita.servicio.descripcion}</EntityLink> : null}
              {visita.tecnico ? <EntityLink onClick={() => onOpen('tecnico', visita.tecnico.id)}>{visita.tecnico.nombre}</EntityLink> : null}
              {(visita.equipos || []).map((item) => (
                <EntityLink key={item.id} onClick={() => onOpen('equipo', item.id)}>{item.nombre}</EntityLink>
              ))}
            </div>
          </div>
        ) : null}

        {type === 'servicio' && servicio ? (
          <div className="relation-summary">
            <Fact label="Tipo" value={servicio.tipo} />
            <Fact label="Precio" value={formatMoney(servicio.precio)} />
            <Fact label="Duración" value={servicio.duracionEstimadaMin ? `${servicio.duracionEstimadaMin} min` : '-'} />
            <Fact label="Activo" value={servicio.activo === false ? 'No' : 'Sí'} />
          </div>
        ) : null}

        {type === 'tecnico' && tecnico ? (
          <div className="relation-summary">
            <Fact label="Especialidad" value={tecnico.especialidad} />
            <Fact label="Email" value={tecnico.email} />
            <Fact label="Teléfono" value={tecnico.telefono} />
            <Fact label="Activo" value={tecnico.activo === false ? 'No' : 'Sí'} />
          </div>
        ) : null}

        {type === 'cliente' && cliente ? (
          <div className="relation-summary">
            <Fact label="Email" value={cliente.email} />
            <Fact label="Teléfono" value={cliente.telefono} />
            <Fact label="Dirección" value={cliente.direccion} />
          </div>
        ) : null}

        <div className="relation-grid">
          <RelationList
            title="Visitas"
            items={type === 'visita' ? [] : visitasRelacionadas}
            emptyLabel="Sin visitas."
            renderItem={(item) => (
              <button key={item.id} type="button" className="relation-item" onClick={() => onOpen('visita', item.id)}>
                <strong>{item.servicio?.descripcion || item.descripcion || `Visita ${item.id}`}</strong>
                <span>{formatDateTime(item.fecha)} · {item.estado || '-'}</span>
              </button>
            )}
          />

          <RelationList
            title="Servicios"
            items={type === 'servicio' ? [] : serviciosRelacionados}
            emptyLabel="Sin servicios."
            renderItem={(item) => (
              <button key={item.id} type="button" className="relation-item" onClick={() => onOpen('servicio', item.id)}>
                <strong>{item.descripcion}</strong>
                <span>{item.tipo || '-'} · {formatMoney(item.precio)}</span>
              </button>
            )}
          />

          <RelationList
            title="Técnicos"
            items={type === 'tecnico' ? [] : tecnicosRelacionados}
            emptyLabel="Sin técnicos."
            renderItem={(item) => (
              <button key={item.id} type="button" className="relation-item" onClick={() => onOpen('tecnico', item.id)}>
                <strong>{item.nombre}</strong>
                <span>{item.especialidad || item.email || '-'}</span>
              </button>
            )}
          />

          <RelationList
            title="Equipos"
            items={type === 'equipo' ? [] : equiposRelacionados}
            emptyLabel="Sin equipos."
            renderItem={(item) => (
              <button key={item.id} type="button" className="relation-item" onClick={() => onOpen('equipo', item.id)}>
                <strong>{item.nombre}</strong>
                <span>{item.serial || item.modelo || '-'}</span>
              </button>
            )}
          />
        </div>
      </div>
    </div>
  );
}

function EquipoFormModal({ open, mode, formData, clientes, onChange, onClose, onSubmit }) {
  if (!open) return null;

  return (
    <div className="entity-modal-backdrop">
      <div className="entity-modal is-form">
        <div className="entity-modal-header">
          <div>
            <p>equipo</p>
            <h3>{mode === 'edit' ? 'Editar equipo' : 'Nuevo equipo'}</h3>
          </div>
          <button type="button" onClick={onClose}>Cerrar</button>
        </div>

        <form className="entity-form" onSubmit={onSubmit}>
          <label>
            Cliente
            <select name="clienteId" value={formData.clienteId || ''} onChange={onChange}>
              <option value="">Sin cliente</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>{cliente.nombre}</option>
              ))}
            </select>
          </label>

          <label>
            Nombre
            <input name="nombre" value={formData.nombre || ''} onChange={onChange} required />
          </label>

          <label>
            SKU
            <input name="sku" value={formData.sku || ''} onChange={onChange} />
          </label>

          <label>
            Código interno
            <input name="codigoInterno" value={formData.codigoInterno || ''} onChange={onChange} />
          </label>

          <label>
            Modelo
            <input name="modelo" value={formData.modelo || ''} onChange={onChange} />
          </label>

          <label>
            Serial
            <input name="serial" value={formData.serial || ''} onChange={onChange} />
          </label>

          <label>
            Fabricante
            <input name="fabricante" value={formData.fabricante || ''} onChange={onChange} />
          </label>

          <label>
            Ubicación
            <input name="ubicacion" value={formData.ubicacion || ''} onChange={onChange} />
          </label>

          <label>
            Estado
            <select name="estadoOperativo" value={formData.estadoOperativo || ''} onChange={onChange}>
              {ESTADO_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label>
            Criticidad
            <select name="criticidad" value={formData.criticidad || ''} onChange={onChange}>
              {CRITICIDAD_OPTIONS.map((item) => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <label className="entity-form-wide">
            Imagen URL
            <input name="imagenUrl" value={formData.imagenUrl || ''} onChange={onChange} />
          </label>

          <label className="entity-form-wide">
            Observaciones
            <textarea name="observaciones" value={formData.observaciones || ''} onChange={onChange} />
          </label>

          <div className="entity-form-actions">
            <button type="submit" className="primary-action">Guardar</button>
            <button type="button" className="secondary-action" onClick={onClose}>Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EquiposPage() {
  const [equipos, setEquipos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [formData, setFormData] = useState(EMPTY_EQUIPO_FORM);
  const [relation, setRelation] = useState(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [equiposRes, clientesRes, serviciosRes, tecnicosRes, visitasRes] = await Promise.all([
        fetch('/api/equipos'),
        fetch('/api/clientes'),
        fetch('/api/servicios'),
        fetch('/api/tecnicos'),
        fetch('/api/visitas'),
      ]);

      const [equiposList, clientesList, serviciosList, tecnicosList, visitasList] = await Promise.all([
        equiposRes.json(),
        clientesRes.json(),
        serviciosRes.json(),
        tecnicosRes.json(),
        visitasRes.json(),
      ]);

      const safeEquipos = Array.isArray(equiposList) ? equiposList : [];
      setEquipos(safeEquipos);
      setClientes(Array.isArray(clientesList) ? clientesList : []);
      setServicios(Array.isArray(serviciosList) ? serviciosList : []);
      setTecnicos(Array.isArray(tecnicosList) ? tecnicosList : []);
      setVisitas(Array.isArray(visitasList) ? visitasList : []);
      setSelectedId((current) => (safeEquipos.some((item) => item.id === current) ? current : safeEquipos[0]?.id || null));
    } catch (error) {
      console.error('Error cargando equipos:', error);
      setEquipos([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return equipos;

    return equipos.filter((equipo) => [
      equipo.sku,
      equipo.codigoInterno,
      equipo.serial,
      equipo.nombre,
      equipo.modelo,
      equipo.fabricante,
      equipo.ubicacion,
      equipo.cliente?.nombre,
    ].some((value) => compactText(value, '').toLowerCase().includes(needle)));
  }, [equipos, query]);

  const selected = filtered.find((equipo) => equipo.id === selectedId) || filtered[0] || null;
  const relatedServices = selected?.serviciosRelacionados?.length
    ? selected.serviciosRelacionados
    : buildRelatedServices(selected?.visitas || []);

  const openCreateModal = () => {
    setFormData(EMPTY_EQUIPO_FORM);
    setFormMode('create');
    setFormOpen(true);
  };

  const openEditModal = (equipo) => {
    setFormData({
      ...EMPTY_EQUIPO_FORM,
      ...equipo,
      clienteId: equipo.clienteId ? String(equipo.clienteId) : '',
    });
    setFormMode('edit');
    setFormOpen(true);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const payload = {
      ...EMPTY_EQUIPO_FORM,
      ...formData,
      clienteId: formData.clienteId ? Number(formData.clienteId) : null,
    };

    try {
      const res = await fetch(formMode === 'edit' ? `/api/equipos/${formData.id}` : '/api/equipos', {
        method: formMode === 'edit' ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'No se pudo guardar el equipo.');
      }

      const saved = await res.json();
      setFormOpen(false);
      setSelectedId(saved.id);
      await loadData();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDelete = async (equipo) => {
    if (!equipo || !confirm(`¿Eliminar ${equipo.nombre || 'este equipo'}?`)) return;

    try {
      const res = await fetch(`/api/equipos/${equipo.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.error || 'No se pudo eliminar el equipo.');
      }
      setSelectedId(null);
      await loadData();
    } catch (error) {
      alert(error.message);
    }
  };

  const openRelation = (type, id) => {
    if (type === 'equipo') {
      setSelectedId(Number(id));
      setRelation(null);
      return;
    }
    setRelation({ type, id: Number(id) });
  };

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="entity-hero panel">
          <div>
            <p>Activos</p>
            <h1>Equipos</h1>
          </div>
          <div className="entity-hero-actions">
            <span>{loading ? '...' : equipos.length} registros</span>
            <button type="button" className="primary-action" onClick={openCreateModal}>Nuevo equipo</button>
          </div>
        </header>

        <section className="asset-layout">
          <aside className="asset-list-panel panel">
            <label className="asset-search">
              <span>Buscar</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="SKU, serial, cliente"
              />
            </label>

            <div className="asset-list">
              {loading ? <p className="asset-empty">Cargando...</p> : null}
              {!loading && filtered.length === 0 ? <p className="asset-empty">Sin equipos.</p> : null}
              {filtered.map((equipo) => (
                <button
                  key={equipo.id}
                  type="button"
                  onClick={() => setSelectedId(equipo.id)}
                  className={`asset-list-item ${selected?.id === equipo.id ? 'is-active' : ''}`}
                >
                  <EquipoImage equipo={equipo} />
                  <span>
                    <strong>{compactText(equipo.nombre, 'Equipo sin nombre')}</strong>
                    <small>{getEquipoCode(equipo)} · {compactText(equipo.serial, 'Sin serial')}</small>
                  </span>
                </button>
              ))}
            </div>
          </aside>

          {selected ? (
            <section className="asset-detail">
              <article className="asset-summary panel">
                <div className="asset-summary-main">
                  <div className="asset-title-row">
                    <div>
                      <p>{getEquipoCode(selected)}</p>
                      <h2>{compactText(selected.nombre, 'Equipo sin nombre')}</h2>
                    </div>
                    <div className="asset-actions">
                      <button type="button" className="table-action table-action-edit" onClick={() => openEditModal(selected)}>Editar</button>
                      <button type="button" className="table-action table-action-delete" onClick={() => handleDelete(selected)}>Borrar</button>
                    </div>
                  </div>

                  <div className="entity-badge-row">
                    <EntityBadge value={selected.estadoOperativo || 'Sin estado'} tone={statusTone[normalizeKey(selected.estadoOperativo)] || ''} />
                    <EntityBadge value={selected.criticidad || 'Sin criticidad'} tone={criticidadTone[normalizeKey(selected.criticidad)] || ''} />
                  </div>

                  <dl className="asset-facts">
                    <Fact label="Cliente" value={selected.cliente?.nombre} />
                    <Fact label="Serial" value={selected.serial} />
                    <Fact label="Modelo" value={selected.modelo} />
                    <Fact label="Fabricante" value={selected.fabricante} />
                    <Fact label="Ubicación" value={selected.ubicacion} />
                    <Fact label="Observaciones" value={selected.observaciones} />
                  </dl>

                  {selected.cliente ? (
                    <div className="relation-chip-row">
                      <EntityLink onClick={() => openRelation('cliente', selected.cliente.id)}>{selected.cliente.nombre}</EntityLink>
                    </div>
                  ) : null}
                </div>

                <EquipoImage equipo={selected} large />
              </article>

              <section className="asset-section panel">
                <div className="asset-section-head">
                  <h2>Servicios relacionados</h2>
                  <span>{relatedServices.length}</span>
                </div>

                {relatedServices.length ? (
                  <div className="service-card-grid">
                    {relatedServices.map((servicio) => (
                      <button
                        key={servicio.id || servicio.descripcion}
                        type="button"
                        className="service-card"
                        disabled={!servicio.id}
                        onClick={() => servicio.id && openRelation('servicio', servicio.id)}
                      >
                        <span>{servicio.tipo || 'Servicio'}</span>
                        <strong>{servicio.descripcion}</strong>
                        <small>{servicio.visitas.length} visitas · {formatDate(servicio.ultimaFecha)}</small>
                        <em>{servicio.tecnicos.map((tecnico) => tecnico.nombre).join(', ') || 'Sin técnico'}</em>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="asset-empty">Sin servicios asociados.</p>
                )}
              </section>

              <section className="asset-section panel">
                <div className="asset-section-head">
                  <h2>Hoja de vida</h2>
                  <span>{(selected.hojaVida || []).length}</span>
                </div>

                {(selected.hojaVida || []).length ? (
                  <div className="asset-timeline">
                    {selected.hojaVida.map((evento) => (
                      <article key={`${evento.id}-${evento.fechaEvento}`} className="asset-event">
                        <div>
                          <button
                            type="button"
                            className="asset-event-title"
                            onClick={() => evento.visitaId ? openRelation('visita', evento.visitaId) : null}
                          >
                            {compactText(evento.titulo, 'Evento')}
                          </button>
                          <p>{compactText(evento.detalle)}</p>
                          <div className="relation-chip-row">
                            {evento.servicio?.id ? <EntityLink onClick={() => openRelation('servicio', evento.servicio.id)}>{evento.servicio.descripcion}</EntityLink> : null}
                            {evento.tecnicoDetalle?.id ? <EntityLink onClick={() => openRelation('tecnico', evento.tecnicoDetalle.id)}>{evento.tecnicoDetalle.nombre}</EntityLink> : null}
                            {evento.visitaId ? <EntityLink onClick={() => openRelation('visita', evento.visitaId)}>Visita {evento.visitaId}</EntityLink> : null}
                          </div>
                        </div>
                        <time>{formatDate(evento.fechaEvento)}</time>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className="asset-empty">Sin eventos registrados.</p>
                )}
              </section>
            </section>
          ) : (
            <section className="panel flex min-h-[320px] items-center justify-center p-6 text-neutral-500">Sin equipos</section>
          )}
        </section>
      </div>

      <EquipoFormModal
        open={formOpen}
        mode={formMode}
        formData={formData}
        clientes={clientes}
        onChange={handleFormChange}
        onClose={() => setFormOpen(false)}
        onSubmit={handleSubmit}
      />

      <RelationModal
        relation={relation}
        data={{ clientes, equipos, servicios, tecnicos, visitas }}
        onClose={() => setRelation(null)}
        onOpen={openRelation}
      />
    </div>
  );
}
