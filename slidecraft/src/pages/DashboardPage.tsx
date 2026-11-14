import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Archive, CloudCheck, Copy, Download, FileUp, History, LayoutGrid, List, MoreHorizontal, Pencil, Plus, RotateCcw, Search, Share2, Star, Trash2 } from 'lucide-react';
import type { Asset } from '@/types/schema';
import { PageShell, useCurrentUser } from '@/components/AppHeader';
import { Badge, Button, IconButton, MenuButton, Modal, Popover, Tabs, cx, inputCls, toast } from '@/components/ui';
import { storage, type HistoryEntry, type ProjectMeta, type VersionEntry } from '@/services/storage';
import { duplicateProject } from '@/services/projects';
import { api, apiAvailable } from '@/services/api';
import { library } from '@/media/library';
import { THEME_MAP } from '@/themes/themes';
import { NewPresentationDialog } from './components/NewPresentationDialog';
import { tr, trMsg, useT } from '@/i18n';
import { ProjectThumb, copyText, download, relativeTime, slug, useWidth } from './components/helpers';

type Filter = 'recent' | 'draft' | 'exported' | 'shared' | 'archived' | 'starred';
type Section = 'projects' | 'assets' | 'history';
const FILTER_LABEL: Record<Filter, string> = { recent: 'All recent', draft: 'Drafts', exported: 'Exported', shared: 'Shared', archived: 'Archived', starred: 'Starred' };
const STATUS_LABEL: Record<string, string> = { draft: 'draft', exported: 'exported', shared: 'shared', archived: 'archived' };

export default function DashboardPage() {
  const t = useT();
  const nav = useNavigate();
  const [user] = useCurrentUser();
  const [list, setList] = useState<ProjectMeta[]>([]);
  const [section, setSection] = useState<Section>('projects');
  const [filter, setFilter] = useState<Filter>('recent');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'updated' | 'created' | 'title'>('updated');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [newOpen, setNewOpen] = useState(false);
  const [rename, setRename] = useState<ProjectMeta | null>(null);
  const [versionsOf, setVersionsOf] = useState<ProjectMeta | null>(null);
  const [shareOf, setShareOf] = useState<ProjectMeta | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [gridRef, gw] = useWidth<HTMLDivElement>();

  const refresh = useCallback(() => storage.list().then(setList), []);
  useEffect(() => { void refresh(); }, [refresh]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return list
      .filter((p) => (filter === 'archived' ? p.status === 'archived' : p.status !== 'archived'))
      .filter((p) => filter === 'recent' || filter === 'archived' || (filter === 'starred' ? p.starred : p.status === filter))
      .filter((p) => !s || p.title.toLowerCase().includes(s) || (p.description ?? '').toLowerCase().includes(s))
      .sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title) : sort === 'created' ? b.createdAt - a.createdAt : b.updatedAt - a.updatedAt));
  }, [list, filter, q, sort]);
  const counts = useMemo(() => ({
    recent: list.filter((p) => p.status !== 'archived').length, draft: list.filter((p) => p.status === 'draft').length,
    exported: list.filter((p) => p.status === 'exported').length, shared: list.filter((p) => p.status === 'shared').length,
    archived: list.filter((p) => p.status === 'archived').length, starred: list.filter((p) => p.starred && p.status !== 'archived').length,
  }), [list]);

  const exportJson = async (p: ProjectMeta) => {
    const doc = await storage.load(p.id);
    if (!doc) return toast.error(tr('Project data not found'));
    download(JSON.stringify(doc, null, 2), `${slug(p.title)}.slidecraft.json`, 'application/json');
  };
  const importFile = async (f: File) => {
    if (f.size > 8e6) return toast.error(tr('File is larger than 8 MB'));
    const text = await f.text();
    sessionStorage.setItem('slidecraft.importDraft', text);
    nav('/import');
  };
  const cols = gw > 1100 ? 4 : gw > 800 ? 3 : gw > 520 ? 2 : 1;
  const cardW = gw ? Math.floor((gw - (cols - 1) * 20) / cols) : 280;

  return (
    <PageShell>
      <div
        className={cx('relative mt-8', dragOver && 'rounded-2xl ring-2 ring-brand-500 ring-offset-4 dark:ring-offset-ink-950')}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) void importFile(f); }}
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">{t('Dashboard')}</h1>
            <p className="text-sm text-ink-500">{user ? t('{n} presentations · saved locally and synced to your cloud account. Drop a .json file anywhere to import.', { n: counts.recent }) : t('{n} presentations · saved locally. Drop a .json file anywhere to import.', { n: counts.recent })}</p>
          </div>
          <div className="flex gap-2">
            <Button icon={<FileUp size={14} />} onClick={() => fileRef.current?.click()}>{t('Import file')}</Button>
            <input ref={fileRef} hidden type="file" accept=".json,.js,.ts,.tsx,.jsx,.html,.md,.txt" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importFile(f); e.target.value = ''; }} />
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setNewOpen(true)} data-testid="dashboard-new">{t('New presentation')}</Button>
          </div>
        </div>

        <Tabs className="mt-6 max-w-xl" value={section} onChange={setSection} tabs={[{ id: 'projects', label: t('Presentations') }, { id: 'assets', label: t('Asset library') }, { id: 'history', label: t('Export & import history') }]} />

        {section === 'projects' && (
          <>
            <div className="mt-5 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap gap-1">
                {(['recent', 'draft', 'exported', 'shared', 'starred', 'archived'] as Filter[]).map((f) => (
                  <button key={f} onClick={() => setFilter(f)} className={cx('rounded-full px-3 py-1 text-[13px]', filter === f ? 'bg-ink-900 text-white dark:bg-white dark:text-ink-900' : 'text-ink-600 hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800')} data-testid={`filter-${f}`}>
                    {t(FILTER_LABEL[f])} <span className="opacity-60">{counts[f]}</span>
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="relative"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-400" /><input className={cx(inputCls, '!w-56 pl-8')} placeholder={t('Search presentations')} value={q} onChange={(e) => setQ(e.target.value)} data-testid="dashboard-search" /></div>
                <select className={cx(inputCls, '!w-48')} value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
                  <option value="updated">{t('Last updated')}</option><option value="created">{t('Date created')}</option><option value="title">{t('Title')}</option>
                </select>
                <IconButton title={t('Grid')} active={view === 'grid'} onClick={() => setView('grid')}><LayoutGrid size={15} /></IconButton>
                <IconButton title={t('List')} active={view === 'list'} onClick={() => setView('list')}><List size={15} /></IconButton>
              </div>
            </div>
            <div ref={gridRef} className="mt-5">
              {!shown.length && (
                <div className="rounded-2xl border border-dashed border-ink-200 py-16 text-center dark:border-ink-700">
                  <p className="text-sm text-ink-500">{filter === 'archived' ? t('Archive is empty.') : q ? t('No presentations match your search.') : t('No presentations yet.')}</p>
                  {filter !== 'archived' && !q && <div className="mt-4 flex justify-center gap-2"><Button variant="primary" onClick={() => setNewOpen(true)}>{t('Create one')}</Button><Button onClick={() => nav('/import')}>{t('Import AI code')}</Button></div>}
                </div>
              )}
              {view === 'grid' ? (
                <div className="grid gap-5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
                  {shown.map((p) => (
                    <div key={p.id} className="group overflow-hidden rounded-xl border border-ink-100 bg-white transition hover:shadow-panel dark:border-ink-800 dark:bg-ink-900" data-testid="project-card">
                      <button className="block w-full" onClick={() => nav(`/editor/${p.id}`)}><ProjectThumb id={p.id} width={cardW} /></button>
                      <div className="flex items-start gap-2 p-3">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink-900 dark:text-white">{p.title}</div>
                          <div className="mt-0.5 text-xs text-ink-400">{t('{n} slides', { n: p.slideCount })} · {relativeTime(p.updatedAt)}</div>
                          <div className="mt-1.5 flex flex-wrap gap-1"><StatusBadges p={p} /></div>
                        </div>
                        <ProjectMenu p={p} filter={filter} refresh={refresh} onRename={setRename} onVersions={setVersionsOf} onShare={setShareOf} onExport={exportJson} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-ink-100 rounded-xl border border-ink-100 dark:divide-ink-800 dark:border-ink-800">
                  {shown.map((p) => (
                    <div key={p.id} className="flex items-center gap-4 px-3 py-2" data-testid="project-row">
                      <button onClick={() => nav(`/editor/${p.id}`)} className="shrink-0 overflow-hidden rounded"><ProjectThumb id={p.id} width={96} /></button>
                      <button className="min-w-0 flex-1 text-left" onClick={() => nav(`/editor/${p.id}`)}><div className="truncate text-sm font-medium text-ink-900 dark:text-white">{p.title}</div><div className="text-xs text-ink-400">{p.description}</div></button>
                      <div className="hidden gap-1 sm:flex"><StatusBadges p={p} /></div>
                      <div className="w-24 text-right text-xs text-ink-400">{t('{n} slides', { n: p.slideCount })}</div>
                      <div className="w-28 text-right text-xs text-ink-400">{relativeTime(p.updatedAt)}</div>
                      <ProjectMenu p={p} filter={filter} refresh={refresh} onRename={setRename} onVersions={setVersionsOf} onShare={setShareOf} onExport={exportJson} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
        {section === 'assets' && <AssetLibrary />}
        {section === 'history' && <HistoryList list={list} />}
      </div>
      <NewPresentationDialog open={newOpen} onClose={() => setNewOpen(false)} />
      {rename && <RenameDialog p={rename} onClose={() => setRename(null)} onDone={refresh} />}
      {versionsOf && <VersionsDialog p={versionsOf} onClose={() => setVersionsOf(null)} onDone={refresh} />}
      {shareOf && <ShareDialog p={shareOf} onClose={() => setShareOf(null)} onDone={refresh} signedIn={!!user} />}
    </PageShell>
  );
}

function StatusBadges({ p }: { p: ProjectMeta }) {
  const t = useT();
  return (
    <>
      <Badge tone={p.status === 'exported' ? 'green' : p.status === 'shared' ? 'blue' : p.status === 'archived' ? 'amber' : 'neutral'}>{t(STATUS_LABEL[p.status] ?? p.status)}</Badge>
      {p.theme && <Badge>{t(THEME_MAP[p.theme]?.name ?? p.theme)}</Badge>}
      {p.cloudId && <Badge tone="brand"><CloudCheck size={11} />{t('synced')}</Badge>}
      {p.starred && <Badge tone="amber"><Star size={10} fill="currentColor" /></Badge>}
    </>
  );
}

function ProjectMenu({ p, filter, refresh, onRename, onVersions, onShare, onExport }: { p: ProjectMeta; filter: Filter; refresh: () => void; onRename: (p: ProjectMeta) => void; onVersions: (p: ProjectMeta) => void; onShare: (p: ProjectMeta) => void; onExport: (p: ProjectMeta) => void }) {
  const t = useT();
  const nav = useNavigate();
  const setStatus = async (status: ProjectMeta['status']) => { await storage.updateMeta(p.id, { status }); refresh(); };
  return (
    <Popover align="right" width={210} trigger={(_o, toggleMenu) => <IconButton title={t('More')} onClick={toggleMenu} data-testid="project-menu"><MoreHorizontal size={16} /></IconButton>}>
      {(close) => {
        const act = (fn: () => void | Promise<void>) => () => { close(); void fn(); };
        return filter === 'archived' ? (
          <>
            <MenuButton icon={<RotateCcw size={14} />} onClick={act(async () => { await setStatus('draft'); toast.success(tr('Restored')); })} testId="restore-project">{t('Restore')}</MenuButton>
            <MenuButton danger icon={<Trash2 size={14} />} onClick={act(async () => { if (!confirm(tr('Permanently delete “{title}”? This cannot be undone.', { title: p.title }))) return; await storage.remove(p.id); if (p.cloudId) api.del(`/presentations/${p.cloudId}?hard=true`).catch(() => undefined); refresh(); toast.success(tr('Deleted permanently')); })} testId="delete-forever">{t('Delete permanently')}</MenuButton>
          </>
        ) : (
          <>
            <MenuButton icon={<Pencil size={14} />} onClick={act(() => nav(`/editor/${p.id}`))}>{t('Open')}</MenuButton>
            <MenuButton icon={<Pencil size={14} />} onClick={act(() => onRename(p))} testId="rename-project">{t('Rename')}</MenuButton>
            <MenuButton icon={<Copy size={14} />} onClick={act(async () => { await duplicateProject(p.id); refresh(); toast.success(tr('Duplicated')); })} testId="duplicate-project">{t('Duplicate')}</MenuButton>
            <MenuButton icon={<Star size={14} />} onClick={act(async () => { await storage.updateMeta(p.id, { starred: !p.starred }); refresh(); })}>{p.starred ? t('Unstar') : t('Star')}</MenuButton>
            <MenuButton icon={<History size={14} />} onClick={act(() => onVersions(p))}>{t('Version history')}</MenuButton>
            <MenuButton icon={<Download size={14} />} onClick={act(() => onExport(p))}>{t('Export JSON')}</MenuButton>
            <MenuButton icon={<Share2 size={14} />} onClick={act(() => onShare(p))}>{t('Share')}</MenuButton>
            <MenuButton danger icon={<Archive size={14} />} onClick={act(async () => { await setStatus('archived'); if (p.cloudId) api.del(`/presentations/${p.cloudId}`).catch(() => undefined); toast.info(tr('Moved to Archive')); })} testId="archive-project">{t('Delete (archive)')}</MenuButton>
          </>
        );
      }}
    </Popover>
  );
}

function RenameDialog({ p, onClose, onDone }: { p: ProjectMeta; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [title, setTitle] = useState(p.title);
  const [desc, setDesc] = useState(p.description ?? '');
  const save = async () => {
    const doc = await storage.load(p.id);
    if (doc) await storage.save({ ...doc, title: title.trim() || doc.title, description: desc || undefined });
    if (p.cloudId) api.patch(`/presentations/${p.cloudId}`, { title, description: desc }).catch(() => undefined);
    onDone(); onClose();
  };
  return (
    <Modal open onClose={onClose} title={t('Rename presentation')} width={480} footer={<><Button variant="ghost" onClick={onClose}>{t('Cancel')}</Button><Button variant="primary" onClick={() => void save()} data-testid="rename-save">{t('Save')}</Button></>}>
      <div className="space-y-3">
        <input autoFocus className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void save(); }} data-testid="rename-input" />
        <textarea className={cx(inputCls, 'h-20 py-2')} placeholder={t('Description (optional)')} value={desc} onChange={(e) => setDesc(e.target.value)} />
      </div>
    </Modal>
  );
}

function VersionsDialog({ p, onClose, onDone }: { p: ProjectMeta; onClose: () => void; onDone: () => void }) {
  const t = useT();
  const [items, setItems] = useState<VersionEntry[] | null>(null);
  useEffect(() => { void storage.versions(p.id).then(setItems); }, [p.id]);
  const restore = async (v: VersionEntry) => {
    if (!confirm(tr('Restore the version from {date}? The current state is saved as a version first.', { date: new Date(v.createdAt).toLocaleString() }))) return;
    const cur = await storage.load(p.id);
    if (cur) await storage.addVersion(cur, 'Before restore');
    await storage.save({ ...v.data, id: p.id });
    await storage.addVersion({ ...v.data, id: p.id }, `Restored from ${new Date(v.createdAt).toLocaleString()}`);
    toast.success(tr('Version restored'));
    onDone(); onClose();
  };
  return (
    <Modal open onClose={onClose} title={`${t('Version history')} — ${p.title}`} width={560}>
      {!items ? <p className="text-sm text-ink-400">{t('Loading…')}</p> : !items.length ? <p className="text-sm text-ink-400">{t('No versions yet. Versions are created automatically every few minutes while editing and on Ctrl+S.')}</p> : (
        <div className="divide-y divide-ink-100 dark:divide-ink-800">
          {items.map((v, i) => (
            <div key={v.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1"><div className="text-sm text-ink-800 dark:text-ink-100">{t(v.label)}{i === 0 && <Badge className="ml-2" tone="brand">{t('latest')}</Badge>}</div><div className="text-xs text-ink-400">{new Date(v.createdAt).toLocaleString()} · {t('{n} slides', { n: v.slideCount })}</div></div>
              <Button size="sm" icon={<RotateCcw size={13} />} onClick={() => void restore(v)}>{t('Restore')}</Button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function ShareDialog({ p, onClose, onDone, signedIn }: { p: ProjectMeta; onClose: () => void; onDone: () => void; signedIn: boolean }) {
  const t = useT();
  const [online, setOnline] = useState<boolean | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void apiAvailable().then(setOnline); }, []);
  const share = async (visibility: 'link' | 'public' | 'private') => {
    setBusy(true);
    try {
      let cloudId = p.cloudId;
      const doc = await storage.load(p.id);
      if (!doc) throw new Error(tr('Project data not found'));
      if (!cloudId) { const r = await api.post<{ id: string }>('/presentations', { title: doc.title, description: doc.description, data: doc }); cloudId = r.id; await storage.updateMeta(p.id, { cloudId, cloudSyncedAt: Date.now() }); }
      else await api.put(`/presentations/${cloudId}`, { title: doc.title, description: doc.description, data: doc });
      const r = await api.post<{ shareId: string | null; visibility: string }>(`/presentations/${cloudId}/share`, { visibility });
      if (r.shareId) { const url = `${location.origin}/share/${r.shareId}`; setLink(url); await storage.updateMeta(p.id, { status: 'shared' }); }
      else { setLink(null); await storage.updateMeta(p.id, { status: 'draft' }); toast.info(tr('Sharing disabled')); }
      onDone();
    } catch (e) { toast.error(tr('Share failed: {msg}', { msg: (e as Error).message })); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={`${t('Share')} — ${p.title}`} width={520}>
      {online === null ? <p className="text-sm text-ink-400">{t('Checking cloud…')}</p> : !online ? (
        <p className="text-sm text-ink-600 dark:text-ink-300">{t('Cloud sharing needs the SlideCraft server, which is not reachable right now. You can still share the file: use Export JSON (re-importable anywhere) or export PPTX/PDF from the editor.')}</p>
      ) : !signedIn ? (
        <p className="text-sm text-ink-600 dark:text-ink-300">{t('Sign in to create read-only share links.')} <a href="/login" className="text-brand-600 underline">{t('Sign in')}</a></p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-600 dark:text-ink-300">{t('Anyone with the link can view the presentation read-only.')}</p>
          <div className="flex gap-2">
            <Button variant="primary" disabled={busy} onClick={() => void share('link')}>{t('Create link')}</Button>
            <Button disabled={busy} onClick={() => void share('public')}>{t('Make public')}</Button>
            <Button variant="ghost" disabled={busy} onClick={() => void share('private')}>{t('Make private')}</Button>
          </div>
          {link && (
            <div className="flex gap-2">
              <input readOnly className={inputCls} value={link} />
              <Button onClick={() => void copyText(link).then(() => toast.success(tr('Link copied')))}>{t('Copy')}</Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function AssetLibrary() {
  const t = useT();
  const [items, setItems] = useState<Asset[] | null>(null);
  const [q, setQ] = useState('');
  useEffect(() => { void library.list().then(setItems); }, []);
  const shown = (items ?? []).filter((a) => !q || (a.name ?? '').toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="mt-5">
      <div className="mb-4 flex items-center gap-3">
        <input className={cx(inputCls, '!w-64')} placeholder={t('Search assets')} value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-xs text-ink-400">{t('Upload files from the editor’s Media panel; they are reusable in every presentation.')}</span>
      </div>
      {!shown.length ? <p className="py-10 text-center text-sm text-ink-400">{items ? t('No assets yet.') : t('Loading…')}</p> : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {shown.map((a) => (
            <div key={a.id} className="group overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800">
              <div className="aspect-[4/3] bg-ink-50 dark:bg-ink-900">{a.type === 'image' || a.type === 'svg' ? <img src={a.src} alt={a.name} className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center text-xs uppercase text-ink-400">{a.type}</div>}</div>
              <div className="flex items-center gap-1 p-2">
                <div className="min-w-0 flex-1"><div className="truncate text-xs text-ink-700 dark:text-ink-200">{a.name}</div><div className="text-[10px] text-ink-400">{a.size ? `${Math.round(a.size / 1024)} KB` : ''} {a.license ?? ''}</div></div>
                <IconButton title={t('Delete')} onClick={() => { void library.remove(a.id).then(() => setItems((l) => (l ?? []).filter((x) => x.id !== a.id))); }}><Trash2 size={13} /></IconButton>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryList({ list }: { list: ProjectMeta[] }) {
  const t = useT();
  const [items, setItems] = useState<HistoryEntry[] | null>(null);
  useEffect(() => { void storage.history().then(setItems); }, []);
  const title = (id?: string) => list.find((p) => p.id === id)?.title ?? '—';
  return (
    <div className="mt-5 overflow-hidden rounded-xl border border-ink-100 dark:border-ink-800">
      {!items?.length ? <p className="py-10 text-center text-sm text-ink-400">{items ? t('No exports or imports yet.') : t('Loading…')}</p> : (
        <table className="w-full text-sm">
          <thead className="bg-ink-50 text-left text-xs text-ink-500 dark:bg-ink-900"><tr><th className="px-3 py-2">{t('When')}</th><th>{t('Type')}</th><th>{t('Format')}</th><th>{t('Presentation')}</th><th>{t('Details')}</th><th className="pr-3">{t('Result')}</th></tr></thead>
          <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
            {items.map((h) => (
              <tr key={h.id}><td className="px-3 py-2 text-xs text-ink-500">{new Date(h.at).toLocaleString()}</td><td>{t(h.kind === 'export' ? 'Export' : 'Import')}</td><td><Badge>{h.format}</Badge></td><td className="max-w-[220px] truncate">{title(h.projectId)}</td><td className="max-w-[320px] truncate text-xs text-ink-500">{trMsg(h.detail)}</td><td className="pr-3">{h.ok ? <Badge tone="green">{t('ok')}</Badge> : <Badge tone="red">{t('failed')}</Badge>}</td></tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
