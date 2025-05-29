// src/pages/Search.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import QueryForm from '../components/QueryForm';
import { useAuth } from '../context/AuthContext';

const Search = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Redirigir al login si no está autenticado
  useEffect(() => {
    if (!user) {
      navigate('/login');
    }
  }, [user, navigate]);

  // Si no está autenticado, no renderizar el contenido de la página
  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto max-w-4xl px-4 py-8">
        <QueryForm />
        
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <div className="text-xl text-gray-500 mb-3">No hay resultados para mostrar</div>
          <p className="text-gray-400">Complete el formulario de arriba y envíelo para ver los resultados del historial laboral</p>
        </div>
      </main>
    </div>
  );
};

export default Search;