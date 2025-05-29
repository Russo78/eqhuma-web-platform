/** @type {import('next').NextConfig} */
const nextConfig = {
  // Habilitar React strict mode para mejor detección de problemas
  reactStrictMode: true,
  
  // Configuración de imágenes externas permitidas
  images: {
    domains: [
      'localhost',
      'via.placeholder.com', // Para imágenes de placeholder
      'images.pexels.com',   // Para imágenes de ejemplo
      'api.eqhuma.com',      // Para imágenes del backend (ajustar según dominio real)
    ],
    // Configuración de formatos de imagen permitidos
    formats: ['image/avif', 'image/webp'],
  },

  // Configuración de headers de seguridad
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },

  // Configuración de redirecciones
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true,
      },
      {
        source: '/inicio',
        destination: '/',
        permanent: true,
      },
    ];
  },

  // Configuración de reescritura de rutas para el API
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4000/:path*', // Ajustar según la URL del API Manager
      },
    ];
  },

  // Configuración del entorno
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000',
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
  },

  // Configuración de webpack (si es necesario)
  webpack(config) {
    // Aquí puedes agregar configuraciones personalizadas de webpack
    return config;
  },

  // Configuración de internacionalización
  i18n: {
    locales: ['es'],
    defaultLocale: 'es',
  },

  // Configuración de compilación
  swcMinify: true,

  // Configuración de rutas de salida
  output: 'standalone',

  // Configuración de análisis de paquetes (opcional)
  // analyze: true,

  // Configuración de caché de compilación
  experimental: {
    // Habilitar características experimentales si es necesario
    // appDir: true, // Ya está habilitado por defecto en las últimas versiones
    serverActions: true,
  },

  // Configuración de TypeScript (si es necesario)
  typescript: {
    // Ignorar errores de TypeScript en producción
    ignoreBuildErrors: process.env.NODE_ENV === 'production',
  },
};

module.exports = nextConfig;
