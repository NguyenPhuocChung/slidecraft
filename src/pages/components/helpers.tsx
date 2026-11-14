import { useEffect, useState } from 'react';
import type { Presentation } from '@/types/schema';
import { storage } from '@/services/storage';
import { SlideRenderer } from '@/slides/SlideRenderer';
import { loadFonts } from '@/hooks/useFonts';
import { getTheme } from '@/themes/themes';
import { tr } from '@/i18n';

export function relativeTime(ts: number | string | undefined): string {
  if (!ts) return '';
  const t = typeof ts === 'string' ? Date.parse(ts) : ts;
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 45) return tr('just now');
  const m = Math.round(s / 60);
  if (m < 60) return tr('{n} min ago', { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return tr('{n} h ago', { n: h });
  const d = Math.round(h / 24);
  if (d < 30) return tr('{n} d ago', { n: d });
  return new Date(t).toLocaleDateString();
}

export function download(text: string | Blob, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = typeof text === 'string' ? new Blob([text], { type }) : text;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export const slug = (s: string) => (s || 'presentation').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'presentation';

export function presentationFonts(p: Presentation) {
  const t = getTheme(p.theme, p.themeOverrides);
  loadFonts([t.fonts.heading, t.fonts.body]);
}

/** First-slide live preview of a stored project, loaded lazily when visible. */
export function ProjectThumb({ id, width }: { id: string; width: number }) {
  const [doc, setDoc] = useState<Presentation | null>(null);
  const [visible, setVisible] = useState(false);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!el) return;
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setVisible(true); io.disconnect(); } }, { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, [el]);
  useEffect(() => { if (visible) void storage.load(id).then((p) => { if (p) { presentationFonts(p); setDoc(p); } }); }, [visible, id]);
  const h = doc ? (width * doc.size.height) / doc.size.width : (width * 9) / 16;
  return (
    <div ref={setEl} style={{ width, height: h }} className="overflow-hidden bg-ink-100 dark:bg-ink-800">
      {doc?.slides[0] && <SlideRenderer slide={doc.slides[0]} presentation={doc} scale={width / doc.size.width} mode="thumb" />}
    </div>
  );
}

/** Measure the width of a container (for responsive thumbnails). */
export function useWidth<T extends HTMLElement>(): [(n: T | null) => void, number] {
  const [node, setNode] = useState<T | null>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    if (!node) return;
    const ro = new ResizeObserver(() => setW(node.clientWidth));
    ro.observe(node);
    setW(node.clientWidth);
    return () => ro.disconnect();
  }, [node]);
  return [setNode, w];
}
