// src/pages/Results.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import QueryForm from '../components/QueryForm';
import ResultsDashboard from '../components/ResultsDashboard';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';

const Results = () => {
  const { user } = useAuth();
  const { employmentData } = useData();
  const navigate = useNavigate();
  
  // Redirigir al login si no está autenticado
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);
  
  // Redirigir a búsqueda si no hay datos disponibles
  useEffect(() => {
    if (user && !employmentData) {
      navigate('/search');
    }
  }, [user, employmentData, navigate]);

  // Si no está autenticado o no hay datos, no renderizar el contenido de la página
  if (!user || !employmentData) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto max-w-6xl px-4 py-8">
        <QueryForm isUpdate={true} />
        <ResultsDashboard />
      </main>
    </div>
  );
};

export default Results;