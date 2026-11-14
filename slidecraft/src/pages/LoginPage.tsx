import { useEffect, useState } from 'react';
import { tr, useT } from '@/i18n';
import { LanguageSwitch } from '@/components/LanguageSwitch';
import { useNavigate } from 'react-router-dom';
import { CloudOff } from 'lucide-react';
import { Logo } from '@/components/AppHeader';
import { Button, Field, Tabs, inputCls, toast } from '@/components/ui';
import { api, apiAvailable, auth, ApiError } from '@/services/api';

export default function LoginPage() {
  const t = useT();
  const nav = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  useEffect(() => { void apiAvailable().then(setOnline); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const r = await api.post<{ token: string; user: { email: string; name?: string } }>(mode === 'login' ? '/auth/login' : '/auth/register', mode === 'login' ? { email, password } : { email, password, name });
      auth.token = r.token;
      toast.success(r.user.name ? tr('Welcome, {name}!', { name: r.user.name }) : tr('Welcome!'));
      nav('/dashboard');
      location.reload();
    } catch (err) {
      const status = (err as ApiError).status;
      setError(status === 401 ? tr('Wrong email or password.') : status === 409 ? tr('An account with this email already exists.') : status === 400 ? tr('Please check the fields (password needs at least 8 characters).') : (err as Error).message);
    } finally { setBusy(false); }
  };
  return (
    <div className="flex min-h-full items-center justify-center bg-ink-50 px-4 py-16 dark:bg-ink-950">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-3"><Logo /><LanguageSwitch compact /></div>
        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-panel dark:border-ink-800 dark:bg-ink-900">
          <Tabs value={mode} onChange={setMode} tabs={[{ id: 'login', label: t('Sign in') }, { id: 'register', label: t('Create account') }]} />
          {online === false && (
            <div className="mt-4 flex gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <CloudOff size={14} className="mt-0.5 shrink-0" />{t('Cloud features unavailable; you can keep working locally — everything is saved in this browser.')}
            </div>
          )}
          <form className="mt-4 space-y-3" onSubmit={(e) => void submit(e)}>
            {mode === 'register' && <Field label={t('Name')}><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" /></Field>}
            <Field label={t('Email')}><input type="email" required className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" data-testid="login-email" /></Field>
            <Field label={t('Password')}><input type="password" required minLength={mode === 'register' ? 8 : 1} className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} data-testid="login-password" /></Field>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <Button type="submit" variant="primary" className="w-full" disabled={busy || online === false} data-testid="login-submit">{mode === 'login' ? t('Sign in') : t('Create account')}</Button>
          </form>
          <button className="mt-4 w-full text-center text-xs text-ink-500 hover:underline" onClick={() => nav('/dashboard')}>{t('Continue without an account')}</button>
        </div>
      </div>
    </div>
  );
}
