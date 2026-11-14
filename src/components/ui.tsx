import { forwardRef, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import clsx from 'clsx';
import { tr } from '@/i18n';
import { create } from 'zustand';
import { X } from 'lucide-react';

export function cx(...a: Parameters<typeof clsx>) { return clsx(...a); }

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'subtle';
export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode }>(function Button({ variant = 'secondary', size = 'md', icon, className, children, ...rest }, ref) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cx(
        'inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/60 disabled:pointer-events-none disabled:opacity-45',
        size === 'sm' && 'h-7 px-2.5 text-xs', size === 'md' && 'h-8 px-3 text-[13px]', size === 'lg' && 'h-11 px-5 text-sm',
        variant === 'primary' && 'bg-brand-600 text-white shadow-sm hover:bg-brand-700',
        variant === 'secondary' && 'border border-ink-200 bg-white text-ink-800 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-850 dark:text-ink-100 dark:hover:bg-ink-800',
        variant === 'ghost' && 'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white',
        variant === 'subtle' && 'bg-ink-100 text-ink-800 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-100 dark:hover:bg-ink-700',
        variant === 'danger' && 'bg-red-600 text-white hover:bg-red-700',
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
});

export function IconButton({ title, active, className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      title={title}
      aria-label={title}
      {...rest}
      className={cx('inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 disabled:pointer-events-none disabled:opacity-35 dark:text-ink-300 dark:hover:bg-ink-800 dark:hover:text-white', active && 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300', className)}
    >
      {children}
    </button>
  );
}

export function Modal({ open, onClose, title, children, width = 640, footer, testId }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; width?: number; footer?: ReactNode; testId?: string }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink-950/50 p-4 backdrop-blur-[2px]" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} data-testid={testId}>
      <div className="flex max-h-[90vh] w-full flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl dark:border-ink-700 dark:bg-ink-900" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="flex items-center justify-between border-b border-ink-100 px-5 py-3.5 dark:border-ink-800">
          <h2 className="text-[15px] font-semibold text-ink-900 dark:text-white">{title}</h2>
          <IconButton title={tr('Close')} onClick={onClose}><X size={16} /></IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-5 py-4">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-ink-100 px-5 py-3 dark:border-ink-800">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, children, hint, className }: { label: ReactNode; children: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <label className={cx('block', className)}>
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-500 dark:text-ink-400">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}

export const inputCls = 'h-8 w-full rounded-lg border border-ink-200 bg-white px-2.5 text-[13px] text-ink-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-850 dark:text-ink-100';

const roundStep = (v: number, step: number) => { const d = Math.max(0, (String(step).split('.')[1] ?? '').length); return Number(v.toFixed(Math.min(6, d + 2))); };
/** Parse "1,5" / "1.5" / "-2" typed by people using a Vietnamese keyboard. */
function parseTyped(s: string): number {
  const t = s.trim().replace(/\s/g, '').replace(/[°%]|px|ms|s$/gi, '');
  if (/^-?\d+,\d+$/.test(t)) return parseFloat(t.replace(',', '.'));
  return parseFloat(t.replace(/,/g, ''));
}

/**
 * Number box with visible ▲/▼ stepper buttons.
 * Click = ±step · Shift+click = ±10×step · hold the button to repeat ·
 * ↑/↓ keys and the mouse wheel (while focused) also change the value. Respects min/max.
 */
export function NumberInput({ value, onChange, min, max, step = 1, suffix, className, title, testId, ariaLabel }: { value: number | undefined; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; className?: string; title?: string; testId?: string; ariaLabel?: string }) {
  const fmt = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? '' : String(Math.round(v * 1000) / 1000));
  const [draft, setDraft] = useState<string>(fmt(value));
  const [focused, setFocused] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const live = useRef(value);
  live.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval> }>({});
  useEffect(() => { setDraft(fmt(value)); }, [value]);
  const clamp = (v: number) => Math.min(max ?? Infinity, Math.max(min ?? -Infinity, v));
  const commit = () => {
    const v = parseTyped(draft);
    if (Number.isNaN(v)) { setDraft(fmt(value)); return; }
    const c = clamp(v);
    if (c !== value) onChange(c); else setDraft(fmt(value));
  };
  const bump = (dir: 1 | -1, big = false) => {
    const typed = parseTyped(draftRef.current);
    const base = Number.isNaN(typed) ? (live.current ?? 0) : typed;
    const next = clamp(roundStep(base + dir * step * (big ? 10 : 1), step));
    live.current = next;
    draftRef.current = fmt(next);
    setDraft(fmt(next));
    onChangeRef.current(next);
  };
  const stopRepeat = () => { clearTimeout(timer.current.t); clearInterval(timer.current.i); timer.current = {}; };
  useEffect(() => stopRepeat, []);
  const startRepeat = (dir: 1 | -1, big: boolean) => {
    stopRepeat();
    bump(dir, big);
    timer.current.t = setTimeout(() => { timer.current.i = setInterval(() => bump(dir, big), 70); }, 380);
  };
  // Wheel only while the box has focus (so scrolling the panel never changes values by accident).
  useEffect(() => {
    const el = input.current;
    if (!el || !focused) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); bump(e.deltaY < 0 ? 1 : -1, e.shiftKey); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }); // eslint-disable-line react-hooks/exhaustive-deps
  const atMax = max !== undefined && (value ?? -Infinity) >= max;
  const atMin = min !== undefined && (value ?? Infinity) <= min;
  const stepBtn = 'flex h-1/2 w-5 items-center justify-center text-ink-400 hover:bg-ink-100 hover:text-ink-800 active:bg-brand-100 disabled:opacity-30 dark:hover:bg-ink-700 dark:hover:text-white';
  const hint = tr('Click ▲/▼ to change by {step} (Shift = ×10). Hold to repeat. Mouse wheel works while the box is selected.', { step });
  return (
    <div className={cx('relative', className)} title={title ? `${title} — ${hint}` : hint} data-testid={testId} data-number-input>
      <input ref={input} aria-label={ariaLabel ?? title} className={cx(inputCls, 'pr-6', suffix && 'pr-11')} value={draft} inputMode="decimal"
        onChange={(e) => setDraft(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => { setFocused(false); commit(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(fmt(value));
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); bump(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey); }
        }} />
      {suffix && <span className="pointer-events-none absolute right-6 top-1/2 -translate-y-1/2 text-[11px] text-ink-400">{suffix}</span>}
      <div className="absolute inset-y-px right-px flex w-5 flex-col overflow-hidden rounded-r-[7px] border-l border-ink-200 dark:border-ink-700">
        <button type="button" tabIndex={-1} aria-label={tr('Increase')} data-step="up" disabled={atMax} className={stepBtn}
          onPointerDown={(e) => { e.preventDefault(); startRepeat(1, e.shiftKey); }} onPointerUp={stopRepeat} onPointerLeave={stopRepeat} onPointerCancel={stopRepeat}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') bump(1, e.shiftKey); }}>
          <svg width="8" height="5" viewBox="0 0 8 5" aria-hidden><path d="M0 5 L4 0 L8 5 Z" fill="currentColor" /></svg>
        </button>
        <button type="button" tabIndex={-1} aria-label={tr('Decrease')} data-step="down" disabled={atMin} className={cx(stepBtn, 'border-t border-ink-200 dark:border-ink-700')}
          onPointerDown={(e) => { e.preventDefault(); startRepeat(-1, e.shiftKey); }} onPointerUp={stopRepeat} onPointerLeave={stopRepeat} onPointerCancel={stopRepeat}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') bump(-1, e.shiftKey); }}>
          <svg width="8" height="5" viewBox="0 0 8 5" aria-hidden><path d="M0 0 L8 0 L4 5 Z" fill="currentColor" /></svg>
        </button>
      </div>
    </div>
  );
}

export function Select<T extends string>({ value, onChange, options, className, testId }: { value: T | undefined; onChange: (v: T) => void; options: { value: T; label: string }[]; className?: string; testId?: string }) {
  return (
    <select className={cx(inputCls, 'pr-6', className)} value={value ?? ''} onChange={(e) => onChange(e.target.value as T)} data-testid={testId}>
      {value === undefined && <option value="">—</option>}
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-700 dark:text-ink-200">
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={cx('relative h-[18px] w-8 rounded-full transition-colors', checked ? 'bg-brand-600' : 'bg-ink-300 dark:bg-ink-700')}>
        <span className={cx('absolute left-0 top-[2px] h-[14px] w-[14px] rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[16px]' : 'translate-x-[2px]')} />
      </button>
      {label}
    </label>
  );
}

export function Tabs<T extends string>({ value, onChange, tabs, className }: { value: T; onChange: (v: T) => void; tabs: { id: T; label: ReactNode; title?: string }[]; className?: string }) {
  return (
    <div className={cx('flex gap-0.5 rounded-lg bg-ink-100 p-0.5 dark:bg-ink-850', className)}>
      {tabs.map((t) => (
        <button key={t.id} title={t.title} onClick={() => onChange(t.id)} className={cx('flex-1 rounded-md px-2 py-1 text-[12px] font-medium transition', value === t.id ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-700 dark:text-white' : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100')} data-testid={`tab-${t.id}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Section({ title, children, actions, defaultOpen = true }: { title: ReactNode; children: ReactNode; actions?: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-ink-100 px-4 py-3 dark:border-ink-800">
      <div className="mb-2 flex items-center justify-between">
        <button className="text-[11px] font-semibold uppercase tracking-wider text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100" onClick={() => setOpen(!open)}>{title}</button>
        {actions}
      </div>
      {open && <div className="space-y-2.5">{children}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'neutral', className }: { children: ReactNode; tone?: 'neutral' | 'green' | 'amber' | 'red' | 'brand' | 'blue'; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium', {
      neutral: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300', green: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
      amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300', red: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
      brand: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300', blue: 'bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300',
    }[tone], className)}>{children}</span>
  );
}

/* ------------------------------- Toasts ------------------------------- */
interface Toast { id: number; kind: 'success' | 'error' | 'info' | 'warning'; text: string }
export const useToasts = create<{ items: Toast[]; push: (kind: Toast['kind'], text: string) => void; remove: (id: number) => void }>((set) => ({
  items: [],
  push: (kind, text) => { const id = Date.now() + Math.random(); set((s) => ({ items: [...s.items, { id, kind, text }] })); setTimeout(() => set((s) => ({ items: s.items.filter((t) => t.id !== id) })), kind === 'error' ? 7000 : 3500); },
  remove: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));
export const toast = {
  success: (t: string) => useToasts.getState().push('success', t),
  error: (t: string) => useToasts.getState().push('error', t),
  info: (t: string) => useToasts.getState().push('info', t),
  warning: (t: string) => useToasts.getState().push('warning', t),
};
export function Toaster() {
  const items = useToasts((s) => s.items);
  const remove = useToasts((s) => s.remove);
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[360px] flex-col gap-2">
      {items.map((t) => (
        <div key={t.id} role="status" className={cx('pointer-events-auto flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[13px] shadow-lg backdrop-blur', {
          success: 'border-emerald-200 bg-emerald-50/95 text-emerald-900 dark:border-emerald-500/30 dark:bg-emerald-950/90 dark:text-emerald-100',
          error: 'border-red-200 bg-red-50/95 text-red-900 dark:border-red-500/30 dark:bg-red-950/90 dark:text-red-100',
          warning: 'border-amber-200 bg-amber-50/95 text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/90 dark:text-amber-100',
          info: 'border-ink-200 bg-white/95 text-ink-800 dark:border-ink-700 dark:bg-ink-900/95 dark:text-ink-100',
        }[t.kind])} data-testid={`toast-${t.kind}`}>
          <span className="flex-1">{t.text}</span>
          <button className="opacity-50 hover:opacity-100" onClick={() => remove(t.id)} aria-label={tr('Close')}><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}

export function useOutsideClick(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) cbRef.current(); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [ref]);
}

/**
 * Popover rendered in a portal with fixed positioning, so it is never clipped by
 * scrolling/overflow containers (e.g. the horizontally scrollable Insert toolbar).
 */
export function Popover({ trigger, children, align = 'left', width = 260 }: { trigger: (open: boolean, toggle: () => void) => ReactNode; children: (close: () => void) => ReactNode; align?: 'left' | 'right'; width?: number }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number; maxH: number } | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const place = () => {
    const r = anchor.current?.getBoundingClientRect();
    if (!r) return;
    const vw = window.innerWidth, vh = window.innerHeight;
    let left = align === 'right' ? r.right - width : r.left;
    left = Math.max(8, Math.min(left, vw - width - 8));
    const below = vh - r.bottom - 12;
    const top = below >= 220 || below >= r.top ? r.bottom + 4 : Math.max(8, r.top - 4 - Math.min(r.top - 12, 480));
    setPos({ left, top, maxH: Math.max(160, below >= 220 || below >= r.top ? below : r.top - 12) });
  };
  useEffect(() => {
    if (!open) return;
    place();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchor.current?.contains(t) || panel.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    const onMove = () => place();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onMove);
    window.addEventListener('scroll', onMove, true);
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey); window.removeEventListener('resize', onMove); window.removeEventListener('scroll', onMove, true); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="relative" ref={anchor}>
      {trigger(open, () => setOpen((o) => !o))}
      {open && pos && createPortal(
        <div ref={panel} data-popover className="fixed z-[210] overflow-y-auto rounded-xl border border-ink-200 bg-white p-1.5 shadow-xl dark:border-ink-700 dark:bg-ink-900" style={{ left: pos.left, top: pos.top, width, maxHeight: pos.maxH }}>
          {children(() => setOpen(false))}
        </div>,
        document.body,
      )}
    </div>
  );
}

export function MenuButton({ children, onClick, icon, shortcut, disabled, danger, testId }: { children: ReactNode; onClick: () => void; icon?: ReactNode; shortcut?: string; disabled?: boolean; danger?: boolean; testId?: string }) {
  return (
    <button disabled={disabled} onClick={onClick} data-testid={testId} className={cx('flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] hover:bg-ink-100 disabled:opacity-40 dark:hover:bg-ink-800', danger ? 'text-red-600' : 'text-ink-800 dark:text-ink-100')}>
      {icon && <span className="w-4 text-ink-500">{icon}</span>}
      <span className="flex-1">{children}</span>
      {shortcut && <span className="text-[11px] text-ink-400">{shortcut}</span>}
    </button>
  );
}
