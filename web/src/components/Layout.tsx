import { Link, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

function NavLink({ to, label }: { to: string; label: string }) {
  const { pathname } = useLocation();
  const active = pathname === to;
  return (
    <Link
      to={to}
      className={`px-3 py-2 rounded-lg text-sm font-medium ${
        active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {label}
    </Link>
  );
}

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center gap-2">
          <span className="font-bold text-slate-800 mr-4">Jobs4UAE Autopilot</span>
          <nav aria-label="Main" className="flex gap-2">
            <NavLink to="/" label="Home" />
            <NavLink to="/profile" label="My Profile" />
            <NavLink to="/evaluate" label="Evaluate Jobs" />
            <NavLink to="/documents" label="Documents" />
            <NavLink to="/tracker" label="Tracker" />
            <NavLink to="/scan" label="Find Jobs" />
          </nav>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
