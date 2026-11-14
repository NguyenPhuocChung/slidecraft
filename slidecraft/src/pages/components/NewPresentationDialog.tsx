import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ASPECT_RATIOS } from '@/types/registry';
import { THEMES } from '@/themes/themes';
import { createBlankPresentation } from '@/services/projects';
import { Button, Field, Modal, NumberInput, cx, inputCls, toast } from '@/components/ui';
import { tr, useT } from '@/i18n';

export function NewPresentationDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT();
  const nav = useNavigate();
  const [title, setTitle] = useState(() => tr('Untitled presentation'));
  const [theme, setTheme] = useState('modern-corporate');
  const [ratio, setRatio] = useState<string>('16:9');
  const [custom, setCustom] = useState({ width: 1920, height: 1080 });
  const [busy, setBusy] = useState(false);
  const create = async () => {
    setBusy(true);
    try {
      const p = await createBlankPresentation({ title: title.trim() || tr('Untitled presentation'), theme, aspectRatio: ratio, size: ratio === 'custom' ? custom : undefined });
      nav(`/editor/${p.id}`);
    } catch (e) {
      toast.error(tr('Could not create presentation: {msg}', { msg: (e as Error).message }));
    } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('New presentation')} width={720} testId="new-presentation-dialog"
      footer={<><Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" disabled={busy} onClick={() => void create()} data-testid="create-presentation">{t('Create')}</Button></>}>
      <div className="space-y-4">
        <Field label={t('Title')}><input autoFocus className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void create(); }} /></Field>
        <Field label={t('Size')}>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(ASPECT_RATIOS).map(([k, v]) => (
              <button key={k} onClick={() => setRatio(k)} className={cx('rounded-lg border px-3 py-1.5 text-xs', ratio === k ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200' : 'border-ink-200 text-ink-600 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800')}>{t(v.label)}</button>
            ))}
          </div>
          {ratio === 'custom' && (
            <div className="mt-2 flex items-center gap-2 text-xs text-ink-500">
              <NumberInput className="w-28" value={custom.width} min={320} max={7680} onChange={(width) => setCustom({ ...custom, width })} suffix="px" /> ×
              <NumberInput className="w-28" value={custom.height} min={320} max={7680} onChange={(height) => setCustom({ ...custom, height })} suffix="px" />
            </div>
          )}
        </Field>
        <Field label={t('Theme')}>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {THEMES.map((th) => (
              <button key={th.id} title={t(th.description ?? '')} onClick={() => setTheme(th.id)} className={cx('overflow-hidden rounded-lg border text-left transition', theme === th.id ? 'border-brand-500 ring-2 ring-brand-500/30' : 'border-ink-200 hover:border-ink-300 dark:border-ink-700')}>
                <div className="flex h-12 flex-col justify-end gap-1 p-1.5" style={{ background: th.background?.type === 'gradient' ? `linear-gradient(135deg, ${th.background.gradient?.stops.map((s) => s.color).join(',')})` : th.colors.background }}>
                  <div className="h-1.5 w-8 rounded" style={{ background: th.colors.text }} />
                  <div className="flex gap-0.5">{[th.colors.primary, th.colors.accent, th.colors.secondary].map((c) => <span key={c} className="h-2 w-2 rounded-full" style={{ background: c }} />)}</div>
                </div>
                <div className="truncate px-1.5 py-1 text-[10px] text-ink-600 dark:text-ink-300">{t(th.name)}</div>
              </button>
            ))}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
