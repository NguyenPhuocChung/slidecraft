import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const OUT = process.env.E2E_OUT ?? path.resolve('test-results/e2e-files');
fs.mkdirSync(OUT, { recursive: true });

/** Export sample #i to .pptx inside the app (real export engine) and save it to disk. */
async function exportSamplePptx(page: Page, i: number): Promise<{ file: string; slides: number }> {
  await page.goto('/');
  const res = await page.evaluate(async (idx) => {
    const s = await import('/src/samples/index.ts');
    const parser = await import('/src/code-parser/index.ts');
    const exp = await import('/src/pptx-export/index.ts');
    const { presentation } = parser.importPresentation(JSON.stringify(s.SAMPLES[idx].data));
    const { blob } = await exp.exportPptx(presentation!);
    const buf = new Uint8Array(blob instanceof Blob ? await blob.arrayBuffer() : (blob as Uint8Array));
    let bin = '';
    for (let k = 0; k < buf.length; k += 0x8000) bin += String.fromCharCode(...buf.subarray(k, k + 0x8000));
    return { b64: btoa(bin), slides: presentation!.slides.length, id: s.SAMPLES[idx].id };
  }, i);
  const file = path.join(OUT, `${res.id}-for-import.pptx`);
  fs.writeFileSync(file, Buffer.from(res.b64, 'base64'));
  return { file, slides: res.slides };
}

test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('slidecraft.lang', 'en')); });

test('Import page: open a .pptx → report + previews → open in editor', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { file, slides } = await exportSamplePptx(page, 4);
  await page.goto('/import');
  await expect(page.getByTestId('open-pptx')).toBeVisible();
  await page.getByTestId('import-pptx').setInputFiles(file);
  await expect(page.getByTestId('pptx-panel')).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId('pptx-stat-slides')).toContainText(String(slides));
  await expect(page.getByTestId('pptx-stat-charts')).not.toContainText(/^0/);
  await expect(page.getByTestId('pptx-preview')).toBeVisible();
  await page.screenshot({ path: path.join(OUT, 'pptx-import-report.png') });
  await page.getByTestId('pptx-build').click();
  await page.waitForURL(/\/editor\//);
  await expect(page.getByTestId('canvas')).toBeVisible();
  await expect(page.getByTestId('slide-thumb')).toHaveCount(slides);
  // imported objects are real, editable elements
  await page.getByTestId('slide-thumb').nth(8).click();
  await expect(page.getByTestId('canvas').getByText('Summary P&L')).toBeVisible();
  await page.getByTestId('canvas').screenshot({ path: path.join(OUT, 'pptx-import-editor.png') });
  expect(errors).toEqual([]);
});

test('Dashboard: a dropped/selected .pptx opens straight in the editor', async ({ page }) => {
  const { file, slides } = await exportSamplePptx(page, 0);
  await page.goto('/dashboard');
  await page.getByTestId('dashboard-import-file').setInputFiles(file);
  await page.waitForURL(/\/editor\//, { timeout: 30000 });
  await expect(page.getByTestId('slide-thumb')).toHaveCount(slides);
});

test('Import page: rejects a broken .pptx with a clear message', async ({ page }) => {
  const bad = path.join(OUT, 'broken.pptx');
  fs.writeFileSync(bad, 'this is not a zip');
  await page.goto('/import');
  await page.getByTestId('import-pptx').setInputFiles(bad);
  await expect(page.getByTestId('toast-error')).toContainText('not a valid PowerPoint');
});

const hasPythonPptx = spawnSync('python3', ['-c', 'import pptx'], { encoding: 'utf8' }).status === 0;
test('Import page: deck made by python-pptx (placeholders, table, chart, group)', async ({ page }) => {
  test.skip(!hasPythonPptx, 'python-pptx not installed');
  const file = path.join(OUT, 'python-pptx-deck.pptx');
  spawnSync('python3', [path.resolve('scripts/make-test-pptx.py'), file]);
  await page.goto('/import');
  await page.getByTestId('import-pptx').setInputFiles(file);
  await expect(page.getByTestId('pptx-stat-slides')).toContainText('5', { timeout: 30000 });
  await page.getByTestId('pptx-build').click();
  await page.waitForURL(/\/editor\//);
  await expect(page.getByTestId('slide-thumb')).toHaveCount(5);
  await expect(page.getByTestId('canvas').getByText('Quarterly Review')).toBeVisible();
});
