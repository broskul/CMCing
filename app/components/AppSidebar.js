'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const navigationGroups = [
  {
    title: 'Inicio',
    items: [
      { label: 'Resumen', href: '/' },
    ],
  },
  {
    title: 'Comercial',
    items: [
      { label: 'Clientes', href: '/admin?modulo=clientes' },
      { label: 'Cotizaciones', href: '/cotizaciones' },
      { label: 'Vendedores', href: '/admin?modulo=vendedores' },
    ],
  },
  {
    title: 'Operación',
    items: [
      { label: 'Equipos', href: '/equipos' },
      { label: 'Servicios', href: '/admin?modulo=servicios' },
      { label: 'Actividades', href: '/admin?modulo=actividades' },
      { label: 'Visitas', href: '/admin?modulo=visitas' },
      { label: 'Calendario', href: '/calendario' },
    ],
  },
  {
    title: 'Personas',
    items: [
      { label: 'Técnicos', href: '/admin?modulo=tecnicos' },
      { label: 'App técnico', href: '/tecnico' },
    ],
  },
  {
    title: 'Informes',
    items: [
      { label: 'Visitas técnicas', href: '/informes/visitas' },
      { label: 'Facturación', href: '/informes/facturacion' },
    ],
  },
];

function isActive(pathname, currentHref, href) {
  if (href.includes('?')) {
    return currentHref === href;
  }
  const [path] = href.split('?');
  return pathname === path;
}

export default function AppSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const moduleParam = searchParams.get('modulo');
  const currentHref = pathname === '/admin' ? `/admin?modulo=${moduleParam || 'clientes'}` : pathname;

  useEffect(() => {
    let active = true;

    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (active) setUser(data.user || null);
      })
      .catch(() => {
        if (active) setUser(null);
      });

    return () => {
      active = false;
    };
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  const handleNavigate = () => {
    setMenuOpen(false);
  };

  return (
    <>
      <header className="mobile-topbar">
        <Link href="/" className="mobile-logo" onClick={handleNavigate}>
          <Image src="/brand/logo-cmcing.png" alt="CMCiing" width={160} height={60} className="h-9 w-auto object-contain" priority />
        </Link>
        <button
          type="button"
          className="mobile-menu-button"
          aria-label={menuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <button
        type="button"
        className={`sidebar-backdrop ${menuOpen ? 'is-visible' : ''}`}
        aria-label="Cerrar menú"
        onClick={() => setMenuOpen(false)}
      />

      <aside className={`app-sidebar ${menuOpen ? 'is-open' : ''}`}>
        <Link href="/" className="sidebar-logo" onClick={handleNavigate}>
          <Image src="/brand/logo-cmcing.png" alt="CMCiing" width={210} height={78} className="h-12 w-auto object-contain" priority />
        </Link>

        <nav className="sidebar-nav">
          {navigationGroups.map((section) => (
            <div key={section.title} className="sidebar-section">
              <p className="sidebar-section-title">{section.title}</p>
              <div className="sidebar-subnav">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleNavigate}
                    aria-current={isActive(pathname, currentHref, item.href) ? 'page' : undefined}
                    className={`sidebar-secondary ${isActive(pathname, currentHref, item.href) ? 'is-active' : ''}`}
                  >
                    <span className="sidebar-link-mark" aria-hidden="true" />
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <a
            href="https://wa.me/56972934950"
            target="_blank"
            rel="noreferrer"
            className="help-button"
          >
            ¿Necesitas ayuda?
          </a>
          <div className="sidebar-user">
            <span>{user?.nombre || 'CMCiing'}</span>
            <button type="button" onClick={logout}>Salir</button>
          </div>
        </div>
      </aside>
    </>
  );
}
