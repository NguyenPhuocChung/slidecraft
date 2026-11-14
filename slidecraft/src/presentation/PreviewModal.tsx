import { useEffect, useRef, useState } from 'react';
import { tr } from '@/i18n';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useEditor } from '@/stores/editor';
import { Player, type PlayerHandle, type PlayerState } from './Player';

/** In-editor preview of transitions + animations, starting at a slide index (includes hidden slides). */
export function PreviewModal({ startIndex, onClose, autoNext }: { startIndex: number; onClose: () => void; autoNext?: boolean }) {
  const doc = useEditor((s) => s.doc)!;
  const ref = useRef<PlayerHandle>(null);
  const [st, setSt] = useState<PlayerState | null>(null);
  const w = Math.min(window.innerWidth - 120, 1280);
  const h = (w * doc.size.height) / doc.size.width;
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (['ArrowRight', ' ', 'PageDown'].includes(e.key)) { e.preventDefault(); ref.current?.next(); }
      else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); ref.current?.prev(); }
    };
    window.addEventListener('keydown', k);
    const t = autoNext ? setTimeout(() => ref.current?.next(), 700) : undefined;
    return () => { window.removeEventListener('keydown', k); if (t) clearTimeout(t); };
  }, [onClose, autoNext]);
  return (
    <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center gap-3 bg-black/85 p-6" data-testid="preview-modal">
      <div className="overflow-hidden rounded-lg shadow-2xl" style={{ width: w, height: h }}>
        <Player ref={ref} presentation={doc} slides={doc.slides} startIndex={startIndex} width={w} height={h} onState={setSt} onEnd={onClose} />
      </div>
      <div className="flex items-center gap-2 text-white">
        <button className="rounded-lg bg-white/10 p-2 hover:bg-white/20" onClick={() => ref.current?.prev()} title={tr('Previous')}><ChevronLeft size={16} /></button>
        <span className="min-w-[110px] text-center text-sm tabular-nums">{tr('Slide')} {(st?.index ?? startIndex) + 1} / {doc.slides.length}{st?.steps ? ` · ${st.step}/${st.steps}` : ''}</span>
        <button className="rounded-lg bg-white/10 p-2 hover:bg-white/20" onClick={() => ref.current?.next()} title={tr('Next (click / →)')}><ChevronRight size={16} /></button>
        <button className="ml-4 rounded-lg bg-white/10 p-2 hover:bg-white/20" onClick={onClose} title={tr('Close (Esc)')}><X size={16} /></button>
      </div>
    </div>
  );
}
