import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { LogIn, LogOut, Moon, Sun, User } from 'lucide-react';
import { useUiTheme } from '@/hooks/useUiTheme';
import { api, auth } from '@/services/api';
import { MenuButton, Popover, cx } from './ui';
import { LanguageSwitch } from './LanguageSwitch';
import { DonateButton } from './DonateButton';
import { useT } from '@/i18n';

export function Logo({ small }: { small?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2" aria-label="SlideCraft">
      <svg viewBox="0 0 64 64" className={small ? 'h-7 w-7' : 'h-8 w-8'} aria-hidden>
        <defs><linearGradient id="sc-logo" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#6366f1" /><stop offset="1" stopColor="#db2777" /></linearGradient></defs>
        <rect width="64" height="64" rx="16" fill="url(#sc-logo)" />
        <rect x="14" y="18" width="36" height="24" rx="4" fill="#fff" opacity=".95" />
        <rect x="20" y="24" width="16" height="4" rx="2" fill="#6366f1" />
        <rect x="20" y="31" width="24" height="3" rx="1.5" fill="#c7d2fe" />
        <path d="M32 42v8M24 50h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="text-[15px] font-semibold tracking-tight text-ink-900 dark:text-white">SlideCraft <span className="font-normal text-ink-400">AI Studio</span></span>
    </Link>
  );
}

export interface CurrentUser { id: string; email: string; name?: string }
let cachedUser: CurrentUser | null | undefined;
export function useCurrentUser(): [CurrentUser | null, (u: CurrentUser | null) => void] {
  const [user, setUser] = useState<CurrentUser | null>(cachedUser ?? null);
  useEffect(() => {
    if (cachedUser !== undefined || !auth.token) return;
    api.get<{ user: CurrentUser }>('/auth/me').then((r) => { cachedUser = r.user; setUser(r.user); }).catch(() => { cachedUser = null; });
  }, []);
  return [user, (u) => { cachedUser = u; setUser(u); }];
}

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/import', label: 'Import AI Code' },
  { to: '/prompts', label: 'Prompt Center' },
  { to: '/docs', label: 'Docs' },
];

export function AppHeader() {
  const t = useT();
  const { mode, toggle } = useUiTheme();
  const [user, setUser] = useCurrentUser();
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-40 border-b border-ink-100 bg-white/85 backdrop-blur dark:border-ink-800 dark:bg-ink-950/85">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-5">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => cx('rounded-lg px-3 py-1.5 text-[13px] font-medium transition', isActive ? 'bg-ink-100 text-ink-900 dark:bg-ink-800 dark:text-white' : 'text-ink-500 hover:text-ink-900 dark:text-ink-400 dark:hover:text-white')}>{t(n.label)}</NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <DonateButton />
          <LanguageSwitch />
          <button onClick={toggle} title={mode === 'dark' ? t('Light mode') : t('Dark mode')} className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800" data-testid="theme-toggle">
            {mode === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          {user ? (
            <Popover align="right" width={220} trigger={(_o, toggleMenu) => (
              <button onClick={toggleMenu} className="flex h-8 items-center gap-2 rounded-lg px-2 text-[13px] text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">{(user.name ?? user.email)[0]?.toUpperCase()}</span>
                <span className="hidden max-w-[140px] truncate sm:inline">{user.name ?? user.email}</span>
              </button>
            )}>
              {(close) => (
                <div>
                  <div className="px-2.5 py-1.5 text-[11px] text-ink-400">{user.email}</div>
                  <MenuButton icon={<User size={14} />} onClick={() => { close(); nav('/dashboard'); }}>{t('My presentations')}</MenuButton>
                  <MenuButton icon={<LogOut size={14} />} onClick={() => { auth.token = null; setUser(null); close(); }}>{t('Sign out')}</MenuButton>
                </div>
              )}
            </Popover>
          ) : (
            <Link to="/login" className="flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-ink-700 hover:bg-ink-100 dark:text-ink-200 dark:hover:bg-ink-800"><LogIn size={14} />{t('Sign in')}</Link>
          )}
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-ink-100 px-4 py-1.5 md:hidden dark:border-ink-800">
        {NAV.map((n) => <NavLink key={n.to} to={n.to} className="whitespace-nowrap rounded-md px-2.5 py-1 text-xs text-ink-600 dark:text-ink-300">{t(n.label)}</NavLink>)}
      </nav>
    </header>
  );
}

export function PageShell({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="min-h-full bg-white dark:bg-ink-950">
      <AppHeader />
      <main className={cx('mx-auto px-5 pb-20', wide ? 'max-w-[1600px]' : 'max-w-7xl')}>{children}</main>
    </div>
  );
}
