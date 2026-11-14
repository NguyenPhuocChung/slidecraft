import { useState } from 'react';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Hammer, Info, Loader2, Presentation as PresentationIcon, X } from 'lucide-react';
import { trPptx, type PptxImportOutcome } from '@/services/pptxImport';
import { Badge, Button, cx } from '@/components/ui';
import { LazyThumb } from '@/editor/SlidesPanel';
import { useT } from '@/i18n';

export function PptxProgress({ label, progress, fileName }: { label: string; progress: number; fileName: string }) {
  const t = useT();
  return (
    <div className="flex flex-1 items-center justify-center p-8" data-testid="pptx-progress">
      <div className="w-full max-w-md rounded-2xl border border-ink-100 p-6 text-center dark:border-ink-800">
        <Loader2 className="mx-auto mb-3 animate-spin text-brand-500" size={28} />
        <div className="font-medium text-ink-900 dark:text-white">{t('Reading PowerPoint file…')}</div>
        <div className="mt-1 truncate text-xs text-ink-500">{fileName}</div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        <div className="mt-2 text-xs tabular-nums text-ink-500">{(() => { const m = /(\d+)\/(\d+)/.exec(label); return m ? t('Slide {a} of {b}', { a: m[1], b: m[2] }) : ''; })()} · {Math.round(progress * 100)}%</div>
      </div>
    </div>
  );
}

export function PptxPanel({ outcome, building, onBuild, onCancel }: { outcome: PptxImportOutcome; building: boolean; onBuild: () => void; onCancel: () => void }) {
  const t = useT();
  const { presentation: p, report } = outcome;
  const [showInfo, setShowInfo] = useState(false);
  const stats: [string, number][] = [['Slides', report.stats.slides], ['Objects', report.stats.elements], ['Images', report.stats.images], ['Charts', report.stats.charts], ['Tables', report.stats.tables], ['Groups', report.stats.groups], ['Notes', report.stats.notes]];
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.2fr)]" data-testid="pptx-panel">
      <div className="min-h-0 space-y-4 overflow-y-auto border-r border-ink-100 p-4 dark:border-ink-800">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-500/30 dark:bg-emerald-500/10" data-testid="pptx-status">
          <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={20} />
          <div className="min-w-0 flex-1 text-sm">
            <div className="font-medium text-ink-900 dark:text-white">{t('PowerPoint file read — ready to build')}</div>
            <div className="truncate text-xs text-ink-500"><PresentationIcon size={12} className="mr-1 inline" />{outcome.fileName} · {p.aspectRatio === 'custom' ? `${p.size.width}×${p.size.height}` : p.aspectRatio} · {t('{n} warnings', { n: report.warnings.length })}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" className="flex-1" icon={building ? <Loader2 size={14} className="animate-spin" /> : <Hammer size={14} />} disabled={building} onClick={onBuild} data-testid="pptx-build">{t('Open in editor')}</Button>
          <Button icon={<X size={14} />} onClick={onCancel} data-testid="pptx-cancel">{t('Cancel')}</Button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {stats.map(([k, v]) => (
            <div key={k} className="rounded-xl border border-ink-100 p-2.5 dark:border-ink-800" data-testid={`pptx-stat-${k.toLowerCase()}`}>
              <div className="text-lg font-semibold tabular-nums text-ink-900 dark:text-white">{v}</div>
              <div className="text-[11px] text-ink-500">{t(k)}</div>
            </div>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-ink-500">{t('Every text box, shape, picture, table and chart becomes an editable SlideCraft object. Check the list below for anything that was approximated.')}</p>
        {report.warnings.length > 0 && (
          <div>
            <h3 className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{t('Needs attention')} <Badge tone="amber">{report.warnings.length}</Badge></h3>
            <ul className="space-y-1" data-testid="pptx-warnings">
              {report.warnings.slice(0, 200).map((w, i) => <li key={i} className="flex gap-2 rounded-lg px-2 py-1.5 text-[13px] text-ink-800 dark:text-ink-100"><AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />{trPptx(w)}</li>)}
            </ul>
          </div>
        )}
        {report.info.length > 0 && (
          <div>
            <button className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ink-500" onClick={() => setShowInfo(!showInfo)}>{t('Notes')} <Badge tone="blue">{report.info.length}</Badge></button>
            {showInfo && <ul className="space-y-1">{report.info.map((w, i) => <li key={i} className="flex gap-2 rounded-lg px-2 py-1 text-[13px] text-ink-600 dark:text-ink-300"><Info size={14} className="mt-0.5 shrink-0 text-sky-600" />{trPptx(w)}</li>)}</ul>}
          </div>
        )}
        <div className="rounded-xl bg-ink-50 p-3 text-[12px] leading-relaxed text-ink-500 dark:bg-ink-900">
          <FileSpreadsheet size={14} className="mb-1 text-ink-400" />
          {t('Tip: fonts that are not installed on this computer are replaced by similar fonts. Old .ppt files must first be saved as .pptx in PowerPoint.')}
        </div>
      </div>
      <div className="min-h-0 overflow-y-auto p-4">
        <div className={cx('grid gap-3', p.slides.length > 1 ? 'grid-cols-2 xl:grid-cols-3' : 'grid-cols-1')} data-testid="pptx-preview">
          {p.slides.map((s, i) => (
            <div key={s.id}>
              <div className="overflow-hidden rounded-lg ring-1 ring-ink-200 dark:ring-ink-700"><LazyThumb slide={s} presentation={p} width={300} index={i} /></div>
              <div className="mt-1 truncate text-[11px] text-ink-500">{i + 1}. {s.title ?? s.id}{s.hidden ? ` · ${t('hidden')}` : ''}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
