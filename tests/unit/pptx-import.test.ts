import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { SAMPLES } from '@/samples';
import { importPresentation } from '@/code-parser';
import { exportPptx, validatePptx } from '@/pptx-export';
import { importPptx } from '@/pptx-import';
import { trPptx } from '@/services/pptxImport';
import { useLang } from '@/i18n';
import type { Presentation, SlideElement } from '@/types/schema';

/* eslint-disable @typescript-eslint/no-explicit-any */
const flat = (els: SlideElement[]): SlideElement[] => els.flatMap((e) => (e.type === 'group' ? [e, ...flat(e.content?.children ?? [])] : [e]));
const words = (s: string) => s.toLowerCase().normalize('NFC').split(/[^\p{L}\p{N}%$.]+/u).filter((w) => w.length > 1);
function slideText(els: SlideElement[]): string {
  return flat(els).map((e) => {
    const c = e.content ?? {};
    if (c.paragraphs) return (c.paragraphs as any[]).map((p) => p.runs.map((r: any) => r.text).join('')).join(' ');
    if (c.rows) return (c.rows as string[][]).flat().join(' ');
    return '';
  }).join(' ');
}

describe('PPTX import — round trip of the 5 samples (export → import)', () => {
  for (const sample of SAMPLES) {
    it(`re-imports "${sample.title}"`, async () => {
      const { presentation: src } = importPresentation(JSON.stringify(sample.data));
      const p = src!;
      const { blob } = await exportPptx(p);
      const { presentation: q, report } = await importPptx(blob as Uint8Array, { fileName: `${sample.id}.pptx` });
      expect(q.slides.length).toBe(p.slides.length);
      expect(q.size).toEqual(p.size);
      expect(q.aspectRatio).toBe(p.aspectRatio);
      expect(report.stats.slides).toBe(p.slides.length);
      for (let i = 0; i < p.slides.length; i++) {
        const a = p.slides[i], b = q.slides[i];
        const tag = `slide ${i + 1}`;
        // notes
        if (a.notes) expect(b.notes?.replace(/\s+/g, ' ').trim(), tag).toBe(a.notes.replace(/\s+/g, ' ').trim());
        expect(!!b.hidden, tag).toBe(!!a.hidden);
        // text ≥ 90 % of words
        const wa = words(slideText(a.elements)), wb = new Set(words(slideText(b.elements)));
        if (wa.length) {
          const kept = wa.filter((w) => wb.has(w)).length / wa.length;
          expect(kept, `${tag} text kept ${(kept * 100).toFixed(0)}% missing: ${wa.filter((w) => !wb.has(w)).slice(0, 8).join(', ')}`).toBeGreaterThanOrEqual(0.9);
        }
        // charts: same categories & values
        const ca = flat(a.elements).filter((e) => e.type === 'chart' && ['bar', 'column', 'stackedBar', 'line', 'area', 'pie', 'donut', 'radar', 'scatter', 'bubble', 'combo'].includes(e.content.chartType));
        const cb = flat(b.elements).filter((e) => e.type === 'chart');
        expect(cb.length, `${tag} charts`).toBe(ca.length);
        ca.forEach((x, k) => {
          const y = cb[k];
          if (x.content.categories) expect(y.content.categories, `${tag} chart categories`).toEqual(x.content.categories.map(String));
          x.content.series.forEach((s: any, si: number) => {
            if (s.values) expect(y.content.series[si].values, `${tag} chart values`).toEqual(s.values);
            if (s.points) expect(y.content.series[si].points.map((pt: any) => [pt.x, pt.y]), `${tag} points`).toEqual(s.points.map((pt: any) => [pt.x, pt.y]));
          });
          const type = x.content.chartType;
          const expected = type === 'stackedBar' ? 'stackedBar' : type;
          expect(y.content.chartType, `${tag} chart type`).toBe(expected);
        });
        // tables
        const ta = flat(a.elements).filter((e) => e.type === 'table');
        const tb = flat(b.elements).filter((e) => e.type === 'table');
        expect(tb.length, `${tag} tables`).toBe(ta.length);
        ta.forEach((x, k) => expect(tb[k].content.rows, `${tag} table rows`).toEqual(x.content.rows));
        // transitions
        if (a.transition && a.transition.type !== 'none') {
          expect(b.transition?.type, `${tag} transition`).toBe(a.transition.type);
          if (a.transition.direction && ['push', 'wipe', 'cover', 'uncover', 'split'].includes(a.transition.type)) expect(b.transition?.direction, `${tag} transition direction`).toBe(a.transition.direction);
        }
        // morph keeps element ids
        if (a.transition?.type === 'morph') {
          const prevIds = new Set(p.slides[i - 1]?.elements.map((e) => e.id));
          const shared = a.elements.filter((e) => prevIds.has(e.id)).map((e) => e.id);
          const bIds = new Set(b.elements.map((e) => e.id));
          for (const id of shared) expect(bIds.has(id), `${tag} morph id ${id}`).toBe(true);
        }
        // animations survive (count of exportable ones, attached to the same element ids)
        const animated = a.elements.filter((e) => e.animation?.some((x) => x.trigger !== 'onExit'));
        for (const e of animated) {
          const be = b.elements.find((x) => x.id === e.id);
          if (be) expect(be.animation?.length ?? 0, `${tag} animations on ${e.id}`).toBeGreaterThan(0);
        }
      }
      // images become assets
      for (const a of q.assets) expect(a.src).toMatch(/^data:(image|video|audio)\//);
      const imgEls = q.slides.flatMap((s) => flat(s.elements)).filter((e) => e.type === 'image' && String(e.content?.src ?? '').startsWith('asset:'));
      for (const e of imgEls) expect(q.assets.some((a) => `asset:${a.id}` === e.content.src)).toBe(true);
      // re-export of the imported deck must be valid too
      const again = await exportPptx(q);
      const v = await validatePptx(again.blob as Uint8Array, q.slides.length);
      expect(v.ok, JSON.stringify(v.checks.filter((c) => !c.ok))).toBe(true);
    }, 90000);
  }
});

describe('PPTX import — robustness', () => {
  it('translates report messages to Vietnamese', () => {
    useLang.setState({ lang: 'vi' });
    expect(trPptx('Slide 3: picture "Logo" could not be read; an image placeholder was inserted.')).toBe('Trang 3: không đọc được ảnh "Logo"; đã chèn khung ảnh trống.');
    expect(trPptx('Slide 2: merged table cells are imported as separate cells.')).toBe('Trang 2: ô bảng gộp được nhập thành các ô riêng.');
    expect(trPptx('12 slide(s), 80 object(s), 3 picture(s), 2 chart(s), 1 table(s) imported.')).toBe('Đã nhập 12 trang, 80 đối tượng, 3 ảnh, 2 biểu đồ, 1 bảng.');
    useLang.setState({ lang: 'en' });
    expect(trPptx('Slide 2: ink drawings are not imported.')).toBe('Slide 2: ink drawings are not imported.');
  });

  it('rejects non-pptx data with a clear message', async () => {
    await expect(importPptx(new Uint8Array([1, 2, 3, 4]))).rejects.toThrow(/not a valid PowerPoint/);
  });

  it('keeps notes, hidden slides, transitions, animations and morph ids', async () => {
    const deck: Presentation = importPresentation(JSON.stringify({
      schemaVersion: '1.0', title: 'Mini', theme: 'dark-premium',
      slides: [
        { id: 's1', notes: 'Xin chào các bạn', elements: [
          { id: 'title', type: 'heading', x: 100, y: 100, width: 1200, height: 160, content: { text: 'Tiêu đề **đậm** và *nghiêng*' }, style: { fontSize: 72, color: '#FFCC00' }, animation: [{ effect: 'flyIn', direction: 'left', trigger: 'onClick', duration: 800 }] },
          { id: 'box', type: 'shape', x: 200, y: 400, width: 400, height: 200, content: { shape: 'ellipse', text: 'Hello' }, style: { fill: '#2563EB' } },
          { id: 'arrow', type: 'arrow', x: 0, y: 0, width: 1, height: 1, content: { x1: 700, y1: 500, x2: 1100, y2: 700 } },
        ] },
        { id: 's2', hidden: true, transition: { type: 'morph', duration: 1200 }, elements: [
          { id: 'box', type: 'shape', x: 900, y: 300, width: 600, height: 300, content: { shape: 'ellipse', text: 'Hello' }, style: { fill: '#16A34A' } },
          { id: 'list', type: 'paragraph', x: 100, y: 700, width: 1000, height: 300, content: { text: '- one\n- two\n  - nested' } },
        ] },
      ],
    })).presentation!;
    const { blob } = await exportPptx(deck);
    const { presentation: q, report } = await importPptx(blob as Uint8Array);
    expect(q.slides[0].notes).toBe('Xin chào các bạn');
    expect(q.slides[1].hidden).toBe(true);
    expect(q.slides[1].transition?.type).toBe('morph');
    expect(q.slides[1].elements.some((e) => e.id === 'box')).toBe(true);
    const title = q.slides[0].elements.find((e) => e.id === 'title')!;
    expect(title.type).toBe('heading');
    expect(title.style?.fontSize).toBeCloseTo(72, 0);
    expect(title.style?.color).toBe('#FFCC00');
    const runs = title.content.paragraphs[0].runs;
    // heading weight makes every run bold → bold moves to the element style
    expect(title.style?.fontWeight).toBe(700);
    expect(runs.map((r: any) => r.text).join('')).toBe('Tiêu đề đậm và nghiêng');
    expect(runs.find((r: any) => r.text === 'nghiêng')?.italic).toBe(true);
    expect(title.animation?.[0]).toMatchObject({ effect: 'flyIn', direction: 'left', trigger: 'onClick', duration: 800 });
    const box = q.slides[0].elements.find((e) => e.id === 'box')!;
    expect(box.content.shape).toBe('ellipse');
    expect(box.style?.fill).toBe('#2563EB');
    const arrow = q.slides[0].elements.find((e) => e.id === 'arrow')!;
    expect(arrow.type).toBe('arrow');
    expect(arrow.content).toMatchObject({ x1: 700, y1: 500, x2: 1100, y2: 700 });
    const list = q.slides[1].elements.find((e) => e.id === 'list')!;
    expect(list.content.paragraphs.map((p: any) => [p.list, p.level ?? 0])).toEqual([['bullet', 0], ['bullet', 0], ['bullet', 1]]);
    expect(report.stats.notes).toBe(1);
  });
});

/* ------------- decks made by other tools (python-pptx / LibreOffice) ------------- */
function hasPythonPptx(): boolean {
  const r = spawnSync('python3', ['-c', 'import pptx'], { encoding: 'utf8' });
  return r.status === 0;
}
const SCRIPT = path.resolve(__dirname, '../../scripts/make-test-pptx.py');

describe.skipIf(!hasPythonPptx())('PPTX import — deck generated by python-pptx', () => {
  it('imports placeholders, bullets, table, chart, picture, group, notes', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-pptx-'));
    const file = path.join(dir, 'pp.pptx');
    execFileSync('python3', [SCRIPT, file], { stdio: 'pipe' });
    const { presentation: q, report } = await importPptx(fs.readFileSync(file), { fileName: 'pp.pptx' });
    expect(q.slides.length).toBe(5);
    expect(q.aspectRatio).toBe('16:9');
    const all = q.slides.map((s) => slideText(s.elements)).join(' ');
    for (const w of ['Quarterly', 'Review', 'Agenda', 'Revenue', 'grew', 'Region', 'North', 'Sales', 'Grouped', 'Ghi chú']) expect(all.includes(w) || q.slides.some((s) => s.notes?.includes(w)), w).toBe(true);
    // title placeholder → heading with inherited position
    const t = q.slides[0].elements.find((e) => e.type === 'heading')!;
    expect(t).toBeTruthy();
    expect(t.width).toBeGreaterThan(400);
    // bullets from body placeholder (inherited from master bodyStyle)
    const body = q.slides[1].elements.find((e) => e.content?.paragraphs?.some((p: any) => p.list === 'bullet'));
    expect(body, 'bulleted body').toBeTruthy();
    expect(body!.content.paragraphs.some((p: any) => (p.level ?? 0) === 1)).toBe(true);
    // table
    const table = q.slides[2].elements.find((e) => e.type === 'table')!;
    expect(table.content.rows[0]).toEqual(['Region', 'Q1', 'Q2']);
    // chart
    const chart = q.slides[3].elements.find((e) => e.type === 'chart')!;
    expect(chart.content.chartType).toBe('column');
    expect(chart.content.categories).toEqual(['Jan', 'Feb', 'Mar']);
    expect(chart.content.series[0].values).toEqual([10, 20, 15]);
    // picture + group
    expect(q.assets.length).toBeGreaterThanOrEqual(1);
    expect(q.slides[4].elements.some((e) => e.type === 'image')).toBe(true);
    const grp = q.slides[4].elements.find((e) => e.type === 'group')!;
    expect(grp.content.children.length).toBe(2);
    expect(q.slides[4].notes).toContain('Ghi chú');
    expect(report.stats.notes).toBeGreaterThanOrEqual(1);
  }, 60000);
});

function hasSoffice(): boolean {
  const r = spawnSync('soffice', ['--version'], { encoding: 'utf8', timeout: 20000 });
  return r.status === 0;
}
describe.skipIf(!hasPythonPptx() || !hasSoffice())('PPTX import — deck re-saved by LibreOffice', () => {
  it('imports a LibreOffice-written pptx', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sc-lo-'));
    const src = path.join(dir, 'src.pptx');
    execFileSync('python3', [SCRIPT, src], { stdio: 'pipe' });
    // round trip through ODP so LibreOffice writes the pptx itself
    execFileSync('soffice', ['--headless', '--convert-to', 'odp', '--outdir', dir, src], { stdio: 'pipe', timeout: 120000 });
    const outDir = path.join(dir, 'out');
    fs.mkdirSync(outDir);
    execFileSync('soffice', ['--headless', '--convert-to', 'pptx', '--outdir', outDir, path.join(dir, 'src.odp')], { stdio: 'pipe', timeout: 120000 });
    const { presentation: q } = await importPptx(fs.readFileSync(path.join(outDir, 'src.pptx')));
    expect(q.slides.length).toBe(5);
    const all = q.slides.map((s) => slideText(s.elements)).join(' ');
    for (const w of ['Quarterly', 'Agenda', 'Region', 'North']) expect(all).toContain(w);
  }, 240000);
});
