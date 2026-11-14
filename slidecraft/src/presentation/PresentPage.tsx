import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { tr, useLang } from '@/i18n';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Maximize, MonitorPlay, Pause, Play, Timer, X, MousePointer2, Presentation as PresentIcon, Clock3 } from 'lucide-react';
import type { Presentation } from '@/types/schema';
import { storage } from '@/services/storage';
import { useEditor } from '@/stores/editor';
import { useFonts } from '@/hooks/useFonts';
import { presentationTheme } from '@/slides/SlideRenderer';
import { SlideRenderer } from '@/slides/SlideRenderer';
import { Player, type PlayerHandle, type PlayerState } from './Player';

type Mode = 'normal' | 'presenter' | 'audience' | 'rehearsal';
interface SyncMsg { type: 'goto'; index: number; step: number }

function useViewport() {
  const [s, set] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => { const r = () => set({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener('resize', r); return () => window.removeEventListener('resize', r); }, []);
  return s;
}
/** BroadcastChannel that survives StrictMode re-mounts; post() never throws. */
function useSync(id: string, onMsg: (m: SyncMsg) => void) {
  const ref = useRef<BroadcastChannel | null>(null);
  const cb = useRef(onMsg);
  cb.current = onMsg;
  useEffect(() => {
    const ch = new BroadcastChannel(`slidecraft-present-${id}`);
    ch.onmessage = (e: MessageEvent<SyncMsg>) => { if (e.data?.type === 'goto') cb.current(e.data); };
    ref.current = ch;
    return () => { ch.close(); if (ref.current === ch) ref.current = null; };
  }, [id]);
  return useMemo(() => ({ post: (m: SyncMsg) => { try { ref.current?.postMessage(m); } catch { /* closed */ } } }), []);
}
const fmt = (ms: number) => { const s = Math.floor(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

export default function PresentPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const nav = useNavigate();
  const mode = (params.get('mode') as Mode) ?? 'normal';
  const start = Math.max(0, Number(params.get('start') ?? 0));
  const [doc, setDoc] = useState<Presentation | null>(null);
  const [error, setError] = useState<string>();
  useEffect(() => {
    const live = useEditor.getState().doc;
    if (live && live.id === id) { setDoc(live); return; }
    void storage.load(id!).then((p) => (p ? setDoc(p) : setError(tr('Presentation not found on this device.'))));
  }, [id]);
  const theme = useMemo(() => (doc ? presentationTheme(doc) : null), [doc]);
  useFonts(theme ? [theme.fonts.heading, theme.fonts.body, theme.fonts.mono] : []);
  if (error) return <div className="flex h-full items-center justify-center bg-black text-white/70">{error}</div>;
  if (!doc) return <div className="h-full bg-black" />;
  return mode === 'presenter' ? <PresenterView doc={doc} start={start} onExit={() => nav(`/editor/${doc.id}`)} /> : <AudienceView doc={doc} start={start} mode={mode} onExit={() => { if (mode === 'audience') window.close(); nav(`/editor/${doc.id}`); }} />;
}

function AudienceView({ doc, start, mode, onExit }: { doc: Presentation; start: number; mode: Mode; onExit: () => void }) {
  useLang((s) => s.lang); // re-render on language change
  const vp = useViewport();
  const player = useRef<PlayerHandle>(null);
  const [st, setSt] = useState<PlayerState>({ index: start, step: 0, steps: 0, total: 0, transitioning: false });
  const [autoPlay, setAutoPlay] = useState(false);
  const [paused, setPaused] = useState(false);
  const [screen, setScreen] = useState<'none' | 'black' | 'white'>('none');
  const [laser, setLaser] = useState(false);
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [showUi, setShowUi] = useState(true);
  const [showTimer, setShowTimer] = useState(mode === 'rehearsal');
  const [t0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const rehearsal = useRef<{ index: number; at: number; times: Record<string, number> }>({ index: start, at: Date.now(), times: {} });
  const [rehearsalDone, setRehearsalDone] = useState<Record<string, number> | null>(null);
  const visible = useMemo(() => doc.slides.filter((s) => !s.hidden), [doc]);
  const channel = useSync(doc.id, (m) => { const s = player.current?.state(); if (s && (s.index !== m.index || s.step !== m.step)) player.current?.goto(m.index, m.step); });
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i); }, []);
  // UI auto-hide
  useEffect(() => { if (!showUi) return; const t = setTimeout(() => setShowUi(false), 2500); return () => clearTimeout(t); }, [showUi, mouse]);
  const onState = useCallback((s: PlayerState) => {
    setSt(s);
    if (mode !== 'audience') channel.post({ type: 'goto', index: s.index, step: s.step });
    const r = rehearsal.current;
    if (s.index !== r.index) { const id = visible[r.index]?.id; if (id) r.times[id] = (r.times[id] ?? 0) + Date.now() - r.at; r.index = s.index; r.at = Date.now(); }
  }, [channel, mode, visible]);
  const end = () => {
    if (mode === 'rehearsal') {
      const r = rehearsal.current; const id = visible[r.index]?.id; if (id) r.times[id] = (r.times[id] ?? 0) + Date.now() - r.at;
      setRehearsalDone({ ...r.times });
    } else onExit();
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (rehearsalDone) return;
      const k = e.key;
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n'].includes(k)) { e.preventDefault(); if (screen !== 'none') setScreen('none'); else player.current?.next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p'].includes(k)) { e.preventDefault(); player.current?.prev(); }
      else if (k === 'Home') player.current?.goto(0);
      else if (k === 'End') player.current?.goto(visible.length - 1);
      else if (k === 'Escape') { if (document.fullscreenElement) void document.exitFullscreen(); end(); }
      else if (k === 'b' || k === 'B' || k === '.') setScreen((s) => (s === 'black' ? 'none' : 'black'));
      else if (k === 'w' || k === 'W' || k === ',') setScreen((s) => (s === 'white' ? 'none' : 'white'));
      else if (k === 'l' || k === 'L') setLaser((l) => !l);
      else if (k === 't' || k === 'T') setShowTimer((v) => !v);
      else if (k === 'P') setPaused((v) => !v);
      else if (k === 'a' || k === 'A') setAutoPlay((v) => !v);
      else if (k === 'f' || k === 'F') void toggleFs();
      else if (k === 's' || k === 'S') openPresenter();
      else if (/^[0-9]$/.test(k)) { /* number + Enter jump handled by PageUp etc. */ }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  const toggleFs = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); } catch { /* not allowed */ } };
  const openPresenter = () => { window.open(`/present/${doc.id}?mode=presenter&start=${st.index}`, `presenter-${doc.id}`, 'width=1280,height=800'); };
  const progress = visible.length > 1 ? st.index / (visible.length - 1) : 1;
  return (
    <div className="relative h-full w-full overflow-hidden bg-black" style={{ cursor: laser ? 'none' : showUi ? 'default' : 'none' }} onMouseMove={(e) => { setMouse({ x: e.clientX, y: e.clientY }); setShowUi(true); }} data-testid="present-root">
      <Player ref={player} presentation={doc} slides={visible} startIndex={start} width={vp.w} height={vp.h} autoPlay={autoPlay} paused={paused} onState={onState} onEnd={end} />
      {screen !== 'none' && <div className="absolute inset-0 z-30" style={{ background: screen }} onClick={() => setScreen('none')} />}
      {laser && mouse && <div className="pointer-events-none absolute z-40 h-4 w-4 rounded-full bg-red-500 shadow-[0_0_14px_6px_rgba(239,68,68,.75)]" style={{ left: mouse.x - 8, top: mouse.y - 8, animation: 'laser-pulse 1s infinite' }} />}
      <div className="pointer-events-none absolute bottom-0 left-0 z-20 h-1 bg-brand-500/90 transition-all" style={{ width: `${progress * 100}%` }} />
      {showTimer && <div className="absolute right-4 top-4 z-20 rounded-lg bg-black/60 px-3 py-1.5 font-mono text-sm text-white">{fmt(now - t0)}{mode === 'rehearsal' && <span className="ml-2 text-red-400">{tr('● REC')}</span>}</div>}
      <div className={`absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl bg-black/70 px-2 py-1.5 text-white backdrop-blur transition-opacity ${showUi ? 'opacity-100' : 'pointer-events-none opacity-0'}`} onClick={(e) => e.stopPropagation()}>
        <Btn title={tr('Previous (←)')} onClick={() => player.current?.prev()}><ChevronLeft size={16} /></Btn>
        <span className="min-w-[70px] text-center text-xs tabular-nums" data-testid="slide-counter">{st.index + 1} / {visible.length}{st.steps ? ` · ${st.step}/${st.steps}` : ''}</span>
        <Btn title={tr('Next (→ / Space)')} onClick={() => player.current?.next()}><ChevronRight size={16} /></Btn>
        <span className="mx-1 h-4 w-px bg-white/20" />
        <Btn title={autoPlay ? tr('Stop Auto Play (A)') : tr('Auto Play (A)')} active={autoPlay} onClick={() => setAutoPlay(!autoPlay)}><MonitorPlay size={15} /></Btn>
        {autoPlay && <Btn title={paused ? tr('Resume (P)') : tr('Pause (P)')} onClick={() => setPaused(!paused)}>{paused ? <Play size={15} /> : <Pause size={15} />}</Btn>}
        <Btn title={tr('Laser pointer (L)')} active={laser} onClick={() => setLaser(!laser)}><MousePointer2 size={15} /></Btn>
        <Btn title={tr('Timer (T)')} active={showTimer} onClick={() => setShowTimer(!showTimer)}><Timer size={15} /></Btn>
        <Btn title={tr('Presenter view (S)')} onClick={openPresenter}><PresentIcon size={15} /></Btn>
        <Btn title={tr('Fullscreen (F)')} onClick={() => void toggleFs()}><Maximize size={15} /></Btn>
        <Btn title={tr('Exit (Esc)')} onClick={end}><X size={16} /></Btn>
      </div>
      {rehearsalDone && <RehearsalResult doc={doc} times={rehearsalDone} onClose={onExit} />}
    </div>
  );
}

function Btn({ children, title, onClick, active }: { children: React.ReactNode; title: string; onClick: () => void; active?: boolean }) {
  return <button title={title} aria-label={title} onClick={onClick} className={`flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/15 ${active ? 'bg-white/20' : ''}`}>{children}</button>;
}

function RehearsalResult({ doc, times, onClose }: { doc: Presentation; times: Record<string, number>; onClose: () => void }) {
  const total = Object.values(times).reduce((a, b) => a + b, 0);
  const save = async () => {
    const next = { ...doc, slides: doc.slides.map((s) => (times[s.id] ? { ...s, duration: Math.round(times[s.id] / 100) * 100 } : s)) };
    const live = useEditor.getState();
    if (live.doc?.id === doc.id) live.commit('Rehearsed timings', (d) => { d.slides.forEach((s) => { if (times[s.id]) s.duration = Math.round(times[s.id] / 100) * 100; }); });
    else await storage.save(next);
    onClose();
  };
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70 p-6" onClick={(e) => e.stopPropagation()}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 text-ink-900 shadow-2xl dark:bg-ink-900 dark:text-white">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold"><Clock3 size={18} />{tr('Rehearsal finished')}</h2>
        <p className="mb-4 text-sm text-ink-500">{tr('Total time {time}. Save these timings as each slide\'s auto-advance duration?', { time: fmt(total) })}</p>
        <div className="mb-4 max-h-60 space-y-1 overflow-auto text-sm">
          {doc.slides.filter((s) => times[s.id]).map((s) => <div key={s.id} className="flex justify-between"><span className="truncate pr-4">{doc.slides.indexOf(s) + 1}. {s.title ?? s.id}</span><span className="tabular-nums">{fmt(times[s.id])}</span></div>)}
        </div>
        <div className="flex justify-end gap-2"><button className="rounded-lg px-3 py-2 text-sm" onClick={onClose}>{tr('Discard')}</button><button className="rounded-lg bg-brand-600 px-3 py-2 text-sm text-white" onClick={() => void save()}>{tr('Save timings')}</button></div>
      </div>
    </div>
  );
}

function PresenterView({ doc, start, onExit }: { doc: Presentation; start: number; onExit: () => void }) {
  useLang((s) => s.lang);
  const vp = useViewport();
  const visible = useMemo(() => doc.slides.filter((s) => !s.hidden), [doc]);
  const player = useRef<PlayerHandle>(null);
  const [st, setSt] = useState<PlayerState>({ index: start, step: 0, steps: 0, total: visible.length, transitioning: false });
  const [t0, setT0] = useState(Date.now());
  const [now, setNow] = useState(Date.now());
  const [slideStart, setSlideStart] = useState(Date.now());
  const channel = useSync(doc.id, (m) => player.current?.goto(m.index, m.step));
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i); }, []);
  const onState = useCallback((s: PlayerState) => { setSt((old) => { if (old.index !== s.index) setSlideStart(Date.now()); return s; }); channel.post({ type: 'goto', index: s.index, step: s.step }); }, [channel]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); player.current?.next(); }
      else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); player.current?.prev(); }
      else if (e.key === 'Escape') onExit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onExit]);
  const cur = visible[st.index];
  const nextSlide = visible[st.index + 1];
  const mainW = Math.min(vp.w * 0.62, (vp.h - 140) * (doc.size.width / doc.size.height));
  const mainH = mainW * (doc.size.height / doc.size.width);
  return (
    <div className="flex h-full flex-col bg-ink-950 text-white" data-testid="presenter-view">
      <div className="flex items-center gap-4 border-b border-white/10 px-5 py-2.5 text-sm">
        <span className="font-semibold">{tr('Presenter view')}</span>
        <span className="text-white/60">{doc.title}</span>
        <div className="flex-1" />
        <span className="font-mono text-lg tabular-nums">{fmt(now - t0)}</span>
        <span className="font-mono text-xs text-white/50">{tr('slide')} {fmt(now - slideStart)}</span>
        <button className="rounded-md bg-white/10 px-2 py-1 text-xs" onClick={() => setT0(Date.now())}>{tr('Reset timer')}</button>
        <button className="rounded-md bg-brand-600 px-2 py-1 text-xs" onClick={() => window.open(`/present/${doc.id}?mode=audience&start=${st.index}`, `audience-${doc.id}`)}>{tr('Open audience window')}</button>
        <button className="rounded-md bg-white/10 px-2 py-1 text-xs" onClick={onExit}>{tr('Exit')}</button>
      </div>
      <div className="flex min-h-0 flex-1 gap-5 p-5">
        <div className="flex flex-col gap-3">
          <div className="overflow-hidden rounded-lg ring-1 ring-white/15" style={{ width: mainW, height: mainH }}>
            <Player ref={player} presentation={doc} slides={visible} startIndex={start} width={mainW} height={mainH} onState={onState} />
          </div>
          <div className="flex items-center gap-2">
            <button className="rounded-lg bg-white/10 px-3 py-1.5 text-sm" onClick={() => player.current?.prev()}>{tr('← Previous')}</button>
            <button className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm" onClick={() => player.current?.next()}>{tr('Next →')}</button>
            <span className="text-sm text-white/60">{tr('Slide {n} of {total}', { n: st.index + 1, total: visible.length })}{st.steps ? ` · ${tr('animation')} ${st.step}/${st.steps}` : ''}</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div>
            <div className="mb-1.5 text-xs uppercase tracking-wider text-white/50">{tr('Next slide')}</div>
            {nextSlide ? <div className="overflow-hidden rounded-lg ring-1 ring-white/10"><SlideRenderer slide={nextSlide} presentation={doc} scale={Math.min(vp.w * 0.3, 520) / doc.size.width} mode="thumb" /></div> : <div className="rounded-lg bg-white/5 p-6 text-sm text-white/50">{tr('End of presentation')}</div>}
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-lg bg-white/5 p-4">
            <div className="mb-2 text-xs uppercase tracking-wider text-white/50">{tr('Speaker notes')}</div>
            <div className="whitespace-pre-wrap text-lg leading-relaxed" data-testid="speaker-notes">{cur?.notes || <span className="text-white/40">{tr('No notes for this slide.')}</span>}</div>
          </div>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto border-t border-white/10 p-3">
        {visible.map((s, i) => (
          <button key={s.id} onClick={() => player.current?.goto(i)} className={`shrink-0 overflow-hidden rounded ring-2 ${i === st.index ? 'ring-brand-500' : 'ring-transparent opacity-70 hover:opacity-100'}`}>
            <SlideRenderer slide={s} presentation={doc} scale={120 / doc.size.width} mode="thumb" />
          </button>
        ))}
      </div>
    </div>
  );
}
