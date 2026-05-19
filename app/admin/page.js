'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

const tabs = [
  { key: 'clientes', label: 'Clientes', api: '/api/clientes' },
  { key: 'equipos', label: 'Equipos', api: '/api/equipos' },
  { key: 'empleados', label: 'Empleados', api: '/api/empleados' },
  { key: 'servicios', label: 'Servicios', api: '/api/servicios' },
  { key: 'mantenciones', label: 'Mantenciones', api: '/api/mantenciones' },
  { key: 'incidentes', label: 'Incidentes', api: '/api/incidentes' },
  { key: 'visitas', label: 'Visitas', api: '/api/visitas' },
];

const fieldConfigs = {
  clientes: ['nombre', 'rut', 'email', 'telefono', 'direccion', 'contactoNombre', 'contactoEmail', 'contactoTelefono', 'notas'],
  equipos: ['clienteId', 'nombre', 'marca', 'modelo', 'nroSerie', 'codigoInterno', 'ubicacion', 'garantiaHasta', 'estado', 'criticidad', 'imagenUrl', 'notas'],
  empleados: ['nombre', 'email', 'telefono', 'cargo', 'especialidad', 'roles', 'supervisorId', 'estado'],
  servicios: ['codigo', 'descripcion', 'tipo', 'precio'],
  mantenciones: ['clienteId', 'equipoId', 'servicioId', 'comercialId', 'jefaturaId', 'folio', 'titulo', 'tipo', 'origen', 'cobertura', 'estado', 'prioridad', 'fechaProgramada', 'montoEstimado', 'descripcion'],
  incidentes: ['clienteId', 'equipoId', 'asignadoAId', 'titulo', 'severidad', 'estado', 'fechaReporte', 'descripcion'],
  visitas: ['clienteId', 'equipoId', 'tecnicoId', 'vendedorId', 'mantencionId', 'incidenteId', 'servicioId', 'fecha', 'descripcion', 'estado', 'resultado', 'recomendaciones'],
};

const requiredFields = {
  clientes: ['nombre'],
  equipos: ['clienteId', 'nombre', 'nroSerie'],
  empleados: ['nombre', 'email'],
  servicios: ['descripcion'],
  mantenciones: ['clienteId', 'equipoId', 'titulo'],
  incidentes: ['clienteId', 'titulo'],
  visitas: ['clienteId', 'tecnicoId', 'fecha'],
};

const fieldLabels = {
  asignadoAId: 'Asignado a',
  cargo: 'Cargo',
  cliente: 'Cliente',
  clienteId: 'Cliente',
  codigo: 'Codigo',
  codigoInterno: 'Codigo interno',
  comercial: 'Comercial',
  comercialId: 'Comercial',
  contactoEmail: 'Email contacto',
  contactoNombre: 'Contacto principal',
  contactoTelefono: 'Telefono contacto',
  cobertura: 'Cobertura',
  criticidad: 'Criticidad',
  descripcion: 'Descripcion',
  direccion: 'Direccion',
  email: 'Email',
  empleado: 'Empleado',
  equipo: 'Equipo',
  equipoId: 'Equipo',
  equipos: 'Equipos',
  especialidad: 'Especialidad',
  estado: 'Estado',
  fecha: 'Fecha visita',
  fechaProgramada: 'Fecha programada',
  folio: 'Folio',
  garantiaHasta: 'Garantia hasta',
  imagenUrl: 'Imagen',
  incidente: 'Incidente',
  incidenteId: 'Incidente',
  jefatura: 'Jefatura',
  jefaturaId: 'Jefatura',
  mantencion: 'Mantencion',
  mantencionId: 'Mantencion',
  marca: 'Marca',
  modelo: 'Modelo',
  montoEstimado: 'Monto estimado',
  nombre: 'Nombre',
  notas: 'Notas',
  nroSerie: 'Nro. serie',
  origen: 'Origen',
  precio: 'Precio',
  prioridad: 'Prioridad',
  recomendaciones: 'Recomendaciones',
  resultado: 'Resultado',
  roles: 'Roles',
  rut: 'RUT',
  servicio: 'Servicio',
  servicioId: 'Servicio',
  severidad: 'Severidad',
  supervisorId: 'Supervisor',
  tecnico: 'Tecnico',
  tecnicoId: 'Tecnico',
  telefono: 'Telefono',
  tipo: 'Tipo',
  titulo: 'Titulo',
  ubicacion: 'Ubicacion',
  vendedor: 'Comercial',
  vendedorId: 'Comercial',
};

const enumOptions = {
  cobertura: ['garantia', 'contrato', 'cobrable', 'interno', 'sin_cobro'],
  criticidad: ['baja', 'media', 'alta', 'critica'],
  estadoCliente: ['prospecto', 'activo', 'suspendido', 'inactivo'],
  estadoEquipo: ['operativo', 'observado', 'fuera_servicio', 'retirado'],
  estadoEmpleado: ['activo', 'inactivo'],
  estadoIncidente: ['abierto', 'en_revision', 'resuelto', 'cerrado', 'cancelado'],
  estadoMantencion: ['borrador', 'programada', 'asignada', 'en_progreso', 'completada', 'cancelada'],
  estadoVisita: ['pendiente', 'programada', 'en_progreso', 'completada', 'cancelada'],
  origen: ['programada', 'solicitada', 'spot', 'incidente'],
  prioridad: ['baja', 'media', 'alta', 'critica'],
  roles: ['comercial', 'jefatura', 'tecnico', 'administrativo'],
  tipo: ['preventiva', 'correctiva', 'calibracion', 'instalacion', 'spot', 'incidente'],
};

const estadoClasses = {
  activo: 'bg-emerald-100 text-emerald-800',
  abierto: 'bg-rose-100 text-rose-800',
  asignada: 'bg-sky-100 text-sky-800',
  cancelada: 'bg-rose-100 text-rose-800',
  cerrado: 'bg-neutral-200 text-neutral-700',
  completada: 'bg-emerald-100 text-emerald-800',
  en_progreso: 'bg-sky-100 text-sky-800',
  operativo: 'bg-emerald-100 text-emerald-800',
  pendiente: 'bg-amber-100 text-amber-800',
  programada: 'bg-indigo-100 text-indigo-800',
  resuelto: 'bg-emerald-100 text-emerald-800',
};

const formatLabel = (value) => String(value || '-').replaceAll('_', ' ');

const formatFriendlyDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

const toInputDateTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const relationKeyByField = {
  asignadoAId: 'empleados',
  clienteId: 'clientes',
  comercialId: 'empleados',
  equipoId: 'equipos',
  incidenteId: 'incidentes',
  jefaturaId: 'empleados',
  mantencionId: 'mantenciones',
  servicioId: 'servicios',
  supervisorId: 'empleados',
  tecnicoId: 'tecnicos',
  vendedorId: 'vendedores',
};

const tableColumnsByTab = {
  clientes: ['nombre', 'rut', 'email', 'telefono', 'direccion', 'equipos', 'visitas'],
  equipos: ['cliente', 'nombre', 'marca', 'modelo', 'nroSerie', 'ubicacion', 'estado', 'criticidad'],
  empleados: ['nombre', 'email', 'telefono', 'cargo', 'especialidad', 'roles', 'estado'],
  servicios: ['codigo', 'descripcion', 'tipo', 'precio'],
  mantenciones: ['folio', 'cliente', 'equipos', 'tipo', 'origen', 'cobertura', 'estado', 'fechaProgramada'],
  incidentes: ['cliente', 'equipo', 'titulo', 'severidad', 'estado', 'fechaReporte', 'asignadoA'],
  visitas: ['cliente', 'equipos', 'tecnico', 'vendedor', 'mantencion', 'fecha', 'estado', 'imagenes'],
};

function getEstadoOptions(tab) {
  if (tab === 'clientes') return enumOptions.estadoCliente;
  if (tab === 'equipos') return enumOptions.estadoEquipo;
  if (tab === 'empleados') return enumOptions.estadoEmpleado;
  if (tab === 'mantenciones') return enumOptions.estadoMantencion;
  if (tab === 'incidentes') return enumOptions.estadoIncidente;
  return enumOptions.estadoVisita;
}

function getSelectLabel(item) {
  if (!item) return '';
  if (item.nroSerie || item.serial) return `${item.nombre} - ${item.nroSerie || item.serial}`;
  if (item.folio || item.titulo) return `${item.folio || 'S/F'} - ${item.titulo || item.descripcion || item.id}`;
  if (item.descripcion) return item.codigo ? `${item.codigo} - ${item.descripcion}` : item.descripcion;
  if (item.roles?.length) return `${item.nombre} (${item.roles.join(', ')})`;
  return item.nombre || item.email || item.id;
}

export default function Admin() {
  const [activeTab, setActiveTab] = useState('clientes');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [options, setOptions] = useState({});
  const [error, setError] = useState('');

  const currentTab = useMemo(() => tabs.find((tab) => tab.key === activeTab), [activeTab]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(currentTab.api);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'No se pudo cargar');
      setData(Array.isArray(result) ? result : []);
    } catch (err) {
      setError(err.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [currentTab]);

  const fetchOptions = useCallback(async () => {
    try {
      const responses = await Promise.all([
        fetch('/api/clientes'),
        fetch('/api/equipos'),
        fetch('/api/empleados'),
        fetch('/api/tecnicos'),
        fetch('/api/vendedores'),
        fetch('/api/servicios'),
        fetch('/api/mantenciones'),
        fetch('/api/incidentes'),
      ]);
      const [clientes, equipos, empleados, tecnicos, vendedores, servicios, mantenciones, incidentes] = await Promise.all(
        responses.map((res) => res.ok ? res.json() : [])
      );
      setOptions({ clientes, equipos, empleados, tecnicos, vendedores, servicios, mantenciones, incidentes });
    } catch (err) {
      console.error('Error fetching options:', err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchOptions();
  }, [fetchData, fetchOptions]);

  const openCreateModal = () => {
    setFormData({});
    setIsEditing(false);
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setFormData({
      ...item,
      direccion: item.direccion || item.direcciones?.[0]?.direccion || '',
      equipoId: item.equipoId || item.equipos?.[0]?.id || '',
      fecha: toInputDateTime(item.fecha),
      fechaProgramada: toInputDateTime(item.fechaProgramada),
      fechaReporte: toInputDateTime(item.fechaReporte),
      garantiaHasta: toInputDateTime(item.garantiaHasta),
    });
    setIsEditing(true);
    setShowModal(true);
  };

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleRole = (role) => {
    setFormData((prev) => {
      const roles = Array.isArray(prev.roles) ? prev.roles : String(prev.roles || '').split(',').map((item) => item.trim()).filter(Boolean);
      return {
        ...prev,
        roles: roles.includes(role) ? roles.filter((item) => item !== role) : [...roles, role],
      };
    });
  };

  const buildPayload = () => {
    const payload = {};
    fieldConfigs[activeTab].forEach((field) => {
      let value = formData[field] ?? '';
      if (field === 'roles') {
        value = Array.isArray(value) ? value : String(value).split(',').map((item) => item.trim()).filter(Boolean);
      }
      if (field.endsWith('Id') && value === '') value = null;
      if (['precio', 'montoEstimado'].includes(field) && value !== '') value = Number(value);
      if (['fecha', 'fechaProgramada', 'fechaReporte', 'garantiaHasta'].includes(field) && value) value = new Date(value).toISOString();
      payload[field] = value;
    });

    if (activeTab === 'mantenciones' && payload.equipoId) payload.equipoIds = [payload.equipoId];
    if (activeTab === 'visitas' && payload.equipoId) payload.equipoIds = [payload.equipoId];

    return payload;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    try {
      const res = await fetch(isEditing ? `${currentTab.api}/${formData.id}` : currentTab.api, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'No se pudo guardar');
      setShowModal(false);
      fetchData();
      fetchOptions();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Eliminar este registro?')) return;
    try {
      const res = await fetch(`${currentTab.api}/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const result = await res.json();
        throw new Error(result.error || 'No se pudo eliminar');
      }
      fetchData();
      fetchOptions();
    } catch (err) {
      setError(err.message);
    }
  };

  const getFieldType = (field) => {
    if (['descripcion', 'notas', 'resultado', 'recomendaciones'].includes(field)) return 'textarea';
    if (field === 'email' || field.endsWith('Email')) return 'email';
    if (field.toLowerCase().includes('telefono')) return 'tel';
    if (['fecha', 'fechaProgramada', 'fechaReporte', 'garantiaHasta'].includes(field)) return 'datetime-local';
    if (['precio', 'montoEstimado'].includes(field)) return 'number';
    if (field.endsWith('Id')) return 'select';
    if (['estado', 'tipo', 'origen', 'cobertura', 'criticidad', 'severidad', 'prioridad'].includes(field)) return 'enum';
    if (field === 'roles') return 'roles';
    return 'text';
  };

  const getFieldOptions = (field) => {
    if (field === 'estado') return getEstadoOptions(activeTab);
    if (field === 'severidad') return enumOptions.prioridad;
    return enumOptions[field] || [];
  };

  const getRelationOptions = (field) => {
    const key = relationKeyByField[field];
    return key ? options[key] || [] : [];
  };

  const getDisplayValue = (item, key) => {
    const value = item[key];
    if (['fecha', 'fechaProgramada', 'fechaReporte', 'garantiaHasta'].includes(key)) return formatFriendlyDate(value);
    if (key === 'precio' || key === 'montoEstimado') return value ? new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(value) : '-';
    if (key === 'estado') return formatLabel(value);
    if (key === 'roles') return Array.isArray(value) && value.length ? value.map(formatLabel).join(', ') : '-';
    if (key === 'cliente' || key === 'equipo' || key === 'tecnico' || key === 'vendedor' || key === 'comercial' || key === 'jefatura' || key === 'asignadoA') {
      return getSelectLabel(value) || '-';
    }
    if (key === 'mantencion') return value ? (value.folio || value.titulo || value.id) : '-';
    if (key === 'imagenes') return Array.isArray(value) ? `${value.length}` : '0';
    if (Array.isArray(value)) {
      if (key === 'equipos') return value.length ? value.map(getSelectLabel).join(', ') : '-';
      return String(value.length);
    }
    if (value && typeof value === 'object') return getSelectLabel(value) || '-';
    return value === null || typeof value === 'undefined' || value === '' ? '-' : String(value);
  };

  const tableColumns = tableColumnsByTab[activeTab] || [];

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="panel mb-6 p-6">
          <p className="text-[0.85rem] uppercase tracking-[0.18em] text-neutral-500">CMMS</p>
          <h1 className="mt-1 text-[1.65rem] font-semibold text-neutral-900">Backoffice CMCing</h1>
        </div>

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <nav className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-xl px-4 py-2 text-[0.9rem] font-medium transition ${
                  activeTab === tab.key ? 'bg-neutral-900 text-white' : 'panel text-neutral-700 hover:bg-neutral-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <button onClick={openCreateModal} className="rounded-xl bg-emerald-700 px-4 py-2 text-[0.9rem] font-medium text-white transition hover:bg-emerald-600">
            + Nuevo
          </button>
        </div>

        {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-[0.9rem] text-rose-700">{error}</div> : null}

        <div className="panel p-6">
          <h2 className="mb-4 text-[1.15rem] font-semibold text-neutral-900">{currentTab.label}</h2>
          {loading ? (
            <p className="text-[0.9rem] text-neutral-600">Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-neutral-100/80">
                    {tableColumns.map((key) => (
                      <th key={key} className="px-4 py-3 text-left text-[0.82rem] font-semibold uppercase tracking-wide text-neutral-600">{fieldLabels[key] || key}</th>
                    ))}
                    <th className="px-4 py-3 text-left text-[0.82rem] font-semibold uppercase tracking-wide text-neutral-600">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr key={item.id} className="border-t border-neutral-200 hover:bg-neutral-50">
                      {tableColumns.map((key) => (
                        <td key={key} className="px-4 py-3 text-[0.9rem] text-neutral-700">
                          {key === 'estado' ? (
                            <span className={`inline-flex rounded-full px-2 py-1 text-[0.76rem] font-medium ${estadoClasses[item.estado] || 'bg-neutral-100 text-neutral-700'}`}>
                              {getDisplayValue(item, key)}
                            </span>
                          ) : (
                            <span className={['descripcion', 'equipos'].includes(key) ? 'inline-block max-w-[24rem]' : ''}>
                              {getDisplayValue(item, key).slice(0, 140)}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="space-x-2 px-4 py-3 text-sm">
                        <button onClick={() => openEditModal(item)} className="rounded-lg bg-neutral-900 px-3 py-1 text-[0.76rem] font-medium text-white transition hover:bg-neutral-700">Editar</button>
                        <button onClick={() => handleDelete(item.id)} className="rounded-lg bg-rose-700 px-3 py-1 text-[0.76rem] font-medium text-white transition hover:bg-rose-600">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan={tableColumns.length + 1} className="px-4 py-6 text-center text-[0.9rem] text-neutral-500">Sin registros</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl">
            <h3 className="mb-4 text-[1.25rem] font-semibold text-neutral-900">{isEditing ? 'Editar' : 'Crear'} {currentTab.label}</h3>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {fieldConfigs[activeTab].map((field) => {
                const fieldType = getFieldType(field);
                const required = requiredFields[activeTab]?.includes(field);
                const commonLabel = <label className="mb-1 block text-[0.85rem] font-medium text-neutral-700">{fieldLabels[field] || field}</label>;

                if (fieldType === 'roles') {
                  const roles = Array.isArray(formData.roles) ? formData.roles : String(formData.roles || '').split(',').map((item) => item.trim()).filter(Boolean);
                  return (
                    <div key={field} className="md:col-span-2">
                      {commonLabel}
                      <div className="flex flex-wrap gap-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
                        {enumOptions.roles.map((role) => (
                          <label key={role} className="flex items-center gap-2 text-[0.9rem] text-neutral-700">
                            <input type="checkbox" checked={roles.includes(role)} onChange={() => toggleRole(role)} />
                            {formatLabel(role)}
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (fieldType === 'select') {
                  const selectOptions = getRelationOptions(field);
                  return (
                    <div key={field}>
                      {commonLabel}
                      <select name={field} value={formData[field] || ''} onChange={handleInputChange} required={required} className="input-base">
                        <option value="">Seleccionar...</option>
                        {selectOptions.map((option) => (
                          <option key={option.id} value={option.id}>{getSelectLabel(option)}</option>
                        ))}
                      </select>
                    </div>
                  );
                }

                if (fieldType === 'enum') {
                  return (
                    <div key={field}>
                      {commonLabel}
                      <select name={field} value={formData[field] || ''} onChange={handleInputChange} required={required} className="input-base">
                        <option value="">Seleccionar...</option>
                        {getFieldOptions(field).map((option) => (
                          <option key={option} value={option}>{formatLabel(option)}</option>
                        ))}
                      </select>
                    </div>
                  );
                }

                if (fieldType === 'textarea') {
                  return (
                    <div key={field} className="md:col-span-2">
                      {commonLabel}
                      <textarea name={field} value={formData[field] || ''} onChange={handleInputChange} required={required} className="input-base min-h-24" />
                    </div>
                  );
                }

                return (
                  <div key={field}>
                    {commonLabel}
                    <input
                      type={fieldType}
                      name={field}
                      value={formData[field] || ''}
                      onChange={handleInputChange}
                      required={required}
                      step={fieldType === 'number' ? '0.01' : undefined}
                      className="input-base"
                    />
                  </div>
                );
              })}

              <div className="mt-3 flex gap-2 md:col-span-2">
                <button type="submit" className="flex-1 rounded-xl bg-neutral-900 px-4 py-2 text-[0.9rem] font-medium text-white transition hover:bg-neutral-700">Guardar</button>
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 rounded-xl bg-neutral-200 px-4 py-2 text-[0.9rem] font-medium text-neutral-800 transition hover:bg-neutral-300">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
