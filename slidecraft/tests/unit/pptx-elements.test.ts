import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';
import { importPresentation } from '@/code-parser';
import { exportPptx } from '@/pptx-export';
import { ELEMENT_TYPE_IDS } from '@/types/registry';

// 4x3 red PNG
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAFElEQVR4nGO8IyfHAANMDEgAhQMAKdIBHjGGQBcAAAAASUVORK5CYII=';

describe('PPTX export — every element type', () => {
  it('exports all 23 element types, groups, gradients, crops, media and hidden slides', async () => {
    const els = [
      { id: 'h', type: 'heading', x: 80, y: 40, width: 1200, height: 100, content: { text: 'All **elements** ==demo==' }, animation: [{ effect: 'flyIn', direction: 'left', trigger: 'onEnter' }] },
      { id: 'p', type: 'paragraph', x: 80, y: 150, width: 600, height: 120, content: { text: '- one `code` run\n- two [link](https://example.com)\n1. numbered' }, animation: [{ effect: 'fadeIn', trigger: 'onClick' }, { effect: 'pulse', trigger: 'afterPrevious', repeat: 2 }, { effect: 'fadeOut', trigger: 'onClick' }] },
      { id: 't', type: 'text', x: 700, y: 150, width: 300, height: 60, content: { text: 'plain' }, style: { gradient: { type: 'linear', angle: 45, stops: [{ color: '$primary', offset: 0 }, { color: '$accent', offset: 1 }] } } },
      { id: 'rt', type: 'richText', x: 1050, y: 150, width: 300, height: 60, content: { paragraphs: [{ runs: [{ text: 'rich', bold: true, color: '#ff0000' }] }] } },
      { id: 'img', type: 'image', x: 80, y: 300, width: 300, height: 300, content: { src: PNG, alt: 'red' }, style: { mask: 'circle' }, animation: [{ effect: 'motionCurve', trigger: 'onClick', path: { type: 'curve', dx: 300, dy: 0 } }] },
      { id: 'img2', type: 'image', x: 400, y: 300, width: 200, height: 200, content: { query: 'mountains', alt: 'Mountains' } },
      { id: 'svg', type: 'svg', x: 620, y: 300, width: 100, height: 100, content: { markup: '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="red"/></svg>' } },
      { id: 'icon', type: 'icon', x: 740, y: 300, width: 80, height: 80, content: { name: 'rocket' }, style: { fill: '$surface' } },
      { id: 'sh', type: 'shape', x: 840, y: 300, width: 200, height: 120, content: { shape: 'roundRect', text: 'Shape' }, style: { gradient: { type: 'radial', stops: [{ color: '#ffffff', offset: 0 }, { color: '#000000', offset: 1 }] }, shadow: { x: 0, y: 8, blur: 20, color: 'rgba(0,0,0,.3)' } }, animation: [{ effect: 'spin', trigger: 'withPrevious' }, { effect: 'colorChange', color: '#00ff00', trigger: 'afterPrevious' }] },
      { id: 'ln', type: 'line', content: { x1: 1100, y1: 420, x2: 1300, y2: 300 } },
      { id: 'ar', type: 'arrow', content: { x1: 1300, y1: 300, x2: 1500, y2: 420 }, style: { headStart: 'oval' } },
      { id: 'tb', type: 'table', x: 80, y: 640, width: 600, height: 200, content: { rows: [['A', 'B'], ['1', '2'], ['3', '4']], highlightRows: [2] } },
      { id: 'ch', type: 'chart', x: 700, y: 640, width: 500, height: 300, content: { chartType: 'waterfall', categories: ['a', 'b', 'c'], series: [{ name: 's', values: [10, -3, 7] }], totals: [0] } },
      { id: 'ch2', type: 'chart', x: 1220, y: 640, width: 500, height: 300, content: { chartType: 'radar', categories: ['a', 'b', 'c'], series: [{ name: 's', values: [1, 2, 3] }] } },
      { id: 'dg', type: 'diagram', x: 1300, y: 40, width: 600, height: 240, content: { kind: 'cycle', items: [{ title: 'A', icon: 'zap' }, { title: 'B' }, { title: 'C' }] }, animation: [{ effect: 'zoomIn', trigger: 'onClick' }] },
      { id: 'sa', type: 'smartart', x: 1550, y: 300, width: 350, height: 200, content: { kind: 'list', items: [{ title: 'x' }, { title: 'y' }] } },
      { id: 'tl', type: 'timeline', x: 80, y: 860, width: 900, height: 200, content: { items: [{ date: '2025', title: 'a' }, { date: '2026', title: 'b' }] } },
      { id: 'ig', type: 'infographic', x: 1000, y: 960, width: 600, height: 100, content: { kind: 'progressBars', items: [{ label: 'a', progress: 0.5 }] } },
      { id: 'fx', type: 'formula', x: 1600, y: 960, width: 300, height: 100, content: { latex: '\\frac{a}{b}' } },
      { id: 'cd', type: 'code', x: 1220, y: 440, width: 300, height: 180, content: { code: 'const a = 1;\nconsole.log("hi")', language: 'javascript', showLineNumbers: true } },
      { id: 'vid', type: 'video', x: 1540, y: 520, width: 320, height: 180, content: { src: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' } },
      { id: 'aud', type: 'audio', x: 1540, y: 710, width: 320, height: 60, content: { src: 'https://example.com/a.mp3' } },
      { id: 'grp', type: 'group', x: 700, y: 450, width: 300, height: 150, content: { children: [
        { id: 'g1', type: 'shape', x: 0, y: 0, width: 140, height: 140, content: { shape: 'ellipse' } },
        { id: 'g2', type: 'text', x: 150, y: 0, width: 150, height: 60, content: { text: 'grouped' } },
      ] }, animation: [{ effect: 'wipe', direction: 'up', trigger: 'onClick' }] },
      { id: 'dec', type: 'decorative', x: 0, y: 0, width: 400, height: 400, content: { kind: 'blob' } },
      { id: 'v3', type: 'visual3d', x: 1700, y: 800, width: 200, height: 200, content: { kind: 'cube' } },
    ];
    const types = new Set(els.map((e) => e.type));
    for (const t of ELEMENT_TYPE_IDS) expect(types.has(t), t).toBe(true);
    const { presentation: p, analysis } = importPresentation(JSON.stringify({
      schemaVersion: '1.0', title: 'All', theme: 'creative-gradient', globalStyles: { slideNumbers: true, footer: 'Footer' },
      slides: [
        { id: 'a', elements: els, notes: 'Notes & <things>', background: { type: 'gradient', gradient: { type: 'linear', angle: 90, stops: [{ color: '#ffffff', offset: 0 }, { color: '#eeeeee', offset: 1 }] } } },
        { id: 'b', hidden: true, transition: { type: 'morph', duration: 1000 }, duration: 4000, elements: [{ ...els[0], x: 400 }] },
        ...['fade', 'dissolve', 'push', 'wipe', 'split', 'reveal', 'cover', 'uncover', 'zoom', 'cube', 'flip', 'gallery', 'randomBars', 'blinds', 'checkerboard'].map((t, i) => ({ id: `t${i}`, transition: { type: t, duration: 600, autoAdvance: 2000 }, elements: [{ id: 'x', type: 'text', x: 100, y: 100, width: 500, height: 80, content: { text: t } }] })),
      ],
    }));
    expect(analysis.report.errorCount, JSON.stringify(analysis.report.issues.filter((i) => i.severity === 'error'))).toBe(0);
    const { blob, report } = await exportPptx(p!, { profile: 'presentation' });
    if (process.env.PPTX_OUT_DIR) fs.writeFileSync(path.join(process.env.PPTX_OUT_DIR, 'all-elements.pptx'), blob as Uint8Array);
    const failed = report.checks.filter((c) => !c.ok && c.name.startsWith('Post-export'));
    expect(failed, JSON.stringify(failed)).toEqual([]);
    expect(report.ok).toBe(true);
    const zip = await JSZip.loadAsync(blob as Uint8Array);
    const s1 = await zip.file('ppt/slides/slide1.xml')!.async('string');
    expect(s1).toContain('<a:gradFill');
    expect(s1).toContain('<p:grpSp>');
    expect(s1).toContain('prst="ellipse"');
    expect(s1).toContain('<a:srcRect');
    expect(s1).toContain('<p:animMotion');
    expect(s1).toContain('<p:animRot');
    expect(s1).toContain('<p:animClr');
    expect(s1).toContain('transition="out"');
    expect(s1).toContain('<p:bg><p:bgPr><a:gradFill');
    expect(s1).not.toMatch(/<\/a:r><a:pPr/);
    const s2 = await zip.file('ppt/slides/slide2.xml')!.async('string');
    expect(s2).toContain('show="0"');
    expect(s2).toContain('advTm="4000"');
    expect(s2).toContain('name="!!h"');
    expect(s1).toContain('name="!!h"');
    const all = await Promise.all(Array.from({ length: 15 }, (_, i) => zip.file(`ppt/slides/slide${i + 3}.xml`)!.async('string')));
    ['<p:fade/>', '<p:dissolve/>', '<p:push', '<p:wipe', '<p:split', 'p14:reveal', '<p:cover', '<p:pull', '<p:zoom/>', 'p14:prism', 'p14:flip', 'p14:gallery', '<p:randomBar', '<p:blinds', '<p:checker'].forEach((tag, i) => expect(all[i], tag).toContain(tag));
    expect(report.warnings.some((w) => w.includes('image unavailable'))).toBe(true);
    expect(report.warnings.some((w) => w.includes('formula exported as LaTeX'))).toBe(true);
    expect(report.support.partial.some((x) => x.includes('YouTube'))).toBe(true);
    expect(Object.keys(zip.files).some((f) => /media\/.*\.svg$/.test(f))).toBe(true);
  }, 60000);
});
