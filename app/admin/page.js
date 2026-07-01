'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect, useCallback } from 'react';

const fieldConfigs = {
  clientes: ['nombre', 'email', 'telefono', 'direccion'],
  equipos: ['sku', 'nombre', 'modelo', 'serial', 'fabricante', 'ubicacion', 'estadoOperativo', 'criticidad', 'clienteId', 'imagenUrl'],
  servicios: ['descripcion', 'precio', 'tipo', 'duracionEstimadaMin', 'activo'],
  actividades: ['nombre', 'descripcion', 'tipo', 'duracionEstimadaMin', 'obligatoria', 'activa'],
  vendedores: ['nombre', 'email', 'telefono'],
  tecnicos: ['nombre', 'especialidad', 'email', 'telefono', 'firmaTexto', 'firmaImagenUrl', 'activo'],
  visitas: ['clienteId', 'equipoId', 'tecnicoId', 'vendedorId', 'servicioId', 'fecha', 'descripcion', 'notasTecnicas', 'estado'],
};

const tabs = [
  { key: 'clientes', label: 'Clientes', api: '/api/clientes' },
  { key: 'servicios', label: 'Servicios', api: '/api/servicios' },
  { key: 'actividades', label: 'Actividades', api: '/api/actividades' },
  { key: 'vendedores', label: 'Vendedores', api: '/api/vendedores' },
  { key: 'tecnicos', label: 'Técnicos', api: '/api/tecnicos' },
  { key: 'visitas', label: 'Visitas', api: '/api/visitas' },
];

const createLabels = {
  clientes: 'Nuevo cliente',
  equipos: 'Nuevo equipo',
  servicios: 'Nuevo servicio',
  actividades: 'Nueva actividad',
  vendedores: 'Nuevo vendedor',
  tecnicos: 'Nuevo técnico',
  visitas: 'Nueva visita',
};

const entityLabels = {
  clientes: 'cliente',
  equipos: 'equipo',
  servicios: 'servicio',
  actividades: 'actividad',
  vendedores: 'vendedor',
  tecnicos: 'técnico',
  visitas: 'visita',
};

const relationKeysById = {
  clienteId: 'cliente',
  equipoId: 'equipo',
  tecnicoId: 'tecnico',
  vendedorId: 'vendedor',
  servicioId: 'servicio',
};

const fieldLabels = {
  nombre: 'Nombre',
  email: 'Email',
  telefono: 'Teléfono',
  direccion: 'Dirección',
  modelo: 'Modelo',
  sku: 'SKU',
  serial: 'Serial',
  fabricante: 'Fabricante',
  ubicacion: 'Ubicación',
  estadoOperativo: 'Estado operativo',
  criticidad: 'Criticidad',
  imagenUrl: 'Imagen',
  cliente: 'Cliente',
  clienteId: 'Cliente',
  equipo: 'Equipo',
  equipoId: 'Equipo',
  tecnico: 'Técnico',
  tecnicoId: 'Técnico',
  vendedor: 'Vendedor',
  vendedorId: 'Vendedor',
  servicio: 'Servicio',
  servicioId: 'Servicio',
  fecha: 'Fecha',
  descripcion: 'Descripción',
  notasTecnicas: 'Notas técnicas',
  estado: 'Estado',
  especialidad: 'Especialidad',
  firmaTexto: 'Texto firma',
  firmaImagenUrl: 'Imagen firma',
  precio: 'Precio',
  tipo: 'Tipo',
  duracionEstimadaMin: 'Duración estimada',
  activo: 'Activo',
  obligatoria: 'Obligatoria',
  activa: 'Activa',
  visitas: 'Visitas',
  equipos: 'Equipos',
};

const estadoLabels = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

const estadoClasses = {
  pendiente: 'bg-amber-100 text-amber-800',
  en_progreso: 'bg-sky-100 text-sky-800',
  completada: 'bg-emerald-100 text-emerald-800',
  cancelada: 'bg-rose-100 text-rose-800',
};

const formatFriendlyDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CL', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

function AdminContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const requestedTab = searchParams.get('modulo');
  const openNewFromUrl = searchParams.get('nuevo') === '1';
  const activeTab = tabs.some((tab) => tab.key === requestedTab) ? requestedTab : 'clientes';
  const activeTabConfig = tabs.find((tab) => tab.key === activeTab) || tabs[0];
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [options, setOptions] = useState({});
  const [viewModal, setViewModal] = useState(false);
  const [viewData, setViewData] = useState({ title: '', items: [] });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const currentTab = tabs.find(t => t.key === activeTab);
      const res = await fetch(currentTab.api);
      const result = await res.json();
      setData(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error('Error fetching data:', error);
      setData([]);
    }
    setLoading(false);
  }, [activeTab]);

  const fetchOptions = useCallback(async () => {
    try {
      const [clientesRes, equiposRes, tecnicosRes, vendedoresRes, serviciosRes] = await Promise.all([
        fetch('/api/clientes'),
        fetch('/api/equipos'),
        fetch('/api/tecnicos'),
        fetch('/api/vendedores'),
        fetch('/api/servicios'),
      ]);
      setOptions({
        clientes: await clientesRes.json(),
        equipos: await equiposRes.json(),
        tecnicos: await tecnicosRes.json(),
        vendedores: await vendedoresRes.json(),
        servicios: await serviciosRes.json(),
      });
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
    fetchOptions();
  }, [fetchData, fetchOptions]);

  useEffect(() => {
    if (requestedTab === 'equipos') {
      router.replace('/equipos');
    }
  }, [requestedTab, router]);

  useEffect(() => {
    if (activeTab !== 'visitas' || !openNewFromUrl) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFormData({});
    setIsEditing(false);
    setShowModal(true);
    router.replace('/admin?modulo=visitas');
  }, [activeTab, openNewFromUrl, router]);

  const openCreateModal = () => {
    setFormData({});
    setIsEditing(false);
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setFormData(item);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentTab = tabs.find(t => t.key === activeTab);
    
    try {
      const payload = fieldConfigs[activeTab].reduce((acc, field) => {
        acc[field] = formData[field] ?? '';
        return acc;
      }, {});

      // Convertir IDs a números
      ['clienteId', 'equipoId', 'tecnicoId', 'vendedorId', 'servicioId'].forEach(key => {
        if (!(key in payload)) return;
        if (payload[key] === '' || payload[key] === null) {
          payload[key] = null;
          return;
        }
        payload[key] = parseInt(payload[key]);
      });
      if (payload.precio) payload.precio = parseFloat(payload.precio);
      ['activo', 'activa', 'obligatoria'].forEach((key) => {
        if (key in payload) payload[key] = Boolean(payload[key]);
      });
      if (payload.fecha) payload.fecha = new Date(payload.fecha).toISOString();

      if (isEditing) {
        const res = await fetch(`${currentTab.api}/${formData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          alert('Registro actualizado');
          setShowModal(false);
          fetchData();
        }
      } else {
        const res = await fetch(currentTab.api, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          alert('Registro creado');
          setShowModal(false);
          fetchData();
        }
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de que desea eliminar este registro?')) return;
    
    const currentTab = tabs.find(t => t.key === activeTab);
    try {
      const res = await fetch(`${currentTab.api}/${id}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Registro eliminado');
        fetchData();
      }
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const handleViewRelated = (fieldName, items, itemName) => {
    setViewData({ title: `${itemName}`, items: Array.isArray(items) ? items : [] });
    setViewModal(true);
  };

  const getFieldType = (fieldName) => {
    if (fieldName.includes('email')) return 'email';
    if (fieldName.includes('telefono')) return 'tel';
    if (fieldName.includes('fecha')) return 'datetime-local';
    if (fieldName.includes('precio')) return 'number';
    if (['activo', 'activa', 'obligatoria'].includes(fieldName)) return 'checkbox';
    if (fieldName.includes('Id')) return 'select';
    return 'text';
  };

  const getSelectOptions = (fieldName) => {
    if (fieldName === 'clienteId') return options.clientes || [];
    if (fieldName === 'equipoId') return options.equipos || [];
    if (fieldName === 'tecnicoId') return options.tecnicos || [];
    if (fieldName === 'vendedorId') return options.vendedores || [];
    if (fieldName === 'servicioId') return options.servicios || [];
    return [];
  };

  const getTableColumns = (sampleItem) => {
    if (!sampleItem) return [];

    if (activeTab === 'visitas') {
      return ['cliente', 'equipos', 'tecnico', 'servicio', 'fecha', 'estado'];
    }

    return Object.keys(sampleItem)
      .filter(key => !key.includes('At') && key !== 'id')
      .filter((key) => !(key.endsWith('Id') && sampleItem[relationKeysById[key]]));
  };

  const getColumnLabel = (key) => fieldLabels[key] || key;

  const getInputValue = (field, value) => {
    if (!value) return '';
    if (getFieldType(field) === 'datetime-local') {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toISOString().slice(0, 16);
    }
    return value;
  };

  const getDisplayValue = (item, key) => {
    const value = item[key];

    if (key === 'fecha') return formatFriendlyDate(value);
    if (key === 'estado') return estadoLabels[value] || value || '-';

    if (key === 'cliente' || key === 'equipo' || key === 'tecnico' || key === 'vendedor') {
      return item[key]?.nombre || '-';
    }

    if (key === 'equipos') {
      if (!Array.isArray(item.equipos) || item.equipos.length === 0) return '-';
      return item.equipos.map((equipo) => equipo.nombre).join(', ');
    }

    if (key === 'servicio') {
      return item[key]?.descripcion || '-';
    }

    if (value && typeof value === 'object') {
      return value.nombre || value.descripcion || value.modelo || value.serial || '-';
    }

    if (value === null || typeof value === 'undefined' || value === '') return '-';
    return String(value);
  };

  return (
    <div className="admin-page min-h-screen">
      <div className="admin-shell">
        <header className="admin-header">
          <div className="admin-title-block">
            <p className="admin-eyebrow">Backoffice</p>
            <h1>Maestro de {activeTabConfig.label}</h1>
          </div>
          <div className="admin-header-actions">
            <span className="admin-count-badge">{loading ? '...' : data.length} registros</span>
            <button
              onClick={openCreateModal}
              className="primary-action"
            >
              {createLabels[activeTab] || 'Nuevo registro'}
            </button>
          </div>
        </header>

        <section className="admin-card">
          <div className="admin-tablebar">
            <h2>{activeTabConfig.label}</h2>
          </div>
          {loading ? (
            <div className="admin-empty">Cargando...</div>
          ) : data.length === 0 ? (
            <div className="admin-empty">Sin registros.</div>
          ) : (
            <div className="admin-table-scroll">
              {(() => {
                const tableColumns = data.length > 0 ? getTableColumns(data[0]) : [];
                return (
              <table className="admin-table">
                <thead>
                  <tr>
                    {tableColumns.map(key => (
                      <th key={key}>{getColumnLabel(key)}</th>
                    ))}
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(item => (
                    <tr key={item.id}>
                      {tableColumns.map(key => {
                        const value = item[key];
                        const isArray = Array.isArray(value);
                        return (
                          <td key={key} data-label={getColumnLabel(key)}>
                            {isArray && key !== 'equipos' ? (
                              <button
                                onClick={() => handleViewRelated(key, value, key)}
                                className="relation-pill"
                              >
                                <span className="relation-pill-count">{value.length}</span>
                                <span>registros</span>
                              </button>
                            ) : key === 'estado' ? (
                              <span className={`inline-flex rounded-full px-2 py-1 text-[0.76rem] font-medium ${estadoClasses[item.estado] || 'bg-neutral-100 text-neutral-700'}`}>
                                {getDisplayValue(item, key)}
                              </span>
                            ) : (
                              <span className={key === 'descripcion' ? 'admin-table-value is-long' : 'admin-table-value'}>
                                {getDisplayValue(item, key).slice(0, 120)}
                              </span>
                            )}
                          </td>
                        );
                      })}
                      <td data-label="Acciones" className="admin-actions-cell">
                        <div className="row-actions">
                          <button
                            onClick={() => openEditModal(item)}
                            className="table-action table-action-edit"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="table-action table-action-delete"
                          >
                            Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
                );
              })()}
            </div>
          )}
        </section>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="w-full max-w-md max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-2xl sm:p-8">
            <h3 className="mb-4 text-[1.25rem] font-semibold text-neutral-900">{isEditing ? `Editar ${entityLabels[activeTab] || 'registro'}` : (createLabels[activeTab] || 'Nuevo registro')}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {fieldConfigs[activeTab].map(field => {
                const fieldType = getFieldType(field);
                const selectOptions = getSelectOptions(field);
                
                if (fieldType === 'select' && selectOptions.length > 0) {
                  return (
                    <div key={field}>
                      <label className="mb-1 block text-[0.85rem] font-medium text-neutral-700">{getColumnLabel(field)}</label>
                      <select
                        name={field}
                        value={formData[field] || ''}
                        onChange={handleInputChange}
                        required={!['vendedorId', 'equipoId'].includes(field)}
                        className="input-base"
                      >
                        <option value="">Seleccionar...</option>
                        {selectOptions.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.nombre || opt.descripcion || opt.id}</option>
                        ))}
                      </select>
                    </div>
                  );
                }

                if (fieldType === 'checkbox') {
                  return (
                    <label key={field} className="flex items-center gap-2 text-[0.85rem] font-medium text-neutral-700">
                      <input
                        type="checkbox"
                        name={field}
                        checked={Boolean(formData[field])}
                        onChange={handleInputChange}
                      />
                      {getColumnLabel(field)}
                    </label>
                  );
                }

                return (
                  <div key={field}>
                    <label className="mb-1 block text-[0.85rem] font-medium text-neutral-700">{getColumnLabel(field)}</label>
                    <input
                      type={fieldType}
                      name={field}
                      value={getInputValue(field, formData[field])}
                      onChange={handleInputChange}
                      required={!['tel', 'text'].includes(fieldType) || !['telefono', 'imagenUrl', 'firmaImagenUrl', 'fabricante', 'ubicacion', 'notasTecnicas'].includes(field)}
                      step={fieldType === 'number' ? '0.01' : undefined}
                      className="input-base"
                    />
                  </div>
                );
              })}
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <button
                  type="submit"
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-[0.9rem] font-medium text-white transition hover:bg-neutral-700"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg bg-neutral-200 px-4 py-2 text-[0.9rem] font-medium text-neutral-800 transition hover:bg-neutral-300"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <div className="w-full max-w-4xl max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-lg bg-white p-5 sm:p-8">
            <h3 className="text-2xl font-bold mb-4">{viewData.title}</h3>
            {viewData.items.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gray-100">
                      {Object.keys(viewData.items[0]).map(key => (
                        <th key={key} className="px-4 py-2 text-left text-sm font-semibold">{key}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewData.items.map((item, idx) => (
                      <tr key={idx} className="border-t">
                        {Object.keys(item).map(key => (
                          <td key={key} className="px-4 py-2 text-sm">{String(item[key]).slice(0, 30)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-gray-500">No hay registros relacionados.</p>
            )}
            <button
              onClick={() => setViewModal(false)}
              className="mt-6 w-full bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded transition"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Admin() {
  return (
    <Suspense fallback={<div className="min-h-screen p-6 md:p-8"><div className="panel p-6">Cargando...</div></div>}>
      <AdminContent />
    </Suspense>
  );
}
