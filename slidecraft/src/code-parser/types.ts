export type SourceFormat = 'json' | 'js' | 'tsx' | 'html' | 'markdown' | 'unknown';

export interface SourceLoc { line: number; column: number }
export type LocMap = Map<string, SourceLoc>;

export type Severity = 'error' | 'warning' | 'info';
export interface Issue {
  severity: Severity;
  code: string;
  message: string;
  path?: string;
  line?: number;
  column?: number;
  fixable?: boolean;
  slideIndex?: number;
}

export interface ImportStats {
  slides: number;
  elements: number;
  images: number;
  charts: number;
  tables: number;
  diagrams: number;
  animations: number;
  transitions: number;
  morphs: number;
  notes: number;
}

export interface ParseResult {
  format: SourceFormat;
  data?: unknown;
  locs: LocMap;
  issues: Issue[];
  /** number of documents found in the input (multi-part imports) */
  parts: number;
}

export interface ImportReport {
  format: SourceFormat;
  stats: ImportStats;
  issues: Issue[];
  unsupported: string[];
  fixesApplied: string[];
  ok: boolean;
  errorCount: number;
  warningCount: number;
  fixableCount: number;
}

export class ParseError extends Error {
  constructor(message: string, public loc?: SourceLoc) {
    super(message);
  }
}

export function pathKey(path: (string | number)[]): string {
  return path.reduce<string>((acc, p) => (typeof p === 'number' ? `${acc}[${p}]` : acc ? `${acc}.${p}` : String(p)), '');
}
