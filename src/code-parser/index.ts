import type { Presentation } from '@/types/schema';
import { autoFix } from './autofix';
import { detectFormat, extractCodeBlocks } from './detect';
import { parseHtml, parseMarkdown, type DomParserLike } from './html-md';
import { parseJsModule } from './js';
import { parseJson } from './json';
import { mergeParts, normalizePresentation } from './normalize';
import { MAX_SOURCE_BYTES } from './security';
import { parseTsx } from './tsx';
import type { ImportReport, Issue, LocMap, SourceFormat } from './types';
import { validatePresentation } from './validate';

export * from './types';
export { autoFix } from './autofix';
export { normalizePresentation, normalizeElement, materializeSlide, normalizeParagraphs } from './normalize';
export { validatePresentation } from './validate';
export { detectFormat } from './detect';

export interface AnalyzeOptions { formatHint?: SourceFormat | string; domParser?: DomParserLike; autoFix?: boolean }
export interface Analysis {
  format: SourceFormat;
  data?: unknown;
  locs: LocMap;
  report: ImportReport;
}

function parseOne(code: string, format: SourceFormat, dom?: DomParserLike): { data?: unknown; locs: LocMap; issues: Issue[]; unsupported?: string[] } {
  switch (format) {
    case 'json': return parseJson(code);
    case 'js': return parseJsModule(code);
    case 'tsx': { const r = parseTsx(code); return { ...r, unsupported: r.unknownComponents.map((c) => `component.<${c}>`) }; }
    case 'html': return { ...parseHtml(code, dom), locs: new Map() };
    case 'markdown': return { ...parseMarkdown(code), locs: new Map() };
    default: return { locs: new Map(), issues: [{ severity: 'error', code: 'format.unknown', message: 'Could not detect the code format. Supported: SlideCraft JSON, JS object, TSX, HTML, Markdown.' }] };
  }
}

/** Parse + (optionally) auto-fix + validate. Never throws. */
export function analyzeCode(source: string, opts: AnalyzeOptions = {}): Analysis {
  const issues: Issue[] = [];
  let fixes: string[] = [];
  if (source.length > MAX_SOURCE_BYTES) {
    issues.push({ severity: 'error', code: 'limit.size', message: `Source is too large (${(source.length / 1e6).toFixed(1)} MB > 8 MB).` });
    return { format: 'unknown', locs: new Map(), report: makeReport('unknown', issues, [], fixes) };
  }
  const { blocks, langs } = extractCodeBlocks(source);
  const usable = blocks.map((b, i) => ({ code: b, lang: langs[i] })).filter((b) => b.code.trim());
  if (!usable.length) {
    issues.push({ severity: 'error', code: 'empty', message: 'Paste presentation code first.' });
    return { format: 'unknown', locs: new Map(), report: makeReport('unknown', issues, [], fixes) };
  }
  if (blocks.length > 1 || source.trim().startsWith('```')) issues.push({ severity: 'info', code: 'markdown.fence', message: `Removed markdown code fence${blocks.length > 1 ? `s (${blocks.length} blocks found)` : ''}.` });
  const hint = opts.formatHint && opts.formatHint !== 'unknown' ? String(opts.formatHint) : '';
  const results = usable.map((b) => {
    const format = detectFormat(b.code, hint || b.lang);
    return { format, ...parseOne(b.code, format, opts.domParser) };
  });
  const format = results[0].format;
  results.forEach((r) => issues.push(...r.issues));
  const unsupported = results.flatMap((r) => r.unsupported ?? []);
  const docs = results.map((r) => r.data).filter((d) => d !== undefined && d !== null);
  if (!docs.length) return { format, locs: results[0].locs, report: makeReport(format, issues, unsupported, fixes) };
  let data: unknown = docs[0];
  let locs = results[0].locs;
  // multi-part: several documents (e.g. 3 code blocks) or documents carrying `part`
  if (docs.length > 1) {
    const parts = docs as Record<string, unknown>[];
    data = mergeParts(parts as never);
    locs = new Map();
    issues.push({ severity: 'info', code: 'import.merged', message: `Merged ${docs.length} parts into one presentation.` });
  }
  if (opts.autoFix) {
    const r = autoFix(data);
    data = r.data;
    fixes = r.fixes;
  }
  const v = validatePresentation(data, locs);
  issues.push(...v.issues);
  return { format, data, locs, report: makeReport(format, issues, [...new Set([...unsupported, ...v.unsupported])], fixes, v.stats) };
}

function makeReport(format: SourceFormat, issues: Issue[], unsupported: string[], fixesApplied: string[], stats?: ImportReport['stats']): ImportReport {
  const errorCount = issues.filter((i) => i.severity === 'error').length;
  return {
    format,
    stats: stats ?? { slides: 0, elements: 0, images: 0, charts: 0, tables: 0, diagrams: 0, animations: 0, transitions: 0, morphs: 0, notes: 0 },
    issues,
    unsupported,
    fixesApplied,
    ok: errorCount === 0,
    errorCount,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    fixableCount: issues.filter((i) => i.fixable).length,
  };
}

/** Full pipeline used by Code Import → Build Presentation. */
export function importPresentation(source: string, opts: AnalyzeOptions = {}): { presentation?: Presentation; analysis: Analysis } {
  const analysis = analyzeCode(source, opts);
  if (!analysis.report.ok || !analysis.data) return { analysis };
  return { presentation: normalizePresentation(analysis.data), analysis };
}
