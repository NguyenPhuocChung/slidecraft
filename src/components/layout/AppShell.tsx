import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  Plus,
  Presentation,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/stores/projectStore';

const nav = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/projects', label: 'My Projects', icon: FolderOpen },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell() {
  const navigate = useNavigate();
  const createProject = useProjectStore((s) => s.createProject);

  const handleNew = () => {
    const p = createProject('Untitled Presentation');
    navigate(`/workspace/${p.id}`);
  };

  return (
    <div className="flex h-full min-h-screen bg-bg-primary">
      <aside className="flex w-60 flex-col border-r border-border bg-bg-secondary">
        <div className="flex h-14 items-center gap-2 border-b border-border px-4">
          <Presentation className="h-5 w-5 text-primary" />
          <span className="font-display text-sm font-semibold tracking-tight">
            SlideCraft AI
          </span>
        </div>

        <div className="p-3">
          <button
            type="button"
            onClick={handleNew}
            className="btn-primary w-full"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-2">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-bg-tertiary text-text-primary'
                    : 'text-text-secondary hover:bg-bg-tertiary hover:text-text-primary',
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-border p-3 text-xs text-text-muted">
          Local storage · v0.1
        </div>
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}
