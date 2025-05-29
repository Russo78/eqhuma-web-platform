// src/components/ExportControls.jsx
import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { exportToPdf, exportToExcel } from '../utils/exportUtils';

const ExportControls = () => {
  const { employmentData } = useData();
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState('');

  const handleExport = async (format) => {
    if (!employmentData) return;
    
    setIsExporting(true);
    setError('');
    
    try {
      if (format === 'pdf') {
        await exportToPdf(employmentData);
      } else if (format === 'excel') {
        await exportToExcel(employmentData);
      }
    } catch (err) {
      console.error('Error de exportación:', err);
      setError(`Error al exportar como ${format.toUpperCase()}. Por favor, inténtalo de nuevo.`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      {error && (
        <div className="text-red-500 text-sm mb-2">{error}</div>
      )}
      <button
        onClick={() => handleExport('pdf')}
        disabled={isExporting}
        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-300"
      >
        {isExporting ? 'Exportando...' : 'Exportar como PDF'}
      </button>
      <button
        onClick={() => handleExport('excel')}
        disabled={isExporting}
        className="px-4 py-2 border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50 transition-colors disabled:border-blue-300 disabled:text-blue-300"
      >
        {isExporting ? 'Exportando...' : 'Exportar como Excel'}
      </button>
    </div>
  );
};

export default ExportControls;