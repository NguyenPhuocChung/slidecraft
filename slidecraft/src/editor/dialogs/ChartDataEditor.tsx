import { useEffect, useState } from 'react';
import { tr } from '@/i18n';
import { Plus, Trash2, Upload, ClipboardPaste } from 'lucide-react';
import type { ChartContent } from '@/types/schema';
import { CHART_TYPES, CHART_TYPE_IDS } from '@/types/registry';
import { useEditor } from '@/stores/editor';
import { suggestChartType, chartMisuse } from '@/charts/suggest';
import { buildChartScene } from '@/charts/chartScene';
import { SceneSvg } from '@/charts/SceneSvg';
import { presentationTheme } from '@/slides/SlideRenderer';
import { Button, Modal, Select, cx, inputCls, toast } from '@/components/ui';

type Grid = string[][]; // [0] = header: ['Category', series names...]

function toGrid(c: ChartContent): Grid {
  if (c.chartType === 'scatter' || c.chartType === 'bubble') {
    const rows: Grid = [['Series', 'X', 'Y', 'Size', 'Label']];
    c.series.forEach((s) => (s.points ?? []).forEach((p) => rows.push([s.name, String(p.x), String(p.y), p.size === undefined ? '' : String(p.size), p.label ?? ''])));
    return rows;
  }
  if (c.chartType === 'histogram') return [['Value'], ...(c.series[0]?.values ?? []).map((v) => [v === null ? '' : String(v)])];
  const cats = c.categories ?? [];
  return [['Category', ...c.series.map((s) => s.name)], ...cats.map((cat, i) => [cat, ...c.series.map((s) => (s.values?.[i] ?? '') === null ? '' : String(s.values?.[i] ?? ''))])];
}
function fromGrid(g: Grid, base: ChartContent): { content?: ChartContent; error?: string } {
  const num = (s: string) => { const t = s.replace(/[\s,$€£%]/g, ''); if (t === '') return null; const n = Number(t); return Number.isFinite(n) ? n : NaN; };
  if (base.chartType === 'scatter' || base.chartType === 'bubble') {
    const map = new Map<string, NonNullable<ChartContent['series'][number]['points']>>();
    for (const r of g.slice(1)) {
      if (!r.some((x) => x.trim())) continue;
      const x = num(r[1] ?? ''), y = num(r[2] ?? ''), size = num(r[3] ?? '');
      if (x === null || y === null || Number.isNaN(x) || Number.isNaN(y)) return { error: tr('Row "{row}" needs numeric X and Y.', { row: r.join(', ') }) };
      const list = map.get(r[0] || 'Series 1') ?? [];
      list.push({ x, y, ...(size !== null && !Number.isNaN(size) ? { size } : {}), ...(r[4] ? { label: r[4] } : {}) });
      map.set(r[0] || 'Series 1', list);
    }
    return { content: { ...base, categories: undefined, series: [...map.entries()].map(([name, points], i) => ({ name, points, color: base.series[i]?.color })) } };
  }
  if (base.chartType === 'histogram') {
    const values = g.slice(1).map((r) => num(r[0] ?? '')).filter((v): v is number => v !== null && !Number.isNaN(v));
    return { content: { ...base, series: [{ name: base.series[0]?.name ?? 'Values', values }] } };
  }
  const header = g[0];
  const rows = g.slice(1).filter((r) => r.some((x) => x.trim()));
  const series = header.slice(1).map((name, si) => ({ ...(base.series[si] ?? {}), name: name || `Series ${si + 1}`, values: rows.map((r) => num(r[si + 1] ?? '')) }));
  for (const s of series) if (s.values.some((v) => Number.isNaN(v))) return { error: tr('Series "{name}" contains a non-numeric value.', { name: s.name }) };
  return { content: { ...base, categories: rows.map((r) => r[0]), series: series as ChartContent['series'] } };
}

export function parseDelimited(text: string): Grid {
  const lines = text.replace(/\r/g, '').split('\n').filter((l) => l.length);
  const delim = lines[0]?.includes('\t') ? '\t' : lines[0]?.includes(';') && !lines[0].includes(',') ? ';' : ',';
  return lines.map((l) => {
    const out: string[] = []; let cur = ''; let q = false;
    for (let i = 0; i < l.length; i++) {
      const ch = l[i];
      if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; }
      else if (ch === delim && !q) { out.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    out.push(cur.trim());
    return out;
  });
}

export function ChartDataEditor({ elementId, onClose }: { elementId: string | null; onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const slide = useEditor((s) => s.doc?.slides.find((x) => x.id === s.currentSlideId));
  const el = slide?.elements.find((e) => e.id === elementId);
  const [grid, setGrid] = useState<Grid>([]);
  const [type, setType] = useState<ChartContent['chartType']>('column');
  const [error, setError] = useState<string>();
  useEffect(() => { if (el) { setGrid(toGrid(el.content)); setType(el.content.chartType); setError(undefined); } }, [elementId]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!el || !doc || !slide) return null;
  const theme = presentationTheme(doc, slide);
  const parsed = fromGrid(grid, { ...el.content, chartType: type });
  const preview = parsed.content;
  const sug = preview ? suggestChartType(preview) : null;
  const misuse = preview ? chartMisuse(preview) : null;
  const set = (r: number, c: number, v: string) => setGrid((g) => g.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? v : x)) : row)));
  const importXlsx = async (f: File) => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, blankrows: false }).map((r) => r.map((x) => String(x ?? '')));
      if (!rows.length) throw new Error('Sheet is empty');
      setGrid(rows);
      toast.success(tr('Imported {n} rows from {file}', { n: rows.length - 1, file: f.name }));
    } catch (e) { toast.error(`${tr('Could not read file')}: ${(e as Error).message}`); }
  };
  const apply = () => {
    if (!parsed.content) { setError(parsed.error); return; }
    useEditor.getState().updateElements([el.id], (e) => { e.content = parsed.content as never; }, 'Edit chart data');
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={tr('Chart data')} width={1100} testId="chart-editor" footer={<><Button onClick={onClose}>{tr('Cancel')}</Button><Button variant="primary" onClick={apply} disabled={!parsed.content} data-testid="chart-apply">{tr('Apply')}</Button></>}>
      <div className="grid gap-4 md:grid-cols-[1fr_420px]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Select value={type} options={CHART_TYPE_IDS.map((t) => ({ value: t, label: tr(CHART_TYPES[t].label) }))} onChange={(v) => { setType(v); setGrid(toGrid({ ...el.content, ...(fromGrid(grid, { ...el.content, chartType: type }).content ?? {}), chartType: v })); }} className="w-44" />
            <Button size="sm" icon={<Plus size={12} />} onClick={() => setGrid((g) => [...g, new Array(g[0]?.length ?? 2).fill('')])}>{tr('Row')}</Button>
            <Button size="sm" icon={<Plus size={12} />} disabled={['scatter', 'bubble', 'histogram', 'pie', 'donut', 'funnel', 'treemap', 'waterfall'].includes(type)} onClick={() => setGrid((g) => g.map((r, i) => [...r, i === 0 ? `${tr('Series')} ${r.length}` : '']))}>{tr('Series')}</Button>
            <Button size="sm" icon={<ClipboardPaste size={12} />} onClick={async () => { try { const t = await navigator.clipboard.readText(); const rows = parseDelimited(t); if (rows.length) { setGrid(rows); toast.success(tr('Pasted data')); } } catch { toast.info(tr('Use Ctrl+V inside the paste box below.')); } }}>{tr('Paste (Excel/CSV)')}</Button>
            <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-ink-200 px-2.5 text-xs dark:border-ink-700"><Upload size={12} />{tr('Import XLSX/CSV')}<input type="file" hidden accept=".xlsx,.xls,.csv,.tsv" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importXlsx(f); e.target.value = ''; }} /></label>
          </div>
          <div className="max-h-[52vh] overflow-auto rounded-lg border border-ink-200 dark:border-ink-700">
            <table className="w-full border-collapse text-xs">
              <tbody>{grid.map((r, ri) => (
                <tr key={ri} className={ri === 0 ? 'bg-ink-50 dark:bg-ink-850' : ''}>
                  {r.map((cell, ci) => <td key={ci} className="border border-ink-100 p-0 dark:border-ink-800"><input className={cx('w-full min-w-[80px] bg-transparent px-2 py-1 outline-none focus:bg-brand-50 dark:focus:bg-brand-500/10', ri === 0 && 'font-semibold', ci > 0 && ri > 0 && 'text-right tabular-nums')} value={cell} onChange={(e) => set(ri, ci, e.target.value)} onPaste={(e) => { const t = e.clipboardData.getData('text'); if (t.includes('\t') || t.includes('\n')) { e.preventDefault(); const rows = parseDelimited(t); setGrid((g) => { const out = g.map((x) => [...x]); rows.forEach((row, dr) => row.forEach((v, dc) => { const R = ri + dr, C = ci + dc; while (out.length <= R) out.push(new Array(out[0].length).fill('')); while (out[R].length <= C) out.forEach((x) => x.push('')); out[R][C] = v; })); return out; }); } }} /></td>)}
                  <td className="w-8 border border-ink-100 text-center dark:border-ink-800">{ri > 0 && <button title={tr('Delete row')} onClick={() => setGrid((g) => g.filter((_, i) => i !== ri))}><Trash2 size={12} className="text-ink-400 hover:text-red-600" /></button>}</td>
                </tr>
              ))}
              <tr><td />{(grid[0] ?? []).slice(1).map((_, ci) => <td key={ci} className="text-center">{grid[0].length > 2 && !['scatter', 'bubble'].includes(type) && <button title={tr('Delete series')} onClick={() => setGrid((g) => g.map((r) => r.filter((__, i) => i !== ci + 1)))}><Trash2 size={12} className="text-ink-400 hover:text-red-600" /></button>}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <textarea className={cx(inputCls, 'h-16 py-1 text-[11px]')} placeholder={tr('…or paste tab/comma-separated data from Excel, Google Sheets or a CSV here')} onPaste={(e) => { e.preventDefault(); const rows = parseDelimited(e.clipboardData.getData('text')); if (rows.length) setGrid(rows); }} />
          {(error || parsed.error) && <p className="text-xs text-red-600">{error ?? parsed.error}</p>}
        </div>
        <div className="space-y-2">
          <div className="aspect-[16/10] rounded-xl border border-ink-200 p-3 dark:border-ink-700" style={{ background: theme.colors.background }}>
            {preview && <SceneSvg scene={buildChartScene(preview, theme, 640, 400)} />}
          </div>
          {sug && sug.type !== type && <button className="w-full rounded-lg border border-brand-200 bg-brand-50 p-2 text-left text-xs text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200" onClick={() => { setType(sug.type); setGrid(toGrid({ ...preview!, chartType: sug.type })); }}><b>{tr('Suggestion')}: {tr(CHART_TYPES[sug.type].label)}.</b> {tr(sug.reason)}</button>}
          {misuse && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{tr(misuse)}</p>}
          <p className="text-[11px] text-ink-400">{tr(CHART_TYPES[type].use)}. {tr('Values are never changed automatically.')}</p>
        </div>
      </div>
    </Modal>
  );
}
