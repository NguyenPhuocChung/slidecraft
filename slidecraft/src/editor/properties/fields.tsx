import { useState, type ReactNode } from 'react';
import { tr } from '@/i18n';
import type { Gradient, Theme } from '@/types/schema';
import { THEME_TOKENS, resolveColor } from '@/themes/themes';
import { parseColor, toHex6 } from '@/utils/color';
import { Popover, cx, inputCls } from '@/components/ui';

export function ColorField({ value, onChange, theme, allowNone, label }: { value: string | undefined; onChange: (v: string | undefined) => void; theme: Theme; allowNone?: boolean; label?: string }) {
  const resolved = resolveColor(value, theme, 'transparent');
  const [hex, setHex] = useState('');
  const alpha = parseColor(resolved)?.a ?? 1;
  return (
    <Popover width={236} trigger={(_open, toggle) => (
      <button type="button" onClick={toggle} className={cx(inputCls, 'flex items-center gap-2')} title={label} data-keep-editing>
        <span className="h-4 w-4 shrink-0 rounded border border-black/10" style={{ background: value ? resolved : 'repeating-conic-gradient(#ddd 0 25%, #fff 0 50%) 0 0/8px 8px' }} />
        <span className="truncate text-xs">{value ?? tr('None')}</span>
      </button>
    )}>
      {(close) => (
        <div className="space-y-2 p-1" data-keep-editing>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{tr('Theme colors')}</div>
          <div className="grid grid-cols-6 gap-1.5">
            {THEME_TOKENS.map((t) => {
              const c = resolveColor(`$${t}`, theme, 'transparent');
              return <button key={t} title={`$${t}`} onClick={() => { onChange(`$${t}`); close(); }} className={cx('h-7 rounded-md border border-black/10', value === `$${t}` && 'ring-2 ring-brand-500')} style={{ background: c }} />;
            })}
            {theme.colors.chart.slice(0, 6).map((c, i) => <button key={i} title={`$chart${i + 1}`} onClick={() => { onChange(`$chart${i + 1}`); close(); }} className={cx('h-7 rounded-md border border-black/10', value === `$chart${i + 1}` && 'ring-2 ring-brand-500')} style={{ background: c }} />)}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{tr('Custom')}</div>
          <div className="flex gap-1.5">
            <input type="color" className="h-8 w-10 cursor-pointer rounded border border-ink-200 bg-transparent" value={`#${toHex6(resolved, '000000')}`} onChange={(e) => onChange(alpha < 1 ? `${e.target.value}${Math.round(alpha * 255).toString(16).padStart(2, '0')}` : e.target.value)} />
            <input className={inputCls} placeholder={tr('#RRGGBB or rgba()')} value={hex} onChange={(e) => setHex(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && parseColor(hex)) { onChange(hex); close(); } }} />
          </div>
          <label className="flex items-center gap-2 text-[11px] text-ink-500">{tr('Opacity')}
            <input type="range" min={0} max={1} step={0.05} value={alpha} className="flex-1" onChange={(e) => { const c = parseColor(resolved) ?? { r: 0, g: 0, b: 0 }; onChange(`rgba(${c.r},${c.g},${c.b},${e.target.value})`); }} />
          </label>
          {allowNone && <button className="w-full rounded-md border border-ink-200 py-1 text-xs hover:bg-ink-50 dark:border-ink-700 dark:hover:bg-ink-800" onClick={() => { onChange(undefined); close(); }}>{tr('No color')}</button>}
        </div>
      )}
    </Popover>
  );
}

export function GradientField({ value, onChange, theme }: { value: Gradient | undefined; onChange: (g: Gradient | undefined) => void; theme: Theme }) {
  if (!value) return <button className="text-xs text-brand-600 hover:underline" onClick={() => onChange({ type: 'linear', angle: 45, stops: [{ color: '$primary', offset: 0 }, { color: '$accent', offset: 1 }] })}>{tr('+ Add gradient')}</button>;
  return (
    <div className="space-y-1.5 rounded-lg border border-ink-100 p-2 dark:border-ink-800">
      <div className="flex gap-1.5">
        <select className={cx(inputCls, 'h-7 text-xs')} value={value.type} onChange={(e) => onChange({ ...value, type: e.target.value as 'linear' | 'radial' })}><option value="linear">{tr('Linear')}</option><option value="radial">{tr('Radial')}</option></select>
        {value.type === 'linear' && <input type="number" className={cx(inputCls, 'h-7 w-20 text-xs')} value={value.angle ?? 0} onChange={(e) => onChange({ ...value, angle: Number(e.target.value) })} title={tr('Angle °')} />}
        <button className="text-xs text-red-600" onClick={() => onChange(undefined)}>{tr('Remove')}</button>
      </div>
      {value.stops.map((s, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="flex-1"><ColorField value={s.color} theme={theme} onChange={(c) => onChange({ ...value, stops: value.stops.map((x, j) => (j === i ? { ...x, color: c ?? '#000000' } : x)) })} /></div>
          <input type="number" min={0} max={100} className={cx(inputCls, 'h-7 w-16 text-xs')} value={Math.round(s.offset * 100)} onChange={(e) => onChange({ ...value, stops: value.stops.map((x, j) => (j === i ? { ...x, offset: Math.max(0, Math.min(100, Number(e.target.value))) / 100 } : x)) })} title={tr('Position %')} />
        </div>
      ))}
    </div>
  );
}

export function Row({ children, cols = 2 }: { children: ReactNode; cols?: number }) {
  return <div className={cx('grid gap-2', cols === 2 && 'grid-cols-2', cols === 3 && 'grid-cols-3', cols === 4 && 'grid-cols-4')}>{children}</div>;
}

export function Seg<T extends string>({ value, options, onChange }: { value: T | undefined; options: { value: T; label: ReactNode; title?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-lg border border-ink-200 p-0.5 dark:border-ink-700">
      {options.map((o) => (
        <button key={o.value} title={o.title} data-keep-editing onMouseDown={(e) => e.preventDefault()} onClick={() => onChange(o.value)} className={cx('flex h-6 flex-1 items-center justify-center rounded-md text-xs', value === o.value ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800')}>{o.label}</button>
      ))}
    </div>
  );
}

export const FONT_CHOICES = ['$heading', '$body', 'Inter', 'Be Vietnam Pro', 'Montserrat', 'Poppins', 'Space Grotesk', 'IBM Plex Sans', 'Nunito Sans', 'Roboto', 'Roboto Slab', 'Source Sans 3', 'Source Serif 4', 'Playfair Display', 'DM Serif Display', 'Lora', 'Bebas Neue', 'JetBrains Mono', 'Arial', 'Georgia', 'Calibri'];
