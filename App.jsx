import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ApiDataProvider } from './context/ApiDataContext';

// Importaciones de páginas (se crearán más adelante)
const Login = React.lazy(() => import('./pages/Login'));
const Marketplace = React.lazy(() => import('./pages/Marketplace'));
const ApiDetail = React.lazy(() => import('./pages/ApiDetail'));
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Documentation = React.lazy(() => import('./pages/Documentation'));

// Componente de carga para React.lazy
const LoadingFallback = () => (
  <div className="flex justify-center items-center h-screen">
    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
    <p className="ml-3 text-lg text-blue-500">Cargando...</p>
  </div>
);

/**
 * Componente para proteger rutas que requieren autenticación
 * Redirecciona a login si el usuario no está autenticado
 */
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = localStorage.getItem('eqhuma_token') !== null;
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

/**
 * Componente principal de la aplicación eqhuma
 * Configura el enrutamiento y los proveedores de contexto
 */
function App() {
  return (
    <AuthProvider>
      <ApiDataProvider>
        <Router>
          <React.Suspense fallback={<LoadingFallback />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={
                <ProtectedRoute>
                  <Marketplace />
                </ProtectedRoute>
              } />
              <Route path="/api/:apiId" element={
                <ProtectedRoute>
                  <ApiDetail />
                </ProtectedRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/documentation" element={
                <ProtectedRoute>
                  <Documentation />
                </ProtectedRoute>
              } />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </React.Suspense>
        </Router>
      </ApiDataProvider>
    </AuthProvider>
  );
}

export default App;