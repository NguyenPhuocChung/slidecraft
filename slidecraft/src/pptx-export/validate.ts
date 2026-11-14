import JSZip from 'jszip';
import { XMLValidator } from 'fast-xml-parser';

export interface Check { name: string; ok: boolean; detail?: string }

function wellFormed(xml: string): string | null {
  if (typeof DOMParser !== 'undefined') {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const err = doc.getElementsByTagName('parsererror')[0];
    return err ? (err.textContent ?? 'parse error').slice(0, 200) : null;
  }
  const r = XMLValidator.validate(xml, { allowBooleanAttributes: true });
  return r === true ? null : `${r.err.msg} (line ${r.err.line})`;
}

async function toUint8(data: Uint8Array | ArrayBuffer | Blob): Promise<Uint8Array> {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  return new Uint8Array(await (data as Blob).arrayBuffer());
}

const SLIDE_ORDER = ['p:cSld', 'p:clrMapOvr', 'p:transition|mc:AlternateContent', 'p:timing', 'p:extLst'];

/** Post-export verification. Never report a successful export unless this passes. */
export async function validatePptx(data: Uint8Array | ArrayBuffer | Blob, expectedSlides: number, opts: { expectNotes?: number[] } = {}): Promise<{ ok: boolean; checks: Check[] }> {
  const checks: Check[] = [];
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await toUint8(data));
    checks.push({ name: 'ZIP container opens', ok: true });
  } catch (e) {
    checks.push({ name: 'ZIP container opens', ok: false, detail: (e as Error).message });
    return { ok: false, checks };
  }
  const ct = zip.file('[Content_Types].xml');
  checks.push({ name: '[Content_Types].xml present', ok: !!ct });
  const pres = zip.file('ppt/presentation.xml');
  checks.push({ name: 'ppt/presentation.xml present', ok: !!pres });
  const slideFiles = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a, b) => Number(/(\d+)\.xml/.exec(a)![1]) - Number(/(\d+)\.xml/.exec(b)![1]));
  checks.push({ name: 'Slide count', ok: slideFiles.length === expectedSlides, detail: `${slideFiles.length} / ${expectedSlides}` });
  if (pres) {
    const px = await pres.async('string');
    const ids = (px.match(/<p:sldId /g) ?? []).length;
    checks.push({ name: 'presentation.xml slide list', ok: ids === expectedSlides, detail: `${ids} sldId entries` });
  }
  const bad: string[] = [];
  const order: string[] = [];
  const allXml = Object.keys(zip.files).filter((f) => f.endsWith('.xml') || f.endsWith('.rels'));
  for (const f of allXml) {
    const xml = await zip.file(f)!.async('string');
    const err = wellFormed(xml);
    if (err) bad.push(`${f}: ${err}`);
    if (/^ppt\/slides\/slide\d+\.xml$/.test(f)) {
      const cut = xml.indexOf('</p:cSld>');
      const tail = cut >= 0 ? xml.slice(cut) : '';
      const seq = SLIDE_ORDER.slice(1).map((t) => { const idx = t.split('|').map((x) => tail.search(new RegExp(`<${x}[ >/]`))).filter((i) => i >= 0); return idx.length ? Math.min(...idx) : -1; }).filter((i) => i >= 0);
      if (cut < 0 || !/<p:cSld[ >]/.test(xml.slice(0, cut))) order.push(f);
      else for (let i = 1; i < seq.length; i++) if (seq[i] < seq[i - 1]) { order.push(f); break; }
      if (/<p:timing>/.test(xml)) {
        const ids = new Set([...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => m[1]));
        const missing = [...xml.matchAll(/<p:spTgt spid="(\d+)"/g)].map((m) => m[1]).filter((id) => !ids.has(id));
        if (missing.length) bad.push(`${f}: animation targets missing shapes ${[...new Set(missing)].join(',')}`);
      }
      if (/<\/a:r><a:pPr|<\/a:fld><a:pPr/.test(xml)) bad.push(`${f}: paragraph properties after a text run (PowerPoint would repair the file)`);
      const cids = [...xml.matchAll(/<p:cNvPr id="(\d+)"/g)].map((m) => m[1]);
      const dup = cids.filter((id, i) => cids.indexOf(id) !== i);
      if (dup.length) bad.push(`${f}: duplicate shape ids ${[...new Set(dup)].join(',')}`);
    }
  }
  checks.push({ name: 'All XML parts well-formed', ok: bad.length === 0, detail: bad.slice(0, 5).join(' | ') || `${allXml.length} parts` });
  checks.push({ name: 'Slide element order (cSld → clrMapOvr → transition → timing)', ok: order.length === 0, detail: order.join(', ') || undefined });
  // relationships
  const missingTargets: string[] = [];
  for (const f of Object.keys(zip.files).filter((x) => x.endsWith('.rels'))) {
    const xml = await zip.file(f)!.async('string');
    const base = f.replace(/_rels\/[^/]*\.rels$/, '');
    for (const m of xml.matchAll(/<Relationship [^>]*Target="([^"]+)"[^>]*?(TargetMode="External")?\s*\/>/g)) {
      if (/TargetMode="External"/.test(m[0]) || /^https?:/.test(m[1])) continue;
      const parts = (base + m[1]).split('/');
      const norm: string[] = [];
      parts.forEach((p) => { if (p === '..') norm.pop(); else if (p && p !== '.') norm.push(p); });
      const target = m[1].startsWith('/') ? m[1].slice(1) : norm.join('/');
      if (!zip.file(target)) missingTargets.push(`${f} → ${m[1]}`);
    }
  }
  checks.push({ name: 'All relationship targets / embedded media present', ok: missingTargets.length === 0, detail: missingTargets.slice(0, 5).join(' | ') || undefined });
  if (opts.expectNotes?.length) {
    const miss: number[] = [];
    for (const n of opts.expectNotes) {
      const nf = zip.file(`ppt/notesSlides/notesSlide${n}.xml`);
      if (!nf) { miss.push(n); continue; }
      const x = await nf.async('string');
      if (!/<a:t>[^<]+<\/a:t>/.test(x.replace(/<a:fld[\s\S]*?<\/a:fld>/g, ''))) miss.push(n);
    }
    checks.push({ name: 'Speaker notes present', ok: miss.length === 0, detail: miss.length ? `missing on slides ${miss.join(', ')}` : `${opts.expectNotes.length} slides` });
  }
  return { ok: checks.every((c) => c.ok), checks };
}
