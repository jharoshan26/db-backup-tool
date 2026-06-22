import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/cn';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  permission?: string;
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/servers', label: 'Servers', icon: '🖧' },
  { to: '/backups', label: 'Backups', icon: '🛢' },
  { to: '/jobs', label: 'Jobs', icon: '⚙' },
  { to: '/schedules', label: 'Schedules', icon: '🕑' },
  { to: '/import-export', label: 'Import / Export', icon: '⇄' },
  { to: '/audit', label: 'Audit Log', icon: '☰', permission: 'audit:read' },
  { to: '/users', label: 'Users & Roles', icon: '👤', permission: 'user:manage' },
];

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const items = NAV.filter((item) => !item.permission || hasPermission(item.permission));

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={onClose} aria-hidden />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-slate-100 px-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            DB
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-slate-900">Backup Console</p>
            <p className="text-[11px] text-slate-400">Enterprise Edition</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                )
              }
            >
              <span className="w-5 text-center text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 px-5 py-4 text-[11px] text-slate-400">
          v1.0.0 · API /api/v1
        </div>
      </aside>
    </>
  );
}
