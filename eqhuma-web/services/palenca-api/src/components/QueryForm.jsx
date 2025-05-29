// src/components/QueryForm.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';

const QueryForm = ({ isUpdate = false }) => {
  const [identifier, setIdentifier] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [employer, setEmployer] = useState('');
  const [region, setRegion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { searchParams, searchEmploymentHistory, setSearchParams } = useData();

  // Precargar el formulario con los parámetros de búsqueda existentes en modo actualización
  useEffect(() => {
    if (isUpdate && searchParams) {
      setIdentifier(searchParams.identifier || '');
      setStartDate(searchParams.startDate || '');
      setEndDate(searchParams.endDate || '');
      setEmployer(searchParams.employer || '');
      setRegion(searchParams.region || '');
    }
  }, [isUpdate, searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const params = {
        identifier,
        startDate,
        endDate,
        employer,
        region
      };
      
      setSearchParams(params);
      await searchEmploymentHistory(params);
      
      if (!isUpdate) {
        navigate('/results');
      }
    } catch (err) {
      setError(err.message || 'Error al obtener los datos. Por favor, inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-semibold mb-4">
        Buscar Historial Laboral
      </h2>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded-md mb-4">
          {error}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-4">
          <div className="form-group">
            <label htmlFor="identifier" className="block text-gray-700 mb-1">NSS/CURP</label>
            <input 
              type="text" 
              id="identifier" 
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="Ingresa el número de NSS o CURP"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required 
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label htmlFor="startDate" className="block text-gray-700 mb-1">Fecha de Inicio</label>
            <input 
              type="date" 
              id="startDate" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          <div className="form-group">
            <label htmlFor="endDate" className="block text-gray-700 mb-1">Fecha de Fin</label>
            <input 
              type="date" 
              id="endDate" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="form-group">
            <label htmlFor="employer" className="block text-gray-700 mb-1">Empresa (Opcional)</label>
            <input 
              type="text" 
              id="employer" 
              value={employer}
              onChange={(e) => setEmployer(e.target.value)}
              placeholder="Filtrar por nombre de empresa"
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
            />
          </div>
          <div className="form-group">
            <label htmlFor="region" className="block text-gray-700 mb-1">Región (Opcional)</label>
            <select 
              id="region" 
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Seleccionar región</option>
              <option value="north">Norte</option>
              <option value="south">Sur</option>
              <option value="central">Centro</option>
            </select>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md transition-colors disabled:bg-blue-400"
            disabled={isLoading}
          >
            {isLoading ? 'Buscando...' : isUpdate ? 'Actualizar Búsqueda' : 'Buscar'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default QueryForm;