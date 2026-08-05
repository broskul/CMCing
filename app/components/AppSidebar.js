'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import CommandCenter from './CommandCenter';

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
      { label: 'Clientes', href: '/admin?modulo=clientes', short: 'CL' },
      { label: 'Cotizaciones', href: '/cotizaciones', short: 'CO' },
      { label: 'Vendedores', href: '/admin?modulo=vendedores', short: 'VE' },
    ],
  },
  {
    title: 'Servicio técnico',
    items: [
      { label: 'Órdenes de trabajo', href: '/ordenes-trabajo', short: 'OT' },
      { label: 'Equipos', href: '/equipos', short: 'EQ' },
      { label: 'Calendario', href: '/calendario', short: 'CA' },
    ],
  },
  {
    title: 'Transporte',
    items: [
      { label: 'Camiones', href: '/admin?modulo=camiones', short: 'CM' },
      { label: 'Conductores', href: '/admin?modulo=conductores', short: 'CD' },
    ],
  },
  {
    title: 'Cumplimiento',
    items: [
      { label: 'Matrices', href: '/matrices', short: 'MX' },
      { label: 'Tipos de actividad', href: '/admin?modulo=actividades', short: 'TA' },
      { label: 'Catálogo de servicios', href: '/admin?modulo=servicios', short: 'CS' },
    ],
  },
  {
    title: 'Personas',
    items: [
      { label: 'Técnicos', href: '/admin?modulo=tecnicos', short: 'TC' },
      { label: 'Mi jornada técnica', href: '/tecnico', short: 'JT', technician: true },
    ],
  },
  {
    title: 'Informes',
    items: [
      { label: 'Visitas históricas', href: '/informes/visitas', short: 'VH' },
      { label: 'Facturación', href: '/informes/facturacion', short: 'IF' },
      { label: 'Maestro histórico', href: '/admin?modulo=visitas', short: 'MH' },
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
  const [commandOpen, setCommandOpen] = useState(false);
  const [recentHrefs, setRecentHrefs] = useState([]);
  const moduleParam = searchParams.get('modulo');
  const currentHref = pathname === '/admin' ? `/admin?modulo=${moduleParam || 'clientes'}` : pathname;
  const isTechnician = user?.rol === 'TECNICO';
  const visibleGroups = useMemo(() => navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => !isTechnician || item.technician || item.href === '/'),
    }))
    .filter((group) => group.items.length), [isTechnician]);
  const commandItems = useMemo(() => visibleGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.title }))), [visibleGroups]);
  const recentItems = useMemo(() => recentHrefs.map((href) => commandItems.find((item) => item.href === href)).filter(Boolean), [commandItems, recentHrefs]);

  useEffect(() => {
    let active = true;

    fetch('/api/auth/session')
      .then((res) => (res.ok ? res.json() : { user: null }))
      .then((data) => {
        if (active) {
          const nextUser = data.user || null;
          setUser(nextUser);
          const key = `cmcing:recent:${nextUser?.id || nextUser?.email || 'session'}`;
          try { setRecentHrefs(JSON.parse(localStorage.getItem(key) || '[]')); } catch { setRecentHrefs([]); }
        }
      })
      .catch(() => {
        if (active) setUser(null);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const openSearch = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener('keydown', openSearch);
    return () => window.removeEventListener('keydown', openSearch);
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  const handleNavigate = () => {
    setMenuOpen(false);
  };

  const rememberNavigation = (item) => {
    const next = [item.href, ...recentHrefs.filter((href) => href !== item.href)].slice(0, 6);
    setRecentHrefs(next);
    try { localStorage.setItem(`cmcing:recent:${user?.id || user?.email || 'session'}`, JSON.stringify(next)); } catch { /* storage may be unavailable */ }
  };

  return (
    <>
      <header className="mobile-topbar">
        <Link href="/" className="mobile-logo" onClick={handleNavigate}>
          <Image src="/brand/logo-cmcing.png" alt="CMCing" width={160} height={60} className="h-9 w-auto object-contain" priority />
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
          <Image src="/brand/logo-cmcing.png" alt="CMCing" width={210} height={78} className="h-12 w-auto object-contain" priority />
        </Link>

        <button type="button" className="sidebar-command" onClick={() => setCommandOpen(true)}>
          <span aria-hidden="true">⌕</span><span>Ir a cualquier parte</span><kbd>Ctrl K</kbd>
        </button>

        <nav className="sidebar-nav">
          {visibleGroups.map((section) => (
            <div key={section.title} className="sidebar-section">
              <p className="sidebar-section-title">{section.title}</p>
              <div className="sidebar-subnav">
                {section.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => { rememberNavigation(item); handleNavigate(); }}
                    aria-current={isActive(pathname, currentHref, item.href) ? 'page' : undefined}
                    className={`sidebar-secondary ${isActive(pathname, currentHref, item.href) ? 'is-active' : ''}`}
                  >
                    <span className="sidebar-link-mark" aria-hidden="true">{item.short || '•'}</span>
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
            <span>{user?.nombre || 'CMCing'}</span>
            <button type="button" onClick={logout}>Salir</button>
          </div>
        </div>
      </aside>
      {commandOpen ? (
        <CommandCenter
          items={commandItems}
          recentItems={recentItems}
          onClose={() => setCommandOpen(false)}
          onNavigate={(item) => { rememberNavigation(item); router.push(item.href); }}
        />
      ) : null}
    </>
  );
}
