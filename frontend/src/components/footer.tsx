import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerSections = [
    {
      title: 'Plataforma',
      links: [
        { label: 'Cursos', href: '/cursos' },
        { label: 'Webinars', href: '/webinars' },
        { label: 'Blog', href: '/blog' },
        { label: 'Precios', href: '/precios' }
      ]
    },
    {
      title: 'Soporte',
      links: [
        { label: 'Centro de Ayuda', href: '/ayuda' },
        { label: 'Contacto', href: '/contacto' },
        { label: 'FAQ', href: '/faq' },
        { label: 'Términos de Servicio', href: '/terminos' }
      ]
    },
    {
      title: 'Empresa',
      links: [
        { label: 'Sobre Nosotros', href: '/sobre-nosotros' },
        { label: 'Carreras', href: '/carreras' },
        { label: 'Prensa', href: '/prensa' },
        { label: 'Privacidad', href: '/privacidad' }
      ]
    },
    {
      title: 'Comunidad',
      links: [
        { label: 'Discord', href: 'https://discord.gg/eqhuma' },
        { label: 'Twitter', href: 'https://twitter.com/eqhuma' },
        { label: 'LinkedIn', href: 'https://linkedin.com/company/eqhuma' },
        { label: 'GitHub', href: 'https://github.com/eqhuma' }
      ]
    }
  ];

  return (
    <footer className="bg-white border-t border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {footerSections.map((section) => (
            <div key={section.title}>
              <h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase">
                {section.title}
              </h3>
              <ul className="mt-4 space-y-4">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-base text-gray-500 hover:text-gray-900"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Sección inferior */}
        <div className="mt-12 border-t border-gray-200 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-2xl font-bold text-black">
                EQHUMA
              </Link>
              <p className="text-gray-500">
                © {currentYear} Eqhuma. Todos los derechos reservados.
              </p>
            </div>
            
            <div className="mt-4 md:mt-0">
              <div className="flex space-x-6">
                <Link
                  href="/privacidad"
                  className="text-gray-500 hover:text-gray-900"
                >
                  Política de Privacidad
                </Link>
                <Link
                  href="/terminos"
                  className="text-gray-500 hover:text-gray-900"
                >
                  Términos de Uso
                </Link>
                <Link
                  href="/cookies"
                  className="text-gray-500 hover:text-gray-900"
                >
                  Política de Cookies
                </Link>
              </div>
            </div>
          </div>

          <div className="mt-8 text-center text-gray-500 text-sm">
            <p>
              Desarrollado con ❤️ en México | Plataforma de aprendizaje en línea
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
