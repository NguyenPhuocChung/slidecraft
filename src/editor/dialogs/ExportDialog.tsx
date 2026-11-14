import { useMemo, useState } from 'react';
import { tr, trMsg } from '@/i18n';
import { AlertTriangle, CheckCircle2, Download, FileImage, FileJson, FileText, Globe, Info, Loader2, Presentation as PptIcon, XCircle, Film } from 'lucide-react';
import { useEditor, flushSave } from '@/stores/editor';
import { EXPORT_PROFILES, exportPptx, preflight, type ExportProfile, type ExportReport } from '@/pptx-export';
import { exportHtml, exportImages, exportJsonFile, exportPdf, exportSvg, rasterizeSvg, fetchImageAsDataUrl } from '@/pptx-export/raster';
import { storage } from '@/services/storage';
import { api, auth } from '@/services/api';
import { downloadBlob, safeFilename } from '@/utils/misc';
import { Badge, Button, Modal, Toggle, cx, toast } from '@/components/ui';
import { makeResolveImage, renderFormulaPng, renderSlideOffscreen, resolvePendingImages } from './exportHelpers';

type Format = 'pptx' | 'pdf' | 'png' | 'jpeg' | 'svg' | 'html' | 'json' | 'mp4';
const FORMATS: { id: Format; label: string; icon: typeof Download; desc: string }[] = [
  { id: 'pptx', label: 'PowerPoint (.pptx)', icon: PptIcon, desc: 'Native, editable objects + transitions & animations' },
  { id: 'pdf', label: 'PDF', icon: FileText, desc: 'High quality, one page per slide' },
  { id: 'png', label: 'PNG images', icon: FileImage, desc: '2× resolution, ZIP for multiple slides' },
  { id: 'jpeg', label: 'JPEG images', icon: FileImage, desc: 'Smaller files' },
  { id: 'svg', label: 'SVG', icon: FileImage, desc: 'Vector snapshot per slide' },
  { id: 'html', label: 'Web presentation', icon: Globe, desc: 'Single HTML file with keyboard navigation' },
  { id: 'json', label: 'SlideCraft JSON', icon: FileJson, desc: 'Re-importable source code' },
  { id: 'mp4', label: 'Video (MP4)', icon: Film, desc: 'Not available yet' },
];

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const doc = useEditor((s) => s.doc)!;
  const currentSlideId = useEditor((s) => s.currentSlideId);
  const [format, setFormat] = useState<Format>('pptx');
  const [profile, setProfile] = useState<ExportProfile>('standard');
  const [onlyCurrent, setOnlyCurrent] = useState(false);
  const [notesPages, setNotesPages] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ExportReport | null>(null);
  const pre = useMemo(() => preflight(doc, { profile, resolveImage: makeResolveImage(doc) } as never), [doc, profile]);
  const currentIndex = doc.slides.findIndex((s) => s.id === currentSlideId);
  const slides = onlyCurrent ? [currentIndex] : doc.slides.map((_, i) => i).filter((i) => !doc.slides[i].hidden);
  const name = safeFilename(doc.title);

  const renderSlide = async (i: number) => {
    const r = await renderSlideOffscreen(doc, i);
    disposers.push(r.dispose);
    return r.node;
  };
  const disposers: (() => void)[] = [];

  const record = async (fmt: string, ok: boolean, detail: string) => {
    await storage.addHistory({ kind: 'export', format: fmt, detail, projectId: doc.id, ok });
    if (ok) await storage.updateMeta(doc.id, { status: 'exported', exportedAt: Date.now() });
    const meta = await storage.getMeta(doc.id);
    if (auth.token && meta?.cloudId) void api.post(`/presentations/${meta.cloudId}/exports`, { format: fmt, profile, warnings: result?.warnings.length ?? 0 }).catch(() => undefined);
  };

  const run = async () => {
    flushSave();
    setResult(null);
    setProgress(0);
    try {
      if (format === 'mp4') { toast.info(tr('Video export is not available yet. Use PDF, PPTX (with auto-advance) or the Web presentation.')); return; }
      if (format === 'json') { const f = exportJsonFile(doc); downloadBlob(f.blob, f.filename); await record('json', true, tr('JSON source')); toast.success(tr('Exported JSON')); return; }
      setBusy('Resolving images…');
      await resolvePendingImages(doc);
      if (format === 'pptx') {
        setBusy('Building PowerPoint…');
        const subset = onlyCurrent ? { ...doc, slides: [doc.slides[currentIndex]] } : doc;
        const { blob, report } = await exportPptx(subset, {
          profile, rasterize: rasterizeSvg, fetchImage: (u) => fetchImageAsDataUrl(u), resolveImage: makeResolveImage(doc), renderFormula: renderFormulaPng,
          onProgress: (p, label) => { setProgress(p); setBusy(label); },
        });
        setResult(report);
        if (!report.ok) { toast.error(tr('Export validation failed — the file was not saved. See the report.')); await record('pptx', false, report.errors.join('; ')); return; }
        downloadBlob(blob as Blob, `${name}${onlyCurrent ? `-slide-${currentIndex + 1}` : ''}.pptx`);
        await record('pptx', true, `${report.slideCount} slides · ${profile}`);
        toast.success(tr('PowerPoint exported ({n} slides, validated)', { n: report.slideCount }));
        return;
      }
      setBusy('Rendering slides…');
      const opts = { slides, onProgress: (p: number, label: string) => { setProgress(p); setBusy(label); } };
      const out = format === 'pdf' ? await exportPdf(doc, renderSlide, { ...opts, includeNotes: notesPages })
        : format === 'svg' ? await exportSvg(doc, renderSlide, opts)
        : format === 'html' ? await exportHtml(doc, renderSlide, opts)
        : await exportImages(doc, renderSlide, format, opts);
      downloadBlob(out.blob, out.filename);
      await record(format, true, `${out.count} slides`);
      toast.success(`Exported ${out.count} slide${out.count > 1 ? 's' : ''} as ${format.toUpperCase()}`);
    } catch (e) {
      toast.error(`${tr('Export failed')}: ${(e as Error).message}`);
      await record(format, false, (e as Error).message);
    } finally {
      disposers.forEach((d) => d());
      setBusy(null);
    }
  };

  const shown = result ?? (format === 'pptx' ? pre : null);
  return (
    <Modal open onClose={onClose} title={tr('Export')} width={980} testId="export-dialog" footer={<>
      <span className="mr-auto text-xs text-ink-500">{busy ? <span className="flex items-center gap-2"><Loader2 size={13} className="animate-spin" />{trMsg(busy)} {progress ? `${Math.round(progress * 100)}%` : ''}</span> : `${tr('{n} slides', { n: slides.length })}${doc.slides.some((s) => s.hidden) && !onlyCurrent ? ` ${tr('(hidden slides skipped in images/PDF)')}` : ''}`}</span>
      <Button onClick={onClose}>{tr('Close')}</Button>
      <Button variant="primary" icon={<Download size={14} />} disabled={!!busy || format === 'mp4'} onClick={() => void run()} data-testid="export-run">{tr('Export')} {format.toUpperCase()}</Button>
    </>}>
      <div className="grid gap-5 md:grid-cols-[280px_1fr]">
        <div className="space-y-1">
          {FORMATS.map((f) => (
            <button key={f.id} onClick={() => { setFormat(f.id); setResult(null); }} className={cx('flex w-full items-start gap-3 rounded-xl border p-2.5 text-left transition', format === f.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-transparent hover:bg-ink-50 dark:hover:bg-ink-850', f.id === 'mp4' && 'opacity-60')} data-testid={`format-${f.id}`}>
              <f.icon size={18} className="mt-0.5 text-ink-500" />
              <span><span className="block text-[13px] font-medium">{tr(f.label)}</span><span className="block text-[11px] text-ink-500">{tr(f.desc)}</span></span>
            </button>
          ))}
        </div>
        <div className="min-w-0 space-y-4">
          {format === 'pptx' && (
            <div className="grid grid-cols-2 gap-2">
              {EXPORT_PROFILES.map((p) => (
                <button key={p.id} onClick={() => { setProfile(p.id); setResult(null); }} className={cx('rounded-xl border p-3 text-left', profile === p.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10' : 'border-ink-200 dark:border-ink-700')}>
                  <div className="text-[13px] font-semibold">{tr(p.name)}</div>
                  <div className="text-[11px] text-ink-500">{tr(p.description)}</div>
                </button>
              ))}
            </div>
          )}
          {format !== 'json' && format !== 'mp4' && (
            <div className="flex flex-wrap gap-4">
              <Toggle checked={onlyCurrent} onChange={setOnlyCurrent} label={tr('Only current slide ({n})', { n: currentIndex + 1 })} />
              {format === 'pdf' && <Toggle checked={notesPages} onChange={setNotesPages} label={tr('Add speaker notes pages')} />}
            </div>
          )}
          {format === 'mp4' && <div className="rounded-xl border border-ink-200 p-4 text-sm text-ink-600 dark:border-ink-700 dark:text-ink-300">{tr('MP4 rendering is not implemented in this version — it is not faked. Alternatives: PowerPoint export with auto-advance timings (PowerPoint → File → Export → Video), or the Web presentation.')}</div>}
          {shown && (
            <div className="space-y-3" data-testid="export-report">
              <div className="flex items-center gap-2 text-sm font-semibold">
                {result ? (result.ok ? <CheckCircle2 size={16} className="text-emerald-600" /> : <XCircle size={16} className="text-red-600" />) : <Info size={16} className="text-brand-600" />}
                {result ? (result.ok ? tr('Export validated') : tr('Export failed validation')) : tr('Pre-export check')}
                <Badge tone="red">{tr('{n} errors', { n: shown.errors.length })}</Badge><Badge tone="amber">{tr('{n} warnings', { n: shown.warnings.length })}</Badge>
              </div>
              {result && <div className="grid grid-cols-2 gap-1">{result.checks.map((c) => <div key={c.name} className="flex items-start gap-1.5 text-[11px]">{c.ok ? <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-emerald-600" /> : <XCircle size={12} className="mt-0.5 shrink-0 text-red-600" />}<span>{trMsg(c.name)}{c.detail ? <span className="text-ink-400"> — {c.detail}</span> : null}</span></div>)}</div>}
              {shown.errors.map((m, i) => <p key={`e${i}`} className="flex gap-1.5 text-xs text-red-700 dark:text-red-300"><XCircle size={13} className="mt-0.5 shrink-0" />{trMsg(m)}</p>)}
              <div className="max-h-48 space-y-1 overflow-auto">{shown.warnings.map((m, i) => <p key={`w${i}`} className="flex gap-1.5 text-xs text-amber-700 dark:text-amber-300"><AlertTriangle size={13} className="mt-0.5 shrink-0" />{trMsg(m)}</p>)}</div>
              <div className="grid gap-2 md:grid-cols-3">
                {(['supported', 'partial', 'unsupported'] as const).map((k) => (
                  <div key={k} className="rounded-lg border border-ink-100 p-2 dark:border-ink-800">
                    <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-500">{k === 'partial' ? tr('Partially supported') : tr(k)} ({shown.support[k].length})</div>
                    <div className="max-h-32 space-y-0.5 overflow-auto text-[11px] text-ink-600 dark:text-ink-300">{shown.support[k].map((s, i) => <div key={i}>{trMsg(s)}</div>)}</div>
                  </div>
                ))}
              </div>
              {shown.info.length > 0 && <details className="text-[11px] text-ink-500"><summary className="cursor-pointer">{tr('{n} notes', { n: shown.info.length })}</summary>{shown.info.map((m, i) => <p key={i}>{trMsg(m)}</p>)}</details>}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
