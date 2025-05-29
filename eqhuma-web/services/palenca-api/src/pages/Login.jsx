// src/pages/Login.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import LoginForm from '../components/LoginForm';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Si el usuario ya está autenticado, redirigir a la página de búsqueda
  useEffect(() => {
    if (user) {
      navigate('/search');
    }
  }, [user, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-800">Semanas Cotizadas</h1>
          <p className="mt-2 text-gray-600">Inicia sesión para acceder a tu historial laboral</p>
        </div>
        
        <LoginForm />
      </div>
    </div>
  );
};

export default Login;