import { useEffect, useState } from 'react';
import { tr } from '@/i18n';
import { Plus, Trash2, Upload, ClipboardPaste } from 'lucide-react';
import type { ChartContent } from '@/types/schema';
import { CHART_TYPES } from '@/types/registry';
import { ChartTypePicker } from '../pickers';
import { useEditor } from '@/stores/editor';
import { suggestChartType, chartMisuse } from '@/charts/suggest';
import { buildChartScene } from '@/charts/chartScene';
import { SceneSvg } from '@/charts/SceneSvg';
import { presentationTheme } from '@/slides/SlideRenderer';
import { Button, Modal, cx, inputCls, toast } from '@/components/ui';

import { type Grid, toGrid, fromGrid, convertContent, XY_TYPES, SINGLE_SERIES_TYPES } from './chartGrid';
export { parseNumber, toGrid, fromGrid, convertContent } from './chartGrid';

/** Human (Vietnamese via tr) message for a fromGrid error code. */
function errorText(code: string | undefined, grid: Grid): string | undefined {
  if (!code) return undefined;
  const [kind, r, c] = code.split(':');
  if (kind === 'cell') return tr('Row {row}, column "{col}": "{value}" is not a number.', { row: Number(r), col: grid[0]?.[Number(c)] ?? Number(c) + 1, value: grid[Number(r)]?.[Number(c)] ?? '' });
  if (kind === 'row') return tr('Row {row} needs numeric X and Y.', { row: Number(r) });
  if (kind === 'histogram') return tr('A histogram needs at least 2 numbers.');
  if (kind === 'negative') return tr('Pie and donut charts cannot show negative values.');
  if (kind === 'noseries') return tr('Add at least one data column.');
  return tr('Enter at least one row of data.');
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
  const el = useEditor((s) => s.doc?.slides.find((x) => x.id === s.currentSlideId)?.elements.find((e) => e.id === elementId));
  if (!elementId || !el || el.type !== 'chart' || !el.content) return null;
  return <ChartDataDialog key={elementId} elementId={elementId} onClose={onClose} />;
}

function ChartDataDialog({ elementId, onClose }: { elementId: string; onClose: () => void }) {
  const doc = useEditor((s) => s.doc);
  const slide = useEditor((s) => s.doc?.slides.find((x) => x.id === s.currentSlideId));
  const el = slide?.elements.find((e) => e.id === elementId);
  const initial = el?.content as ChartContent;
  const [base, setBase] = useState<ChartContent>(() => ({ ...initial, series: Array.isArray(initial?.series) ? initial.series : [] }));
  const [grid, setGrid] = useState<Grid>(() => toGrid(base));
  const [error, setError] = useState<string>();
  useEffect(() => { setError(undefined); }, [grid]);
  if (!el || !doc || !slide) return null;
  const type = base.chartType;
  const theme = presentationTheme(doc, slide);
  const parsed = fromGrid(grid, base);
  const preview = parsed.content;
  let scene: ReturnType<typeof buildChartScene> | null = null;
  try { scene = preview ? buildChartScene(preview, theme, 640, 400) : null; } catch { scene = null; }
  const sug = preview ? (() => { try { return suggestChartType(preview); } catch { return null; } })() : null;
  const misuse = preview ? (() => { try { return chartMisuse(preview); } catch { return null; } })() : null;
  const set = (r: number, c: number, v: string) => setGrid((g) => g.map((row, ri) => (ri === r ? row.map((x, ci) => (ci === c ? v : x)) : row)));
  const changeType = (v: ChartContent['chartType']) => {
    const cur = fromGrid(grid, base).content ?? base;
    const next = convertContent(cur, v);
    setBase(next); setGrid(toGrid(next));
  };
  const singleSeries = SINGLE_SERIES_TYPES.includes(type) || XY_TYPES.includes(type);
  const importXlsx = async (f: File) => {
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer());
      const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, blankrows: false }).map((r) => r.map((x) => String(x ?? '')));
      if (!rows.length) throw new Error(tr('Sheet is empty'));
      setGrid(rows);
      toast.success(tr('Imported {n} rows from {file}', { n: rows.length - 1, file: f.name }));
    } catch (e) { toast.error(`${tr('Could not read file')}: ${(e as Error).message}`); }
  };
  const apply = () => {
    if (!parsed.content) { setError(errorText(parsed.error, grid)); return; }
    const content = parsed.content;
    useEditor.getState().updateElements([el.id], (e) => { e.content = JSON.parse(JSON.stringify(content)) as never; }, 'Edit chart data');
    toast.success(tr('Chart updated'));
    onClose();
  };
  const msg = error ?? errorText(parsed.error, grid);
  const header = (ci: number, v: string) => (ci === 0 ? (XY_TYPES.includes(type) ? v : tr(v === 'Category' ? 'Category' : v)) : v);
  return (
    <Modal open onClose={onClose} title={tr('Chart data')} width={1100} testId="chart-editor" footer={<><Button onClick={onClose}>{tr('Cancel')}</Button><Button variant="primary" onClick={apply} disabled={!parsed.content} data-testid="chart-apply">{tr('Apply')}</Button></>}>
      <div className="grid gap-4 md:grid-cols-[1fr_420px]">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <ChartTypePicker value={type} onChange={changeType} />
            <Button size="sm" icon={<Plus size={12} />} onClick={() => setGrid((g) => [...g, new Array(g[0]?.length ?? 2).fill('')])} data-testid="chart-add-row">{tr('Add row')}</Button>
            <Button size="sm" icon={<Plus size={12} />} disabled={singleSeries} title={singleSeries ? tr('This chart type shows a single data series.') : undefined} onClick={() => setGrid((g) => g.map((r, i) => [...r, i === 0 ? `${tr('Series')} ${r.length}` : '']))} data-testid="chart-add-series">{tr('Add series')}</Button>
            <Button size="sm" icon={<ClipboardPaste size={12} />} onClick={async () => { try { const t = await navigator.clipboard.readText(); const rows = parseDelimited(t); if (rows.length) { setGrid(rows); toast.success(tr('Pasted data')); } } catch { toast.info(tr('Use Ctrl+V inside the paste box below.')); } }}>{tr('Paste (Excel/CSV)')}</Button>
            <label className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-lg border border-ink-200 px-2.5 text-xs dark:border-ink-700"><Upload size={12} />{tr('Import XLSX/CSV')}<input type="file" hidden accept=".xlsx,.xls,.csv,.tsv" onChange={(e) => { const f = e.target.files?.[0]; if (f) void importXlsx(f); e.target.value = ''; }} /></label>
          </div>
          <div className="max-h-[52vh] overflow-auto rounded-lg border border-ink-200 dark:border-ink-700">
            <table className="w-full border-collapse text-xs">
              <tbody>{grid.map((r, ri) => (
                <tr key={ri} className={ri === 0 ? 'bg-ink-50 dark:bg-ink-850' : ''}>
                  {r.map((cell, ci) => <td key={ci} className="border border-ink-100 p-0 dark:border-ink-800"><input data-testid={`chart-cell-${ri}-${ci}`} className={cx('w-full min-w-[80px] bg-transparent px-2 py-1 outline-none focus:bg-brand-50 dark:focus:bg-brand-500/10', ri === 0 && 'font-semibold', ci > 0 && ri > 0 && 'text-right tabular-nums')} value={ri === 0 ? header(ci, cell) : cell} onChange={(e) => set(ri, ci, e.target.value)} onPaste={(e) => { const t = e.clipboardData.getData('text'); if (t.includes('\t') || t.includes('\n')) { e.preventDefault(); const rows = parseDelimited(t); setGrid((g) => { const out = g.map((x) => [...x]); rows.forEach((row, dr) => row.forEach((v, dc) => { const R = ri + dr, C = ci + dc; while (out.length <= R) out.push(new Array(out[0].length).fill('')); while (out[R].length <= C) out.forEach((x) => x.push('')); out[R][C] = v; })); return out; }); } }} /></td>)}
                  <td className="w-8 border border-ink-100 text-center dark:border-ink-800">{ri > 0 && grid.length > 2 && <button title={tr('Delete row')} onClick={() => setGrid((g) => g.filter((_, i) => i !== ri))}><Trash2 size={12} className="text-ink-400 hover:text-red-600" /></button>}</td>
                </tr>
              ))}
              <tr><td />{(grid[0] ?? []).slice(1).map((_, ci) => <td key={ci} className="text-center">{grid[0].length > 2 && !XY_TYPES.includes(type) && <button title={tr('Delete series')} onClick={() => setGrid((g) => g.map((r) => r.filter((__, i) => i !== ci + 1)))}><Trash2 size={12} className="text-ink-400 hover:text-red-600" /></button>}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <textarea className={cx(inputCls, 'h-14 py-1 text-[11px]')} placeholder={tr('…or paste tab/comma-separated data from Excel, Google Sheets or a CSV here')} onPaste={(e) => { e.preventDefault(); const rows = parseDelimited(e.clipboardData.getData('text')); if (rows.length) setGrid(rows); }} />
          <p className="rounded-lg bg-ink-50 p-2 text-[11px] leading-relaxed text-ink-500 dark:bg-ink-850 dark:text-ink-300" data-testid="chart-number-hint">{tr('Number format: "1,5" or "1.5" = one point five; "1.240" or "1.240.000" = thousands. Symbols like %, đ, $ are ignored. Leave a cell empty for "no data".')}</p>
          {msg && <p className="text-xs text-red-600" data-testid="chart-error">{msg}</p>}
        </div>
        <div className="space-y-2">
          <div className="aspect-[16/10] rounded-xl border border-ink-200 p-3 dark:border-ink-700" style={{ background: theme.colors.background }}>
            {scene && <SceneSvg scene={scene} />}
          </div>
          {sug && sug.type !== type && <button className="w-full rounded-lg border border-brand-200 bg-brand-50 p-2 text-left text-xs text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200" onClick={() => changeType(sug.type)}><b>{tr('Suggestion')}: {tr(CHART_TYPES[sug.type].label)}.</b> {tr(sug.reason)}</button>}
          {misuse && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">{tr(misuse)}</p>}
          <p className="text-[11px] text-ink-400">{tr(CHART_TYPES[type].use)}. {tr('Values are never changed automatically.')}</p>
        </div>
      </div>
    </Modal>
  );
}
