import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';

const OUT = process.env.E2E_OUT ?? path.resolve('test-results/e2e-files');
fs.mkdirSync(OUT, { recursive: true });

async function importSample(page: Page, sampleIndex = 0): Promise<string> {
  await page.goto('/');
  const code = await page.evaluate(async (i) => {
    const s = await import('/src/samples/index.ts');
    return JSON.stringify(s.SAMPLES[i].data, null, 2);
  }, sampleIndex);
  await page.evaluate((c) => sessionStorage.setItem('slidecraft.importDraft', c), code);
  await page.goto('/import');
  await expect(page.getByTestId('import-status')).toContainText('Ready to build', { timeout: 15000 });
  await page.getByTestId('build-presentation').click();
  await page.waitForURL(/\/editor\//);
  await expect(page.getByTestId('canvas')).toBeVisible();
  return page.url().split('/editor/')[1];
}

// The UI defaults to Vietnamese; assertions below use the English strings.
test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('slidecraft.lang', 'en')); });

test('import → edit → slides → undo/redo → save/reload', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await importSample(page, 0);
  const thumbs = page.getByTestId('slide-thumb');
  await expect(thumbs).toHaveCount(10);

  // edit object: select heading, drag
  const heading = page.locator('[data-testid=canvas] [data-el-id="heading"]').first();
  const b0 = (await heading.boundingBox())!;
  await page.mouse.move(b0.x + 30, b0.y + 20);
  await page.mouse.down();
  await page.mouse.move(b0.x + 130, b0.y + 60, { steps: 6 });
  await page.mouse.up();
  const b1 = (await heading.boundingBox())!;
  expect(Math.round(b1.x - b0.x)).toBeGreaterThan(50);
  await expect(page.getByTestId('properties-panel')).toBeVisible();
  // undo / redo
  await page.getByTestId('undo').click();
  expect(Math.abs((await heading.boundingBox())!.x - b0.x)).toBeLessThan(2);
  await page.getByTestId('redo').click();
  expect((await heading.boundingBox())!.x - b0.x).toBeGreaterThan(50);

  // inline text edit
  await page.mouse.dblclick(b1.x + 30, b1.y + 20);
  await page.keyboard.press('Control+a');
  await page.keyboard.type('Edited by E2E');
  await page.keyboard.press('Escape');
  await expect(heading).toContainText('Edited by E2E');

  // add / duplicate / delete slides
  await page.getByTestId('add-slide').click();
  await expect(thumbs).toHaveCount(11);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Control+d');
  await expect(thumbs).toHaveCount(12);
  await thumbs.nth(11).hover();
  await thumbs.nth(11).getByTestId('thumb-delete').click();
  await expect(thumbs).toHaveCount(11);

  // insert a chart and a diagram
  const chartsBefore = await page.locator('[data-testid=canvas] [data-el-type=chart]').count();
  await page.getByTestId('insert-chart').click();
  // the menu must be really visible on top (not clipped by the scrollable toolbar)
  const item = page.getByTestId('insert-chart-donut');
  const ib = (await item.boundingBox())!;
  expect(await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('[data-popover]'), [ib.x + 20, ib.y + ib.height / 2])).toBe(true);
  await page.getByTestId('insert-chart-donut').click();
  await expect(page.locator('[data-testid=canvas] [data-el-type=chart]')).toHaveCount(chartsBefore + 1);

  // animation on selected chart
  await page.getByTestId('tab-animate').click();
  await page.getByTestId('add-anim-entrance').click();
  await expect(page.getByTestId('anim-effect')).toHaveValue('fadeIn');
  // transition
  await page.getByTestId('tab-transition').click();
  await page.getByTestId('transition-zoom').click();

  // save + reload
  await expect(page.getByTestId('save-status')).toHaveAttribute('data-status', /^(saved|offline)$/, { timeout: 8000 });
  await page.reload();
  await expect(page.getByTestId('slide-thumb')).toHaveCount(11);
  await expect(page.locator('[data-testid=canvas] [data-el-id="heading"]').first()).toContainText('Edited by E2E');
  expect(errors).toEqual([]);
});

test('present mode: transitions, animation steps, presenter notes', async ({ page }) => {
  const id = await importSample(page, 0);
  await page.goto(`/present/${id}?mode=normal&start=0`);
  await expect(page.getByTestId('present-root')).toBeVisible();
  for (let i = 0; i < 6; i++) { await page.keyboard.press('ArrowRight'); await page.waitForTimeout(250); }
  await expect(page.getByTestId('slide-counter')).not.toHaveText(/^1 \//);
  await page.goto(`/present/${id}?mode=presenter&start=1`);
  await expect(page.getByTestId('speaker-notes')).not.toBeEmpty();
});

test('export PPTX (validated) and PDF; PPTX opens with python-pptx', async ({ page }) => {
  await importSample(page, 4); // data report
  await page.getByTestId('export').click();
  await expect(page.getByTestId('export-report')).toBeVisible();
  const dl = page.waitForEvent('download', { timeout: 90000 });
  await page.getByTestId('export-run').click();
  const d = await dl;
  const file = path.join(OUT, 'data-report.pptx');
  await d.saveAs(file);
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  const slides = Object.keys(zip.files).filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f));
  expect(slides.length).toBe(15);
  const py = execFileSync('python3', ['-c', `from pptx import Presentation; p=Presentation(${JSON.stringify(file)}); print(len(p.slides), sum(1 for s in p.slides for sh in s.shapes if sh.has_chart))`]).toString().trim();
  const [n, charts] = py.split(' ').map(Number);
  expect(n).toBe(15);
  expect(charts).toBeGreaterThan(3);

  await page.getByTestId('format-pdf').click();
  const dl2 = page.waitForEvent('download', { timeout: 120000 });
  await page.getByTestId('export-run').click();
  const pdf = path.join(OUT, 'data-report.pdf');
  await (await dl2).saveAs(pdf);
  const head = fs.readFileSync(pdf).subarray(0, 5).toString();
  expect(head).toBe('%PDF-');
  expect(fs.statSync(pdf).size).toBeGreaterThan(50_000);
});

test('AI Prompt Center copy/download and Auto Fix flow', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/prompts');
  await expect(page.getByText(/Compatibility/i).first()).toBeVisible();
  const dl = page.waitForEvent('download');
  await page.getByTestId('download-md').click();
  const f = path.join(OUT, 'prompt.md');
  await (await dl).saveAs(f);
  const md = fs.readFileSync(f, 'utf8');
  expect(md).toContain('schemaVersion');
  expect(md.length).toBeGreaterThan(8000);

  // auto fix: messy AI output
  const messy = '```json\n{"title":"Messy","slides":[{"elements":[{"type":"title","x":"100px","y":100,"w":900,"h":120,"text":"Hello"},{"type":"img","x":1000,"y":200,"width":600,"height":400,"src":"javascript:alert(1)","alt":"team"}]}]}\n```';
  await page.goto('/');
  await page.evaluate((c) => sessionStorage.setItem('slidecraft.importDraft', c), messy);
  await page.goto('/import');
  await expect(page.getByTestId('auto-fix')).toBeEnabled();
  await page.getByTestId('auto-fix').click();
  await page.getByTestId('apply-fixes').click();
  await expect(page.getByTestId('build-presentation')).toBeEnabled({ timeout: 10000 });
  await page.getByTestId('build-presentation').click();
  await page.waitForURL(/\/editor\//);
  await expect(page.locator('[data-testid=canvas] [data-el-type=heading]')).toContainText('Hello');
});

test('paste & drop images from outside (file, web <img>, text)', async ({ page }) => {
  await page.goto('/');
  const id = await page.evaluate(async () => { const pr = await import('/src/services/projects.ts'); return (await pr.createBlankPresentation({ title: 'Paste' })).id; });
  await page.goto(`/editor/${id}`);
  await expect(page.getByTestId('canvas')).toBeVisible();
  const images = page.locator('[data-testid=canvas] [data-el-type=image]');
  // a 1×1 PNG, as when copying an image / screenshot
  const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';
  await page.evaluate((b64) => {
    const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const dt = new DataTransfer(); dt.items.add(new File([bin], 'shot.png', { type: 'image/png' }));
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }, png);
  await expect(images).toHaveCount(1);
  await page.evaluate((b64) => {
    const dt = new DataTransfer(); dt.setData('text/html', `<img src="data:image/png;base64,${b64}" alt="web">`);
    window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
  }, png);
  await expect(images).toHaveCount(2);
  const dt = await page.evaluateHandle((b64) => { const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); const d = new DataTransfer(); d.items.add(new File([bin], 'drop.png', { type: 'image/png' })); return d; }, png);
  await page.getByTestId('canvas').dispatchEvent('drop', { dataTransfer: dt });
  await expect(images).toHaveCount(3);
  await page.evaluate(() => { const d = new DataTransfer(); d.setData('text/plain', 'Pasted paragraph'); window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: d, bubbles: true })); });
  await expect(page.getByTestId('canvas')).toContainText('Pasted paragraph');
  await expect(page.locator('[data-testid=canvas] [data-image-placeholder]')).toHaveCount(0);
});
