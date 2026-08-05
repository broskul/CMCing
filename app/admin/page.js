'use client';

import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { ComboBox } from '../components/ComboBox';

const fieldConfigs = {
  clientes: ['nombre', 'rut', 'tipoEntidad', 'email', 'telefono', 'direccion', 'giro', 'notas'],
  servicios: ['descripcion', 'precio', 'tipo', 'duracionEstimadaMin', 'activo'],
  actividades: ['nombre', 'descripcion', 'tipo', 'duracionEstimadaMin', 'obligatoria', 'activa'],
  vendedores: ['nombre', 'email', 'telefono'],
  tecnicos: ['nombre', 'especialidad', 'email', 'telefono', 'firmaTexto', 'firmaImagenUrl', 'activo'],
  visitas: ['clienteId', 'equipoId', 'tecnicoId', 'vendedorId', 'servicioId', 'fecha', 'descripcion', 'notasTecnicas', 'estado'],
  camiones: ['patente', 'codigoInterno', 'marca', 'modelo', 'anio', 'tipo', 'largoM', 'anchoM', 'altoM', 'taraKg', 'cargaMaxKg', 'volumenM3', 'propietarioTipo', 'propietarioClienteId', 'proveedorNombre', 'estado', 'conductorIds', 'observaciones'],
  conductores: ['nombre', 'rut', 'telefono', 'email', 'licencia', 'licenciaVence', 'estado', 'camionIds', 'observaciones'],
};

const tabs = [
  { key: 'clientes', label: 'Clientes', api: '/api/clientes' },
  { key: 'servicios', label: 'Servicios', api: '/api/servicios' },
  { key: 'actividades', label: 'Actividades', api: '/api/actividades' },
  { key: 'vendedores', label: 'Vendedores', api: '/api/vendedores' },
  { key: 'tecnicos', label: 'Técnicos', api: '/api/tecnicos' },
  { key: 'visitas', label: 'Visitas', api: '/api/visitas' },
  { key: 'camiones', label: 'Camiones', api: '/api/camiones' },
  { key: 'conductores', label: 'Conductores', api: '/api/conductores' },
];

const createLabels = {
  clientes: 'Nuevo cliente',
  servicios: 'Nuevo servicio',
  actividades: 'Nueva actividad',
  vendedores: 'Nuevo vendedor',
  tecnicos: 'Nuevo técnico',
  visitas: 'Nueva visita',
  camiones: 'Nuevo camión',
  conductores: 'Nuevo conductor',
};

const entityLabels = {
  clientes: 'cliente',
  servicios: 'servicio',
  actividades: 'actividad',
  vendedores: 'vendedor',
  tecnicos: 'técnico',
  visitas: 'visita',
  camiones: 'camión',
  conductores: 'conductor',
};

const relationKeysById = {
  clienteId: 'cliente',
  equipoId: 'equipo',
  tecnicoId: 'tecnico',
  vendedorId: 'vendedor',
  servicioId: 'servicio',
  propietarioClienteId: 'propietarioCliente',
};

const relationOptionKeys = {
  clienteId: 'clientes',
  equipoId: 'equipos',
  tecnicoId: 'tecnicos',
  vendedorId: 'vendedores',
  servicioId: 'servicios',
  propietarioClienteId: 'clientes',
  conductorIds: 'conductores',
  camionIds: 'camiones',
};

const fieldLabels = {
  activa: 'Activa',
  activo: 'Activo',
  altoM: 'Alto (m)',
  anchoM: 'Ancho (m)',
  anio: 'Año',
  camionIds: 'Camiones asignados',
  camiones: 'Camiones',
  cargaMaxKg: 'Carga máx. (kg)',
  cliente: 'Cliente',
  clienteId: 'Cliente',
  codigoInterno: 'Código interno',
  conductorIds: 'Conductores asignados',
  conductores: 'Conductores',
  criticidad: 'Criticidad',
  descripcion: 'Descripción',
  direccion: 'Dirección',
  duracionEstimadaMin: 'Duración estimada',
  email: 'Email',
  equipo: 'Equipo',
  equipoId: 'Equipo',
  equipos: 'Equipos',
  especialidad: 'Especialidad',
  estado: 'Estado',
  fecha: 'Fecha',
  firmaImagenUrl: 'Imagen firma',
  firmaTexto: 'Texto firma',
  giro: 'Giro',
  imagenUrl: 'Imagen',
  largoM: 'Largo (m)',
  licencia: 'Licencia',
  licenciaVence: 'Vence licencia',
  marca: 'Marca',
  modelo: 'Modelo',
  nombre: 'Nombre',
  notas: 'Notas',
  notasTecnicas: 'Notas técnicas',
  observaciones: 'Observaciones',
  obligatoria: 'Obligatoria',
  patente: 'Patente',
  precio: 'Precio',
  propietarioCliente: 'Mandante / proveedor',
  propietarioClienteId: 'Mandante / proveedor',
  propietarioTipo: 'Propietario',
  proveedorNombre: 'Nombre proveedor',
  rut: 'RUT',
  serial: 'Serial',
  servicio: 'Servicio',
  servicioId: 'Servicio',
  taraKg: 'Tara (kg)',
  tecnico: 'Técnico',
  tecnicoId: 'Técnico',
  telefono: 'Teléfono',
  tipo: 'Tipo',
  tipoEntidad: 'Tipo de entidad',
  vendedor: 'Vendedor',
  vendedorId: 'Vendedor',
  visitas: 'Visitas',
  volumenM3: 'Volumen (m3)',
};

const fieldLabelsByModule = {
  clientes: { nombre: 'Nombre o Razón Social', email: 'Mail' },
};

const tableColumnConfigs = {
  clientes: ['nombre', 'rut', 'tipoEntidad', 'email', 'telefono', 'direccion', 'equipos', 'visitas'],
  camiones: ['patente', 'marca', 'modelo', 'propietarioTipo', 'propietarioCliente', 'conductores', 'estado'],
  conductores: ['nombre', 'rut', 'telefono', 'licencia', 'licenciaVence', 'camiones', 'estado'],
};

const enumOptions = {
  estado: ['pendiente', 'en_progreso', 'completada', 'cancelada'],
  propietarioTipo: ['interno', 'proveedor', 'mandante'],
  tipoEntidad: ['cliente', 'mandante', 'proveedor', 'interno'],
};

const enumOptionsByModule = {
  camiones: {
    estado: ['activo', 'mantencion', 'inactivo'],
  },
  conductores: {
    estado: ['activo', 'inactivo'],
  },
};

const estadoClasses = {
  activo: 'bg-emerald-100 text-emerald-800',
  mantencion: 'bg-amber-100 text-amber-800',
  pendiente: 'bg-amber-100 text-amber-800',
  en_progreso: 'bg-sky-100 text-sky-800',
  completada: 'bg-emerald-100 text-emerald-800',
  cancelada: 'bg-rose-100 text-rose-800',
  inactivo: 'bg-neutral-100 text-neutral-700',
};

const emptyContactForm = { nombre: '', cargo: '', email: '', telefono: '', rol: 'principal', principal: false, notas: '' };
const emptyAddressForm = { tipo: 'servicio', nombre: '', direccion: '', comuna: '', ciudad: '', region: '', principal: false, notas: '' };

function cleanRut(value) {
  return String(value || '').replace(/\./g, '').replace(/-/g, '').trim().toUpperCase();
}

function formatRut(value) {
  const clean = cleanRut(value);
  if (clean.length < 2) return String(value || '');
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${dv}`;
}

function isValidRut(value) {
  const clean = cleanRut(value);
  if (!/^\d{7,8}[0-9K]$/.test(clean)) return false;
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  let sum = 0;
  let multiplier = 2;
  for (let i = body.length - 1; i >= 0; i -= 1) {
    sum += Number(body[i]) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expected = 11 - (sum % 11);
  const expectedDv = expected === 11 ? '0' : expected === 10 ? 'K' : String(expected);
  return dv === expectedDv;
}

function formatFriendlyDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatLabel(value) {
  return String(value || '-').replaceAll('_', ' ');
}

function displayName(item) {
  return item?.nombre || item?.descripcion || item?.patente || item?.codigo || item?.numero || item?.titulo || `#${item?.id || ''}`;
}

function displayOption(item) {
  if (!item) return '';
  if (item.patente) return `${item.patente}${item.marca ? ` · ${item.marca}` : ''}`;
  if (item.serial) return `${item.nombre} · ${item.serial}`;
  if (item.rut) return `${item.nombre} · ${item.rut}`;
  return displayName(item);
}

function currency(value) {
  if (value === null || typeof value === 'undefined' || value === '') return '-';
  return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(Number(value || 0));
}

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
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detailTab, setDetailTab] = useState('ficha');
  const [contactForm, setContactForm] = useState(emptyContactForm);
  const [editingContactId, setEditingContactId] = useState(null);
  const [addressForm, setAddressForm] = useState(emptyAddressForm);
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const res = await fetch(activeTabConfig.api);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `Error ${res.status}`);
      const rows = Array.isArray(result) ? result : [];
      setData(rows);
      setSelectedId((current) => (current && rows.some((row) => row.id === current) ? current : null));
    } catch (error) {
      console.error('Error fetching data:', error);
      setErrorMessage(error.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [activeTabConfig]);

  const fetchOptions = useCallback(async () => {
    try {
      const endpoints = {
        clientes: '/api/clientes',
        equipos: '/api/equipos',
        tecnicos: '/api/tecnicos',
        vendedores: '/api/vendedores',
        servicios: '/api/servicios',
        camiones: '/api/camiones',
        conductores: '/api/conductores',
      };
      const entries = await Promise.all(Object.entries(endpoints).map(async ([key, url]) => {
        const res = await fetch(url);
        return [key, res.ok ? await res.json() : []];
      }));
      setOptions(Object.fromEntries(entries));
    } catch (error) {
      console.error('Error fetching options:', error);
    }
  }, []);

  useEffect(() => {
    fetchData();
    fetchOptions();
    setDetailTab('ficha');
    setContactForm(emptyContactForm);
    setEditingContactId(null);
    setAddressForm(emptyAddressForm);
    setEditingAddressId(null);
  }, [fetchData, fetchOptions]);

  useEffect(() => {
    if (requestedTab === 'equipos') router.replace('/equipos');
  }, [requestedTab, router]);

  useEffect(() => {
    if (activeTab !== 'visitas' || !openNewFromUrl) return;
    setFormData({});
    setIsEditing(false);
    setShowModal(true);
    router.replace('/admin?modulo=visitas');
  }, [activeTab, openNewFromUrl, router]);

  const selectedItem = useMemo(() => data.find((item) => item.id === selectedId) || null, [data, selectedId]);

  const openCreateModal = () => {
    setFormData({});
    setIsEditing(false);
    setShowModal(true);
  };

  const openEditModal = (item) => {
    setFormData(item || selectedItem || {});
    setIsEditing(true);
    setShowModal(true);
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleMultiToggle = (field, id) => {
    setFormData((prev) => {
      const current = Array.isArray(prev[field]) ? prev[field].map(Number) : [];
      const numericId = Number(id);
      return {
        ...prev,
        [field]: current.includes(numericId) ? current.filter((item) => item !== numericId) : [...current, numericId],
      };
    });
  };

  const getFieldType = (fieldName) => {
    if (fieldName === 'rut') return 'rut';
    if (['conductorIds', 'camionIds'].includes(fieldName)) return 'multi';
    if (['descripcion', 'notas', 'observaciones', 'notasTecnicas'].includes(fieldName)) return 'textarea';
    if (fieldName.includes('email')) return 'email';
    if (fieldName.includes('telefono')) return 'tel';
    if (fieldName === 'licenciaVence') return 'date';
    if (fieldName.includes('fecha')) return 'datetime-local';
    if (['precio', 'duracionEstimadaMin', 'anio', 'largoM', 'anchoM', 'altoM', 'taraKg', 'cargaMaxKg', 'volumenM3'].includes(fieldName)) return 'number';
    if (['activo', 'activa', 'obligatoria'].includes(fieldName)) return 'checkbox';
    if (fieldName.includes('Id')) return 'select';
    if (enumOptions[fieldName]) return 'enum';
    return 'text';
  };

  const getSelectOptions = (fieldName) => options[relationOptionKeys[fieldName]] || [];
  const getColumnLabel = (key) => fieldLabelsByModule[activeTab]?.[key] || fieldLabels[key] || key;

  const getInputValue = (field, value) => {
    if (!value) return '';
    if (getFieldType(field) === 'date') {
      return String(value).slice(0, 10);
    }
    if (getFieldType(field) === 'datetime-local') {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return date.toISOString().slice(0, 16);
    }
    if (field === 'rut') return formatRut(value);
    return value;
  };

  const buildPayload = () => {
    const payload = fieldConfigs[activeTab].reduce((acc, field) => {
      acc[field] = formData[field] ?? '';
      return acc;
    }, {});

    Object.keys(payload).forEach((key) => {
      if (['conductorIds', 'camionIds'].includes(key)) {
        payload[key] = Array.isArray(payload[key]) ? payload[key].map(Number).filter(Number.isInteger) : [];
        return;
      }
      if (key.endsWith('Id')) {
        payload[key] = payload[key] === '' || payload[key] === null ? null : Number(payload[key]);
      }
      if (['precio', 'duracionEstimadaMin', 'anio', 'largoM', 'anchoM', 'altoM', 'taraKg', 'cargaMaxKg', 'volumenM3'].includes(key)) {
        payload[key] = payload[key] === '' || payload[key] === null ? null : Number(payload[key]);
      }
      if (['activo', 'activa', 'obligatoria'].includes(key)) {
        payload[key] = Boolean(payload[key]);
      }
      if (key === 'licenciaVence' && payload[key]) {
        payload[key] = String(payload[key]).slice(0, 10);
      } else if (key.includes('fecha') && payload[key]) {
        payload[key] = new Date(payload[key]).toISOString();
      }
      if (key === 'rut' && payload[key]) {
        if (!isValidRut(payload[key])) throw new Error('El RUT ingresado no es válido.');
        payload[key] = formatRut(payload[key]);
      }
      if (key === 'patente' && payload[key]) payload[key] = String(payload[key]).trim().toUpperCase();
    });

    return payload;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentTab = tabs.find((tab) => tab.key === activeTab);
    setSaving(true);
    setErrorMessage('');

    try {
      const res = await fetch(isEditing ? `${currentTab.api}/${formData.id}` : currentTab.api, {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || `Error ${res.status}`);
      setShowModal(false);
      setSelectedId(result.id || selectedId);
      await fetchData();
      await fetchOptions();
    } catch (error) {
      alert('Error: ' + error.message);
      setErrorMessage(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('¿Está seguro de que desea eliminar este registro?')) return;
    const currentTab = tabs.find((tab) => tab.key === activeTab);
    try {
      const res = await fetch(`${currentTab.api}/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const result = await res.json().catch(() => ({}));
        throw new Error(result.error || `Error ${res.status}`);
      }
      setSelectedId(null);
      await fetchData();
      await fetchOptions();
    } catch (error) {
      alert('Error: ' + error.message);
    }
  };

  const getTableColumns = (sampleItem) => {
    if (!sampleItem) return [];
    if (tableColumnConfigs[activeTab]) return tableColumnConfigs[activeTab].filter((key) => key in sampleItem);
    if (activeTab === 'visitas') return ['cliente', 'equipos', 'tecnico', 'servicio', 'fecha', 'estado'];
    return Object.keys(sampleItem)
      .filter((key) => !key.includes('At') && key !== 'id')
      .filter((key) => !(key.endsWith('Id') && sampleItem[relationKeysById[key]]))
      .slice(0, 7);
  };

  const getDisplayValue = (item, key) => {
    const value = item[key];
    if (key === 'fecha' || key === 'licenciaVence') return formatFriendlyDate(value);
    if (key === 'precio') return currency(value);
    if (key === 'estado') return formatLabel(value);
    if (key === 'rut') return value ? formatRut(value) : '-';
    if (Array.isArray(value)) {
      if (['equipos', 'conductores', 'camiones'].includes(key)) return value.length ? value.map(displayName).join(', ') : '-';
      return `${value.length}`;
    }
    if (value && typeof value === 'object') return displayName(value);
    if (value === null || typeof value === 'undefined' || value === '') return '-';
    return String(value);
  };

  const saveContact = async (event) => {
    event.preventDefault();
    if (!selectedItem) return;
    const url = editingContactId
      ? `/api/clientes/${selectedItem.id}/contactos/${editingContactId}`
      : `/api/clientes/${selectedItem.id}/contactos`;
    const res = await fetch(url, {
      method: editingContactId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contactForm),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) return alert(result.error || 'No se pudo guardar el contacto.');
    setContactForm(emptyContactForm);
    setEditingContactId(null);
    await fetchData();
  };

  const saveAddress = async (event) => {
    event.preventDefault();
    if (!selectedItem) return;
    const url = editingAddressId
      ? `/api/clientes/${selectedItem.id}/direcciones/${editingAddressId}`
      : `/api/clientes/${selectedItem.id}/direcciones`;
    const res = await fetch(url, {
      method: editingAddressId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addressForm),
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok) return alert(result.error || 'No se pudo guardar la dirección.');
    setAddressForm(emptyAddressForm);
    setEditingAddressId(null);
    await fetchData();
  };

  const deleteRelated = async (kind, id) => {
    if (!selectedItem || !confirm('¿Eliminar este registro relacionado?')) return;
    const res = await fetch(`/api/clientes/${selectedItem.id}/${kind}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const result = await res.json().catch(() => ({}));
      return alert(result.error || 'No se pudo eliminar.');
    }
    await fetchData();
  };

  const uploadCamionPhoto = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedItem) return;
    setPhotoUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('tipo', 'camion');
      const res = await fetch(`/api/camiones/${selectedItem.id}/fotos`, { method: 'POST', body: form });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.error || 'No se pudo subir la foto.');
      await fetchData();
    } catch (error) {
      alert(error.message);
    } finally {
      event.target.value = '';
      setPhotoUploading(false);
    }
  };

  const tableColumns = data.length > 0 ? getTableColumns(data[0]) : [];

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
            <button onClick={openCreateModal} className="primary-action">{createLabels[activeTab] || 'Nuevo registro'}</button>
          </div>
        </header>

        {errorMessage ? <div className="master-error">{errorMessage}</div> : null}

        <section className="admin-card">
          <div className="admin-tablebar">
            <h2>{activeTabConfig.label}</h2>
            <span className="master-selection-hint">{selectedItem ? `Ficha abierta: ${displayName(selectedItem)}` : 'Click en una fila para abrir ficha'}</span>
          </div>
          {loading ? (
            <div className="admin-empty">Cargando...</div>
          ) : data.length === 0 ? (
            <div className="admin-empty">Sin registros.</div>
          ) : (
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    {tableColumns.map((key) => <th key={key}>{getColumnLabel(key)}</th>)}
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((item) => (
                    <tr key={item.id} className={selectedId === item.id ? 'is-selected' : ''} onClick={() => { setSelectedId(item.id); setDetailTab('ficha'); }}>
                      {tableColumns.map((key) => (
                        <td key={key} data-label={getColumnLabel(key)}>
                          {key === 'estado' ? (
                            <span className={`inline-flex rounded-full px-2 py-1 text-[0.76rem] font-medium ${estadoClasses[item.estado] || 'bg-neutral-100 text-neutral-700'}`}>
                              {getDisplayValue(item, key)}
                            </span>
                          ) : (
                            <span className={key === 'descripcion' ? 'admin-table-value is-long' : 'admin-table-value'}>
                              {getDisplayValue(item, key).slice(0, 120)}
                            </span>
                          )}
                        </td>
                      ))}
                      <td data-label="Acciones" className="admin-actions-cell">
                        <div className="row-actions">
                          <button onClick={(event) => { event.stopPropagation(); openEditModal(item); }} className="table-action table-action-edit">Editar</button>
                          <button onClick={(event) => { event.stopPropagation(); handleDelete(item.id); }} className="table-action table-action-delete">Borrar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <MasterDetail
          activeTab={activeTab}
          item={selectedItem}
          detailTab={detailTab}
          setDetailTab={setDetailTab}
          getColumnLabel={getColumnLabel}
          getDisplayValue={getDisplayValue}
          onEdit={() => openEditModal(selectedItem)}
          contactForm={contactForm}
          setContactForm={setContactForm}
          editingContactId={editingContactId}
          setEditingContactId={setEditingContactId}
          saveContact={saveContact}
          addressForm={addressForm}
          setAddressForm={setAddressForm}
          editingAddressId={editingAddressId}
          setEditingAddressId={setEditingAddressId}
          saveAddress={saveAddress}
          deleteRelated={deleteRelated}
          uploadCamionPhoto={uploadCamionPhoto}
          photoUploading={photoUploading}
        />
      </div>

      {showModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 sm:p-4">
          <div className="w-full max-w-md max-h-[calc(100vh-1.5rem)] overflow-y-auto rounded-lg border border-neutral-200 bg-white p-5 shadow-2xl sm:p-8">
            <h3 className="mb-4 text-[1.25rem] font-semibold text-neutral-900">{isEditing ? `Editar ${entityLabels[activeTab] || 'registro'}` : (createLabels[activeTab] || 'Nuevo registro')}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {fieldConfigs[activeTab].map((field) => {
                const fieldType = getFieldType(field);
                const selectOptions = getSelectOptions(field);
                const rutIsPresent = field === 'rut' && formData[field];
                const rutOk = rutIsPresent ? isValidRut(formData[field]) : true;

                if (fieldType === 'select') {
                  return (
                    <div key={field}>
                      <label className="mb-1 block text-[0.85rem] font-medium text-neutral-700">{getColumnLabel(field)}</label>
                      <ComboBox
                        options={selectOptions}
                        value={formData[field] || ''}
                        onChange={(value) => setFormData((current) => ({ ...current, [field]: value }))}
                        getOptionLabel={displayOption}
                        placeholder="Seleccionar..."
                        emptyText="Sin opciones disponibles."
                        required={['clienteId', 'tecnicoId', 'servicioId'].includes(field)}
                      />
                    </div>
                  );
                }

                if (fieldType === 'multi') {
                  const values = Array.isArray(formData[field]) ? formData[field].map(Number) : [];
                  return (
                    <div key={field}>
                      <label className="mb-1 block text-[0.85rem] font-medium text-neutral-700">{getColumnLabel(field)}</label>
                      <div className="master-check-list">
                        {selectOptions.length ? selectOptions.map((opt) => (
                          <label key={opt.id}>
                            <input type="checkbox" checked={values.includes(Number(opt.id))} onChange={() => handleMultiToggle(field, opt.id)} />
                            <span>{displayOption(opt)}</span>
                          </label>
                        )) : <span>Sin opciones</span>}
                      </div>
                    </div>
                  );
                }

                if (fieldType === 'checkbox') {
                  return (
                    <label key={field} className="flex items-center gap-2 text-[0.85rem] font-medium text-neutral-700">
                      <input type="checkbox" name={field} checked={Boolean(formData[field])} onChange={handleInputChange} />
                      {getColumnLabel(field)}
                    </label>
                  );
                }

                if (fieldType === 'enum') {
                  const optionsForField = enumOptionsByModule[activeTab]?.[field] || enumOptions[field];
                  return (
                    <div key={field}>
                      <label className="mb-1 block text-[0.85rem] font-medium text-neutral-700">{getColumnLabel(field)}</label>
                      <ComboBox
                        options={optionsForField.map((option) => ({ id: option, label: formatLabel(option) }))}
                        value={formData[field] || ''}
                        onChange={(value) => setFormData((current) => ({ ...current, [field]: value }))}
                        placeholder="Seleccionar..."
                        emptyText="Sin opciones disponibles."
                      />
                    </div>
                  );
                }

                if (fieldType === 'textarea') {
                  return (
                    <div key={field}>
                      <label className="mb-1 block text-[0.85rem] font-medium text-neutral-700">{getColumnLabel(field)}</label>
                      <textarea name={field} value={formData[field] || ''} onChange={handleInputChange} className="input-base min-h-24" />
                    </div>
                  );
                }

                return (
                  <div key={field}>
                    <label className="mb-1 block text-[0.85rem] font-medium text-neutral-700">{getColumnLabel(field)}</label>
                    <input
                      type={fieldType === 'rut' ? 'text' : fieldType}
                      name={field}
                      value={getInputValue(field, formData[field])}
                      onChange={handleInputChange}
                      required={['nombre', 'descripcion', 'patente'].includes(field)}
                      step={fieldType === 'number' ? '0.01' : undefined}
                      className="input-base"
                    />
                    {field === 'rut' ? (
                      <p className={`rut-check ${rutIsPresent && !rutOk ? 'is-invalid' : 'is-valid'}`}>
                        {rutIsPresent ? (rutOk ? 'RUT válido' : 'RUT inválido') : 'Ingrese RUT para comprobarlo'}
                      </p>
                    ) : null}
                  </div>
                );
              })}
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <button type="submit" disabled={saving} className="rounded-lg bg-neutral-900 px-4 py-2 text-[0.9rem] font-medium text-white transition hover:bg-neutral-700">
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" onClick={() => setShowModal(false)} className="rounded-lg bg-neutral-200 px-4 py-2 text-[0.9rem] font-medium text-neutral-800 transition hover:bg-neutral-300">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MasterDetail({
  activeTab,
  item,
  detailTab,
  setDetailTab,
  getColumnLabel,
  getDisplayValue,
  onEdit,
  contactForm,
  setContactForm,
  editingContactId,
  setEditingContactId,
  saveContact,
  addressForm,
  setAddressForm,
  editingAddressId,
  setEditingAddressId,
  saveAddress,
  deleteRelated,
  uploadCamionPhoto,
  photoUploading,
}) {
  if (!item) {
    return (
      <section className="master-detail-panel panel">
        <div className="master-detail-empty">Selecciona un registro para ver su ficha completa, historial e interacciones.</div>
      </section>
    );
  }

  const tabKeys = ['ficha', 'historial', 'relaciones', 'documentos'];
  if (activeTab === 'clientes') tabKeys.splice(2, 0, 'contactos', 'direcciones');
  if (activeTab === 'camiones') tabKeys.push('fotos');

  const scalarEntries = Object.entries(item)
    .filter(([key, value]) => !['id', 'historial', 'documentos', 'contactos', 'direcciones', 'fotos'].includes(key)
      && !Array.isArray(value)
      && !(value && typeof value === 'object'))
    .slice(0, 18);

  return (
    <section className="master-detail-panel panel">
      <header className="master-detail-header">
        <div>
          <p>{entityLabels[activeTab] || 'registro'}</p>
          <h2>{displayName(item)}</h2>
        </div>
        <button type="button" className="table-action table-action-edit" onClick={onEdit}>Editar ficha</button>
      </header>

      <nav className="master-detail-tabs">
        {tabKeys.map((key) => (
          <button key={key} type="button" className={detailTab === key ? 'is-active' : ''} onClick={() => setDetailTab(key)}>
            {formatLabel(key)}
          </button>
        ))}
      </nav>

      {detailTab === 'ficha' ? (
        <div className="master-facts">
          {scalarEntries.map(([key]) => (
            <div key={key} className="master-fact">
              <span>{getColumnLabel(key)}</span>
              <strong>{getDisplayValue(item, key)}</strong>
            </div>
          ))}
        </div>
      ) : null}

      {detailTab === 'historial' ? (
        <Timeline items={item.historial || item.visitas || []} />
      ) : null}

      {detailTab === 'relaciones' ? (
        <Relations item={item} />
      ) : null}

      {detailTab === 'documentos' ? (
        <Documents items={item.documentos || []} />
      ) : null}

      {detailTab === 'contactos' && activeTab === 'clientes' ? (
        <RelatedEditor
          title="Contactos"
          items={item.contactos || []}
          form={contactForm}
          setForm={setContactForm}
          editingId={editingContactId}
          setEditingId={setEditingContactId}
          emptyForm={emptyContactForm}
          onSubmit={saveContact}
          onDelete={(id) => deleteRelated('contactos', id)}
          fields={['nombre', 'cargo', 'email', 'telefono', 'rol', 'principal', 'notas']}
        />
      ) : null}

      {detailTab === 'direcciones' && activeTab === 'clientes' ? (
        <RelatedEditor
          title="Direcciones"
          items={item.direcciones || []}
          form={addressForm}
          setForm={setAddressForm}
          editingId={editingAddressId}
          setEditingId={setEditingAddressId}
          emptyForm={emptyAddressForm}
          onSubmit={saveAddress}
          onDelete={(id) => deleteRelated('direcciones', id)}
          fields={['tipo', 'nombre', 'direccion', 'comuna', 'ciudad', 'region', 'principal', 'notas']}
        />
      ) : null}

      {detailTab === 'fotos' && activeTab === 'camiones' ? (
        <div className="master-photo-section">
          <label className="primary-action master-file-action">
            {photoUploading ? 'Subiendo...' : 'Tomar o subir foto'}
            <input type="file" accept="image/*" capture="environment" disabled={photoUploading} onChange={uploadCamionPhoto} />
          </label>
          <div className="master-photo-grid">
            {(item.fotos || []).map((foto) => (
              <article key={foto.id} className="master-photo-card">
                {foto.url ? (
                  <Image
                    src={foto.url}
                    alt={foto.titulo || foto.nombreOriginal || 'Foto camión'}
                    width={420}
                    height={315}
                    unoptimized
                  />
                ) : null}
                <strong>{foto.titulo || foto.nombreOriginal || 'Foto'}</strong>
                <span>{formatFriendlyDate(foto.createdAt)}</span>
              </article>
            ))}
            {!(item.fotos || []).length ? <p className="admin-empty">Sin fotos registradas.</p> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function Timeline({ items }) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return <div className="master-detail-empty">Sin interacciones registradas.</div>;
  return (
    <div className="master-timeline">
      {rows.map((item, index) => (
        <article key={item.id || index}>
          <span>{item.tipo || item.estado || 'Evento'}</span>
          <strong>{item.titulo || item.descripcion || item.nombre || `Registro ${item.id || index + 1}`}</strong>
          <time>{formatFriendlyDate(item.fecha || item.createdAt)}</time>
        </article>
      ))}
    </div>
  );
}

function Relations({ item }) {
  const blocks = [
    ['Equipos', item.equipos],
    ['Visitas', item.visitas],
    ['Camiones', item.camiones],
    ['Conductores', item.conductores],
    ['Servicios', item.serviciosRelacionados],
  ].filter(([, rows]) => Array.isArray(rows) && rows.length);

  if (!blocks.length) return <div className="master-detail-empty">Sin relaciones registradas.</div>;
  return (
    <div className="master-relation-grid">
      {blocks.map(([title, rows]) => (
        <section key={title}>
          <h3>{title}</h3>
          {rows.map((row, index) => (
            <div key={row.id || index} className="master-related-row">
              <strong>{displayName(row)}</strong>
              <span>{row.estado || row.tipo || row.serial || row.rut || row.fecha || '-'}</span>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function Documents({ items }) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) return <div className="master-detail-empty">Sin documentos asociados.</div>;
  return (
    <div className="master-relation-grid">
      <section>
        {rows.map((row, index) => (
          <div key={row.id || index} className="master-related-row">
            <strong>{row.nombre || row.titulo || `Documento ${index + 1}`}</strong>
            <span>{row.tipo || '-'} · {formatFriendlyDate(row.fecha || row.createdAt)}</span>
          </div>
        ))}
      </section>
    </div>
  );
}

function RelatedEditor({ title, items, form, setForm, editingId, setEditingId, emptyForm, onSubmit, onDelete, fields }) {
  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  return (
    <div className="related-editor">
      <div className="master-relation-grid">
        <section>
          <h3>{title}</h3>
          {(items || []).map((item) => (
            <div key={item.id} className="master-related-row">
              <strong>{item.nombre || item.direccion}</strong>
              <span>{item.email || item.telefono || item.comuna || item.tipo || '-'}</span>
              <div className="row-actions">
                <button type="button" className="table-action table-action-edit" onClick={() => { setEditingId(item.id); setForm({ ...emptyForm, ...item }); }}>Editar</button>
                <button type="button" className="table-action table-action-delete" onClick={() => onDelete(item.id)}>Borrar</button>
              </div>
            </div>
          ))}
          {!(items || []).length ? <p className="master-detail-empty">Sin registros.</p> : null}
        </section>
      </div>

      <form className="related-form" onSubmit={onSubmit}>
        <h3>{editingId ? 'Editar' : 'Agregar'} {title.toLowerCase()}</h3>
        {fields.map((field) => (
          field === 'principal' ? (
            <label key={field} className="related-check">
              <input type="checkbox" name={field} checked={Boolean(form[field])} onChange={handleChange} />
              Principal
            </label>
          ) : (
            <label key={field}>
              {fieldLabels[field] || formatLabel(field)}
              <input name={field} value={form[field] || ''} onChange={handleChange} required={['nombre', 'direccion'].includes(field)} />
            </label>
          )
        ))}
        <div className="row-actions">
          <button type="submit" className="table-action table-action-edit">Guardar</button>
          {editingId ? <button type="button" className="table-action" onClick={() => { setEditingId(null); setForm(emptyForm); }}>Cancelar edición</button> : null}
        </div>
      </form>
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
