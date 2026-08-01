import type { ReactNode } from 'react';
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

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900">
      <aside className="flex w-60 flex-col bg-slate-900 text-slate-200">
        <div className="px-5 py-5 text-lg font-semibold tracking-tight text-white">
          PilotMng
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
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
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
