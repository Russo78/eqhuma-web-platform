// src/components/ResultsDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import ExportControls from './ExportControls';
import { formatDate } from '../utils/formatUtils';

const ResultsDashboard = () => {
  const { employmentData, isLoading } = useData();
  const [sortField, setSortField] = useState('start_date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage] = useState(10);
  const [sortedRecords, setSortedRecords] = useState([]);

  useEffect(() => {
    if (employmentData && employmentData.employment_records) {
      const sortRecords = () => {
        const records = [...employmentData.employment_records];
        records.sort((a, b) => {
          let compareA = a[sortField];
          let compareB = b[sortField];
          
          // Manejo especial para fechas
          if (sortField === 'start_date' || sortField === 'end_date') {
            compareA = new Date(compareA);
            compareB = new Date(compareB);
          }
          
          // Para números, asegurar que se comparen como números
          if (sortField === 'weeks_contributed') {
            compareA = Number(compareA);
            compareB = Number(compareB);
          }
          
          if (compareA < compareB) return sortOrder === 'asc' ? -1 : 1;
          if (compareA > compareB) return sortOrder === 'asc' ? 1 : -1;
          return 0;
        });
        
        setSortedRecords(records);
      };
      
      sortRecords();
    }
  }, [employmentData, sortField, sortOrder]);

  const handleSortChange = (field) => {
    setSortField(field);
  };

  const handleOrderChange = (order) => {
    setSortOrder(order);
  };

  // Lógica de paginación
  const indexOfLastRecord = currentPage * recordsPerPage;
  const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;
  const currentRecords = sortedRecords.slice(indexOfFirstRecord, indexOfLastRecord);
  const totalPages = Math.ceil((sortedRecords?.length || 0) / recordsPerPage);

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-center py-12">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!employmentData || !employmentData.employment_records || employmentData.employment_records.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 text-center">
        <p className="text-gray-500 py-8">No se encontraron registros laborales. Por favor, intenta con otra búsqueda.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
        <h2 className="text-xl font-semibold mb-3 sm:mb-0">Resultados del Historial Laboral</h2>
        <ExportControls />
      </div>
      
      {employmentData.user_info && (
        <div className="mb-6 border-b pb-4">
          <h3 className="text-lg font-medium">{employmentData.user_info.name}</h3>
          <p className="text-gray-600">
            NSS: {employmentData.user_info.nss} | CURP: {employmentData.user_info.curp}
          </p>
        </div>
      )}
      
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="form-group">
          <label htmlFor="sort-by" className="block text-gray-700 mb-1">Ordenar Por</label>
          <select 
            id="sort-by" 
            value={sortField}
            onChange={(e) => handleSortChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="start_date">Fecha de Inicio</option>
            <option value="end_date">Fecha de Fin</option>
            <option value="employer">Empresa</option>
            <option value="weeks_contributed">Semanas Cotizadas</option>
          </select>
        </div>
        <div className="form-group">
          <label htmlFor="order" className="block text-gray-700 mb-1">Orden</label>
          <select 
            id="order" 
            value={sortOrder}
            onChange={(e) => handleOrderChange(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="desc">Más Reciente Primero</option>
            <option value="asc">Más Antiguo Primero</option>
          </select>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="py-3 px-4 text-left text-gray-700 font-medium">Empresa</th>
              <th className="py-3 px-4 text-left text-gray-700 font-medium">Fecha de Inicio</th>
              <th className="py-3 px-4 text-left text-gray-700 font-medium">Fecha de Fin</th>
              <th className="py-3 px-4 text-left text-gray-700 font-medium">Puesto</th>
              <th className="py-3 px-4 text-left text-gray-700 font-medium">Semanas Cotizadas</th>
            </tr>
          </thead>
          <tbody>
            {currentRecords.map((record, index) => (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="py-3 px-4 border-t">{record.employer}</td>
                <td className="py-3 px-4 border-t">{formatDate(record.start_date)}</td>
                <td className="py-3 px-4 border-t">{formatDate(record.end_date)}</td>
                <td className="py-3 px-4 border-t">{record.position}</td>
                <td className="py-3 px-4 border-t">{record.weeks_contributed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-3 bg-gray-50 rounded-md">
          <span className="text-gray-600 text-sm block">Total de Registros:</span>
          <span className="text-lg font-medium">{employmentData.summary.total_records}</span>
        </div>
        <div className="p-3 bg-gray-50 rounded-md">
          <span className="text-gray-600 text-sm block">Total de Semanas Cotizadas:</span>
          <span className="text-lg font-medium">{employmentData.summary.total_weeks_contributed}</span>
        </div>
        <div className="p-3 bg-gray-50 rounded-md">
          <span className="text-gray-600 text-sm block">Total de Años:</span>
          <span className="text-lg font-medium">{employmentData.summary.total_years}</span>
        </div>
      </div>
      
      {totalPages > 1 && (
        <div className="mt-6 flex justify-center items-center">
          <button 
            className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => paginate(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Anterior
          </button>
          <span className="mx-4">
            Página {currentPage} de {totalPages}
          </span>
          <button 
            className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => paginate(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </button>
        </div>
      )}
    </div>
  );
};

export default ResultsDashboard;