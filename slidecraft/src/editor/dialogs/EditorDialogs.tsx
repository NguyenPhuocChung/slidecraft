import { useEffect, useState } from 'react';
import { LANGS, tr, useLang } from '@/i18n';
import { Copy, RotateCcw, Link2, Download } from 'lucide-react';
import { useEditor } from '@/stores/editor';
import { storage, type VersionEntry } from '@/services/storage';
import { api, apiAvailable, auth } from '@/services/api';
import { useUiTheme } from '@/hooks/useUiTheme';
import { SHORTCUTS } from '@/hooks/useEditorShortcuts';
import { ASPECT_RATIOS } from '@/types/registry';
import { Badge, Button, Field, Modal, NumberInput, Select, Toggle, inputCls, toast } from '@/components/ui';
import { downloadBlob, safeFilename } from '@/utils/misc';

export function SettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useEditor();
  const ui = useUiTheme();
  const lang = useLang((x) => x.lang);
  const setLang = useLang((x) => x.setLang);
  const doc = s.doc;
  if (!doc) return null;
  const ar = doc.aspectRatio as keyof typeof ASPECT_RATIOS;
  return (
    <Modal open={open} onClose={onClose} title={tr('Settings')} width={720} testId="settings-dialog">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">{tr('Canvas')}</h3>
          <Toggle checked={s.showGrid} onChange={(v) => s.set({ showGrid: v })} label={tr('Show grid')} />
          <Toggle checked={s.snapToGrid} onChange={(v) => s.set({ snapToGrid: v })} label={tr('Snap to grid')} />
          <Toggle checked={s.snapToObjects} onChange={(v) => s.set({ snapToObjects: v })} label={tr('Snap to objects (smart guides)')} />
          <Toggle checked={s.showRulers} onChange={(v) => s.set({ showRulers: v })} label={tr('Rulers')} />
          <Field label={tr('Grid size')}><NumberInput value={s.gridSize} min={4} max={200} suffix="px" onChange={(v) => s.set({ gridSize: v })} /></Field>
          <h3 className="pt-2 text-xs font-semibold uppercase tracking-wider text-ink-500">{tr('Slide size')}</h3>
          <Select value={ar} options={Object.entries(ASPECT_RATIOS).map(([k, v]) => ({ value: k as keyof typeof ASPECT_RATIOS, label: tr(v.label) }))} onChange={(v) => {
            const size = v === 'custom' ? doc.size : { width: ASPECT_RATIOS[v].width, height: ASPECT_RATIOS[v].height };
            const sx = size.width / doc.size.width, sy = size.height / doc.size.height, k = Math.min(sx, sy);
            s.commit('Slide size', (d) => {
              d.aspectRatio = v; d.size = size;
              d.slides.forEach((sl) => sl.elements.forEach((e) => { const cx = (e.x + e.width / 2) * sx, cy = (e.y + e.height / 2) * sy; e.width *= k; e.height *= k; e.x = cx - e.width / 2; e.y = cy - e.height / 2; if (e.type === 'line' || e.type === 'arrow') { e.content.x1 *= sx; e.content.x2 *= sx; e.content.y1 *= sy; e.content.y2 *= sy; } if (e.style?.fontSize) e.style.fontSize = Math.round(e.style.fontSize * k); }));
            });
          }} />
          {ar === 'custom' && <div className="grid grid-cols-2 gap-2"><Field label={tr('Width')}><NumberInput value={doc.size.width} min={320} max={7680} onChange={(v) => s.commit('Slide size', (d) => { d.size.width = v; })} /></Field><Field label={tr('Height')}><NumberInput value={doc.size.height} min={240} max={7680} onChange={(v) => s.commit('Slide size', (d) => { d.size.height = v; })} /></Field></div>}
          <p className="text-[11px] text-ink-400">{tr('Changing the ratio rescales elements proportionally (undoable).')}</p>
        </div>
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-500">{tr('Presentation')}</h3>
          <Toggle checked={!!doc.globalStyles?.slideNumbers} onChange={(v) => s.commit('Slide numbers', (d) => { d.globalStyles = { ...(d.globalStyles ?? {}), slideNumbers: v }; })} label={tr('Slide numbers')} />
          <Field label={tr('Footer text')}><input className={inputCls} defaultValue={doc.globalStyles?.footer ?? ''} onBlur={(e) => s.commit('Footer', (d) => { d.globalStyles = { ...(d.globalStyles ?? {}), footer: e.target.value || undefined }; })} /></Field>
          <Field label={tr('Language (BCP-47)')}><input className={inputCls} defaultValue={doc.language ?? ''} placeholder={tr('vi, en…')} onBlur={(e) => s.commit('Language', (d) => { d.language = e.target.value || undefined; })} /></Field>
          <Field label={tr('Text direction')}><Select value={doc.direction ?? 'ltr'} options={[{ value: 'ltr', label: tr('Left to right') }, { value: 'rtl', label: tr('Right to left') }]} onChange={(v) => s.commit('Direction', (d) => { d.direction = v; })} /></Field>
          <h3 className="pt-2 text-xs font-semibold uppercase tracking-wider text-ink-500">{tr('App')}</h3>
          <Toggle checked={ui.mode === 'dark'} onChange={(v) => ui.set(v ? 'dark' : 'light')} label={tr('Dark mode')} />
          <Field label={tr('Interface language')}><Select value={lang} options={LANGS.map((l) => ({ value: l.id, label: l.label }))} onChange={(v) => setLang(v)} testId="settings-lang" /></Field>
          <p className="text-[11px] text-ink-400">{tr('Auto-save: every change is saved locally within a second; a version snapshot is kept every 5 minutes and on Ctrl+S.')}</p>
        </div>
      </div>
      <h3 className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-ink-500">{tr('Keyboard shortcuts')}</h3>
      <div className="grid gap-x-6 gap-y-1 text-xs md:grid-cols-2">{SHORTCUTS.map(([k, v]) => <div key={k} className="flex justify-between border-b border-ink-50 py-1 dark:border-ink-850"><span className="text-ink-500">{tr(v)}</span><kbd className="font-mono text-ink-700 dark:text-ink-200">{tr(k)}</kbd></div>)}</div>
    </Modal>
  );
}

export function VersionsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const [list, setList] = useState<VersionEntry[]>([]);
  useEffect(() => { if (open && doc) void storage.versions(doc.id).then(setList); }, [open, doc]);
  if (!doc) return null;
  const restore = async (v: VersionEntry) => {
    await storage.addVersion(doc, tr('Before restore'));
    const st = useEditor.getState();
    st.commit(`${tr('Restore version')} ${new Date(v.createdAt).toLocaleString()}`, (d) => { Object.assign(d, { ...v.data, id: doc.id }); });
    st.set({ currentSlideId: v.data.slides[0]?.id ?? null, selectedIds: [] });
    toast.success(tr('Version restored (the previous state was saved as a version).'));
    onClose();
  };
  return (
    <Modal open={open} onClose={onClose} title={tr('Version history')} width={560} testId="versions-dialog" footer={<Button onClick={async () => { await useEditor.getState().save({ snapshot: true, label: tr('Manual snapshot') }); setList(await storage.versions(doc.id)); }}>{tr('Create snapshot now')}</Button>}>
      {!list.length && <p className="text-sm text-ink-500">{tr('No versions yet. Versions are created automatically every 5 minutes and when you press Ctrl+S.')}</p>}
      <div className="space-y-1.5">
        {list.map((v) => (
          <div key={v.id} className="flex items-center gap-3 rounded-lg border border-ink-100 px-3 py-2 dark:border-ink-800">
            <div className="flex-1"><div className="text-sm font-medium">{tr(v.label)}</div><div className="text-xs text-ink-500">{new Date(v.createdAt).toLocaleString()} · {tr('{n} slides', { n: v.slideCount })}</div></div>
            <Button size="sm" icon={<RotateCcw size={12} />} onClick={() => void restore(v)}>{tr('Restore')}</Button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function ShareDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const meta = useEditor((s) => s.meta);
  const [online, setOnline] = useState<boolean | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'private' | 'link' | 'public'>('link');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) void apiAvailable().then((ok) => setOnline(ok && !!auth.token)); }, [open]);
  if (!doc) return null;
  const share = async () => {
    setBusy(true);
    try {
      await useEditor.getState().save({ snapshot: true, label: tr('Shared') });
      const m = await storage.getMeta(doc.id);
      if (!m?.cloudId) throw new Error('Cloud sync did not complete — check that you are signed in.');
      const r = await api.post<{ shareId: string | null; url: string | null }>(`/presentations/${m.cloudId}/share`, { visibility });
      setUrl(r.shareId ? `${location.origin}/share/${r.shareId}` : null);
      await storage.updateMeta(doc.id, { status: visibility === 'private' ? 'draft' : 'shared' });
      toast.success(visibility === 'private' ? tr('Sharing disabled') : tr('Share link created'));
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={tr('Share')} width={560} testId="share-dialog">
      {online === false && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          {tr('Share links need a SlideCraft account and the API server.')} <a className="font-semibold underline" href="/login">{tr('Sign in')}</a> {tr('— or share the files below.')}
        </div>
      )}
      {online && (
        <div className="mb-5 space-y-3">
          <Field label={tr('Who can view')}><Select value={visibility} onChange={setVisibility} options={[{ value: 'private', label: tr('Only me (private)') }, { value: 'link', label: tr('Anyone with the link (read-only)') }, { value: 'public', label: tr('Public') }]} /></Field>
          <Button variant="primary" icon={<Link2 size={14} />} disabled={busy} onClick={() => void share()}>{visibility === 'private' ? tr('Make private') : tr('Create share link')}</Button>
          {url && <div className="flex gap-2"><input className={inputCls} readOnly value={url} /><Button icon={<Copy size={13} />} onClick={() => { void navigator.clipboard.writeText(url); toast.success(tr('Link copied')); }}>{tr('Copy')}</Button></div>}
          {meta?.cloudId && <Badge tone="green">{tr('Synced to cloud')}</Badge>}
        </div>
      )}
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-500">{tr('Share as a file')}</h3>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Download size={13} />} onClick={() => downloadBlob(new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' }), `${safeFilename(doc.title)}.slidecraft.json`)}>{tr('SlideCraft JSON (re-importable)')}</Button>
        <Button icon={<Copy size={13} />} onClick={() => { void navigator.clipboard.writeText(JSON.stringify(doc)); toast.success(tr('Presentation code copied — paste it into Code Import anywhere.')); }}>{tr('Copy code')}</Button>
      </div>
      <p className="mt-2 text-[11px] text-ink-400">{tr('Use Export for PowerPoint, PDF, images or a web presentation.')}</p>
    </Modal>
  );
}
