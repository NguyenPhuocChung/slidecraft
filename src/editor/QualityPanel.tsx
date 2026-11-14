import { useMemo, useState } from 'react';
import { tr, trMsg } from '@/i18n';
import { ShieldCheck } from 'lucide-react';
import { useEditor } from '@/stores/editor';
import { checkPresentation } from '@/quality/checker';
import { Badge, Button, cx } from '@/components/ui';

/** Presentation Quality Checker: score /100 with specific suggestions. Never modifies slides. */
export function QualityPanel() {
  const doc = useEditor((s) => s.doc)!;
  const currentSlideId = useEditor((s) => s.currentSlideId);
  const [scope, setScope] = useState<'all' | 'slide'>('all');
  const [stamp, setStamp] = useState(0);
  const report = useMemo(() => checkPresentation(doc), [doc, stamp]); // eslint-disable-line react-hooks/exhaustive-deps
  const st = useEditor.getState;
  const issues = report.issues.filter((i) => scope === 'all' || i.slideId === currentSlideId);
  const tone = report.score >= 85 ? 'text-emerald-600' : report.score >= 70 ? 'text-amber-600' : 'text-red-600';
  return (
    <div className="pb-10" data-testid="quality-panel">
      <div className="flex items-center gap-4 border-b border-ink-100 px-4 py-4 dark:border-ink-800">
        <div className={cx('text-4xl font-bold tabular-nums', tone)} data-testid="quality-score">{report.score}</div>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 text-sm font-semibold"><ShieldCheck size={15} />{tr('Quality score')} <Badge>{report.grade}</Badge></div>
          <div className="text-[11px] text-ink-500">{tr('{n} suggestions · nothing changes until you edit', { n: report.issues.length })}</div>
        </div>
        <Button size="sm" onClick={() => setStamp((n) => n + 1)}>{tr('Re-check')}</Button>
      </div>
      <div className="space-y-1.5 border-b border-ink-100 px-4 py-3 dark:border-ink-800">
        {report.categories.map((c) => (
          <div key={c.category} className="text-xs">
            <div className="mb-0.5 flex justify-between"><span>{tr(c.label)}</span><span className="tabular-nums text-ink-500">{c.score}/{c.max}</span></div>
            <div className="h-1.5 rounded-full bg-ink-100 dark:bg-ink-800"><div className={cx('h-1.5 rounded-full', c.score / c.max >= 0.85 ? 'bg-emerald-500' : c.score / c.max >= 0.6 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${(c.score / c.max) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="flex gap-1 px-4 pt-3">
        <Button size="sm" variant={scope === 'all' ? 'primary' : 'secondary'} onClick={() => setScope('all')}>{tr('All slides')}</Button>
        <Button size="sm" variant={scope === 'slide' ? 'primary' : 'secondary'} onClick={() => setScope('slide')}>{tr('This slide')}</Button>
      </div>
      <div className="space-y-2 px-4 py-3">
        {!issues.length && <p className="text-xs text-ink-400">{scope === 'slide' ? tr('No issues found on this slide.') : tr('No issues found.')} 🎉</p>}
        {issues.map((i, k) => (
          <button key={k} onClick={() => { st().selectSlide(i.slideId); if (i.elementId) st().select([i.elementId]); }} className="block w-full rounded-lg border border-ink-100 p-2.5 text-left hover:border-brand-300 dark:border-ink-800" data-testid="quality-issue">
            <div className="mb-1 flex items-center gap-1.5">
              <Badge tone={i.severity === 'high' ? 'red' : i.severity === 'medium' ? 'amber' : 'neutral'}>{tr(i.severity)}</Badge>
              <Badge>{tr('Slide {n}', { n: i.slideIndex + 1 })}</Badge>
              <span className="text-[10px] uppercase tracking-wide text-ink-400">{tr(i.category)}</span>
            </div>
            <div className="text-xs font-medium text-ink-800 dark:text-ink-100">{trMsg(i.message)}</div>
            <div className="mt-0.5 text-[11px] text-ink-500">→ {trMsg(i.suggestion)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
