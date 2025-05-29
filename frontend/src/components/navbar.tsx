'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, User, LogOut } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [usuario, setUsuario] = useState<{ email: string } | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Verificar estado de autenticación
    const token = localStorage.getItem('token');
    const usuarioData = localStorage.getItem('usuario');
    
    if (token && usuarioData) {
      setIsLoggedIn(true);
      setUsuario(JSON.parse(usuarioData));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('usuario');
    setIsLoggedIn(false);
    setUsuario(null);
    router.push('/auth/login');
  };

  const navItems = [
    { label: 'Inicio', href: '/' },
    { label: 'Cursos', href: '/cursos' },
    { label: 'Webinars', href: '/webinars' },
  ];

  return (
    <nav className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo y navegación principal */}
          <div className="flex">
            <div className="flex-shrink-0 flex items-center">
              <Link href="/" className="text-xl font-bold text-black">
                EQHUMA
              </Link>
            </div>
            
            {/* Enlaces de navegación (escritorio) */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium ${
                    pathname === item.href
                      ? 'text-black border-b-2 border-black'
                      : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Botones de autenticación */}
          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {isLoggedIn ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <User className="h-4 w-4" />
                    <span>{usuario?.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => router.push('/perfil')}>
                    Mi Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/mis-cursos')}>
                    Mis Cursos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/mis-webinars')}>
                    Mis Webinars
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Cerrar Sesión
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="space-x-4">
                <Button 
                  variant="ghost"
                  onClick={() => router.push('/auth/login')}
                >
                  Iniciar Sesión
                </Button>
                <Button 
                  className="bg-black hover:bg-gray-800 text-white"
                  onClick={() => router.push('/auth/registro')}
                >
                  Registrarse
                </Button>
              </div>
            )}
          </div>

          {/* Botón menú móvil */}
          <div className="flex items-center sm:hidden">
            <Button
              variant="ghost"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>

      {/* Menú móvil */}
      {isMobileMenuOpen && (
        <div className="sm:hidden">
          <div className="pt-2 pb-3 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block pl-3 pr-4 py-2 text-base font-medium ${
                  pathname === item.href
                    ? 'text-black bg-gray-50 border-l-4 border-black'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </div>
          
          {/* Opciones de autenticación móvil */}
          <div className="pt-4 pb-3 border-t border-gray-200">
            {isLoggedIn ? (
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  className="w-full text-left pl-3"
                  onClick={() => {
                    router.push('/perfil');
                    setIsMobileMenuOpen(false);
                  }}
                >
                  Mi Perfil
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-left pl-3"
                  onClick={() => {
                    router.push('/mis-cursos');
                    setIsMobileMenuOpen(false);
                  }}
                >
                  Mis Cursos
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-left pl-3"
                  onClick={() => {
                    router.push('/mis-webinars');
                    setIsMobileMenuOpen(false);
                  }}
                >
                  Mis Webinars
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-left pl-3 text-red-600"
                  onClick={() => {
                    handleLogout();
                    setIsMobileMenuOpen(false);
                  }}
                >
                  Cerrar Sesión
                </Button>
              </div>
            ) : (
              <div className="space-y-1 px-4">
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    router.push('/auth/login');
                    setIsMobileMenuOpen(false);
                  }}
                >
                  Iniciar Sesión
                </Button>
                <Button
                  className="w-full bg-black hover:bg-gray-800 text-white"
                  onClick={() => {
                    router.push('/auth/registro');
                    setIsMobileMenuOpen(false);
                  }}
                >
                  Registrarse
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
