import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/', label: 'Tableau de bord', end: true },
  { to: '/company', label: 'Ma société' },
  { to: '/clients', label: 'Clients' },
  { to: '/projects', label: 'Projets' },
  { to: '/intermediaries', label: 'Intermédiaires' },
  { to: '/resources', label: 'Ressources' },
  { to: '/timesheets', label: 'CRA' },
  { to: '/invoices', label: 'Factures' },
  { to: '/team', label: 'Équipe' },
];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 md:flex-row">
      <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white md:hidden">
        <span className="text-lg font-semibold tracking-tight">PilotMng</span>
        <button
          onClick={() => setMenuOpen((open) => !open)}
          aria-label="Ouvrir le menu"
          className="rounded-md p-2 hover:bg-slate-800"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {menuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </header>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 md:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-slate-900 text-slate-200 transition-transform duration-200 ease-in-out md:static md:z-auto md:flex md:translate-x-0 ${
          menuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="px-5 py-5 text-lg font-semibold tracking-tight text-white">
          PilotMng
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-slate-800 px-3 py-4">
          <p className="truncate px-3 text-sm font-medium text-white">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="truncate px-3 text-xs text-slate-400">{user?.role}</p>
          <button
            onClick={logout}
            className="mt-2 w-full rounded-md px-3 py-2 text-left text-sm text-slate-300 hover:bg-slate-800 hover:text-white"
          >
            Se déconnecter
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8">{children}</div>
      </main>
    </div>
  );
}
