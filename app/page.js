'use client';

import { useEffect, useState } from 'react';

export default function Dashboard() {
  const [stats, setStats] = useState({ clientes: 0, equipos: 0, visitas: 0 });

useEffect(() => {
  const fetchStats = async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  fetchStats();
}, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">Dashboard CMCing</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white bg-opacity-70 backdrop-blur-md rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-blue-600">Clientes</h2>
            <p className="text-3xl font-bold text-gray-800">{stats.clientes}</p>
          </div>
          <div className="bg-white bg-opacity-70 backdrop-blur-md rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-green-600">Equipos</h2>
            <p className="text-3xl font-bold text-gray-800">{stats.equipos}</p>
          </div>
          <div className="bg-white bg-opacity-70 backdrop-blur-md rounded-lg p-6 shadow-lg">
            <h2 className="text-2xl font-semibold text-purple-600">Visitas</h2>
            <p className="text-3xl font-bold text-gray-800">{stats.visitas}</p>
          </div>
        </div>
        <div className="bg-white bg-opacity-70 backdrop-blur-md rounded-lg p-6 shadow-lg">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Acciones Rápidas</h2>
          <div className="flex flex-wrap gap-4">
            <a href="/admin" className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition">Backoffice</a>
            <a href="/nueva-visita" className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg transition">Nueva Visita</a>
          </div>
        </div>
      </div>
    </div>
  );
}
