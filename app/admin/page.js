'use client';

import { useState, useEffect } from 'react';

const fieldConfigs = {
  clientes: ['nombre', 'email', 'telefono', 'direccion'],
  equipos: ['nombre', 'modelo', 'serial', 'clienteId'],
  servicios: ['descripcion', 'precio'],
  vendedores: ['nombre', 'email', 'telefono'],
  tecnicos: ['nombre', 'especialidad', 'email', 'telefono'],
  visitas: ['clienteId', 'equipoId', 'tecnicoId', 'vendedorId', 'servicioId', 'fecha', 'descripcion', 'estado'],
};

export default function Admin() {
  const [activeTab, setActiveTab] = useState('clientes');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [options, setOptions] = useState({});
  const [viewModal, setViewModal] = useState(false);
  const [viewData, setViewData] = useState({ title: '', items: [] });

  const tabs = [
    { key: 'clientes', label: 'Clientes', api: '/api/clientes' },
    { key: 'equipos', label: 'Equipos', api: '/api/equipos' },
    { key: 'servicios', label: 'Servicios', api: '/api/servicios' },
    { key: 'vendedores', label: 'Vendedores', api: '/api/vendedores' },
    { key: 'tecnicos', label: 'Técnicos', api: '/api/tecnicos' },
    { key: 'visitas', label: 'Visitas', api: '/api/visitas' },
  ];

  useEffect(() => {
    fetchData();
    fetchOptions();
  }, [activeTab]);

  const fetchData = async () => {
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
  };

  const fetchOptions = async () => {
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
  };

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
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const currentTab = tabs.find(t => t.key === activeTab);
    
    try {
      const payload = { ...formData };
      // Convertir IDs a números
      ['clienteId', 'equipoId', 'tecnicoId', 'vendedorId', 'servicioId'].forEach(key => {
        if (payload[key]) payload[key] = parseInt(payload[key]);
      });
      if (payload.precio) payload.precio = parseFloat(payload.precio);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-200 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">Backoffice CMCing</h1>
        <div className="mb-6 flex justify-between items-center">
          <nav className="flex space-x-4">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  activeTab === tab.key
                    ? 'bg-blue-500 text-white'
                    : 'bg-white bg-opacity-70 backdrop-blur-md text-gray-700 hover:bg-opacity-90'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <button
            onClick={openCreateModal}
            className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition"
          >
            + Nuevo
          </button>
        </div>
        <div className="bg-white bg-opacity-70 backdrop-blur-md rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">{tabs.find(t => t.key === activeTab).label}</h2>
          {loading ? (
            <p>Cargando...</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-100">
                    {data.length > 0 && Object.keys(data[0]).filter(key => !key.includes('At') && key !== 'id').map(key => (
                      <th key={key} className="px-4 py-2 text-left text-sm font-semibold">{key}</th>
                    ))}
                    <th className="px-4 py-2 text-left text-sm font-semibold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map(item => (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      {Object.keys(item).filter(key => !key.includes('At') && key !== 'id').map(key => {
                        const value = item[key];
                        const isArray = Array.isArray(value);
                        return (
                          <td key={key} className="px-4 py-3 text-sm">
                            {isArray ? (
                              <button
                                onClick={() => handleViewRelated(key, value, key)}
                                className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-xs transition"
                              >
                                Ver ({value.length})
                              </button>
                            ) : typeof value === 'object' && value !== null ? (
                              <span className="text-gray-500">-</span>
                            ) : (
                              String(value).slice(0, 50)
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-sm space-x-2">
                        <button
                          onClick={() => openEditModal(item)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-xs transition"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => handleDelete(item.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-xs transition"
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-8 w-full max-w-md max-h-96 overflow-y-auto">
            <h3 className="text-2xl font-bold mb-4">{isEditing ? 'Editar' : 'Crear'} {tabs.find(t => t.key === activeTab).label}</h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              {fieldConfigs[activeTab].map(field => {
                const fieldType = getFieldType(field);
                const selectOptions = getSelectOptions(field);
                
                if (fieldType === 'select' && selectOptions.length > 0) {
                  return (
                    <div key={field}>
                      <label className="block text-sm font-medium mb-1">{field}</label>
                      <select
                        name={field}
                        value={formData[field] || ''}
                        onChange={handleInputChange}
                        required
                        className="w-full border border-gray-300 rounded px-3 py-2"
                      >
                        <option value="">Seleccionar...</option>
                        {selectOptions.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.nombre || opt.descripcion || opt.id}</option>
                        ))}
                      </select>
                    </div>
                  );
                }

                return (
                  <div key={field}>
                    <label className="block text-sm font-medium mb-1">{field}</label>
                    <input
                      type={fieldType}
                      name={field}
                      value={formData[field] || ''}
                      onChange={handleInputChange}
                      required={fieldType !== 'tel' && fieldType !== 'select'}
                      step={fieldType === 'number' ? '0.01' : undefined}
                      className="w-full border border-gray-300 rounded px-3 py-2"
                    />
                  </div>
                );
              })}
              <div className="flex gap-2 mt-6">
                <button
                  type="submit"
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition"
                >
                  Guardar
                </button>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-300 hover:bg-gray-400 text-gray-800 px-4 py-2 rounded transition"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {viewModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-8 w-full max-w-4xl max-h-96 overflow-y-auto">
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