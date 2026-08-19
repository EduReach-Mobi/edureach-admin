import { type ReactNode, useState } from 'react';
import { Bell, BookOpen, Layers, LayoutDashboard, LogOut, Menu, Search, Users, X } from 'lucide-react';
import type { AuthResponse } from '../types/api';

type View = 'dashboard' | 'resources' | 'students' | 'subjects' | 'levels' | 'notifications';

const navItems: Array<{ id: View; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'resources', label: 'Resources', icon: BookOpen },
  { id: 'students', label: 'Students', icon: Users },
  { id: 'subjects', label: 'Subjects', icon: Search },
  { id: 'levels', label: 'Levels', icon: Layers },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

export function Shell({
  children,
  view,
  onViewChange,
  profile,
  onLogout,
}: {
  children: ReactNode;
  view: View;
  onViewChange: (view: View) => void;
  profile: AuthResponse;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);

  const nav = (
    <nav className="nav-list">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            className={`nav-item ${view === item.id ? 'active' : ''}`}
            onClick={() => {
              onViewChange(item.id);
              setOpen(false);
            }}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="app-shell">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="brand-block">
          <div className="brand-mark">E</div>
          <div>
            <strong>EduReach</strong>
            <span>Admin Console</span>
          </div>
          <button className="icon-btn close-mobile" onClick={() => setOpen(false)} aria-label="Close menu">
            <X size={20} />
          </button>
        </div>
        {nav}
        <div className="sidebar-footer">
          <div className="profile-chip">
            <span>{profile.displayName?.slice(0, 1).toUpperCase() || 'A'}</span>
            <div>
              <strong>{profile.displayName || 'Admin'}</strong>
              <small>{profile.email}</small>
            </div>
          </div>
          <button className="btn ghost full" onClick={onLogout}>
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </aside>
      {open && <button className="scrim" onClick={() => setOpen(false)} aria-label="Close menu" />}
      <main className="main-panel">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <div>
            <span className="eyebrow">Admin Console</span>
            <h1>{navItems.find((item) => item.id === view)?.label}</h1>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

