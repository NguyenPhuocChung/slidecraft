import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const SHOTS = process.env.E2E_SHOTS ?? path.resolve('test-results/editor-ux');
fs.mkdirSync(SHOTS, { recursive: true });

async function importSample(page: Page, sampleIndex = 0): Promise<void> {
  await page.goto('/');
  const code = await page.evaluate(async (i) => {
    const s = await import('/src/samples/index.ts');
    return JSON.stringify(s.SAMPLES[i].data, null, 2);
  }, sampleIndex);
  await page.evaluate((c) => sessionStorage.setItem('slidecraft.importDraft', c), code);
  await page.goto('/import');
  await expect(page.getByTestId('build-presentation')).toBeEnabled({ timeout: 15000 });
  await page.getByTestId('build-presentation').click();
  await page.waitForURL(/\/editor\//);
  await expect(page.getByTestId('canvas')).toBeVisible();
}

const canvasCharts = (page: Page) => page.locator('[data-testid=canvas] [data-el-type=chart]');

test.describe('editor UX (Vietnamese UI)', () => {
  test.beforeEach(async ({ page }) => { await page.addInitScript(() => localStorage.setItem('slidecraft.lang', 'vi')); });

  test('chart: insert via picture tile, edit data with a Vietnamese number, apply shows on canvas', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await importSample(page, 0);
    const before = await canvasCharts(page).count();
    await page.getByTestId('insert-chart').click();
    const tile = page.getByTestId('insert-chart-column');
    await expect(tile).toBeVisible();
    await expect(tile.locator('svg')).toHaveCount(1);
    await expect(page.locator('[data-popover]')).toContainText('Cột');
    await page.screenshot({ path: `${SHOTS}/insert-chart-menu.png` });
    await tile.click();
    await expect(canvasCharts(page)).toHaveCount(before + 1);
    // open the data editor from the Properties panel
    await page.getByTestId('chart-edit-data').click();
    const dlg = page.getByTestId('chart-editor');
    await expect(dlg).toBeVisible();
    await expect(page.getByTestId('chart-number-hint')).toContainText('1,5');
    const cell = page.getByTestId('chart-cell-1-1');
    await cell.fill('987,5');
    await page.getByTestId('chart-cell-1-0').fill('Quý một');
    await page.screenshot({ path: `${SHOTS}/chart-editor.png` });
    await page.getByTestId('chart-apply').click();
    await expect(dlg).toBeHidden();
    const chart = canvasCharts(page).last();
    await expect(chart).toContainText('Quý một');
    // change the type with the picture picker in Properties → data is converted, no crash
    await page.getByTestId('props-chart-type').click();
    await page.getByTestId('pick-chart-scatter').click();
    await page.getByTestId('props-chart-type').click();
    await page.getByTestId('pick-chart-pie').click();
    await page.getByTestId('chart-edit-data').click();
    await expect(page.getByTestId('chart-editor')).toBeVisible();
    await page.getByTestId('chart-editor').getByRole('button', { name: 'Hủy' }).click();
    // every chart type opens the editor without crashing
    for (const t of ['bar', 'waterfall', 'histogram', 'bubble', 'radar', 'treemap']) {
      await page.getByTestId('props-chart-type').click();
      await page.getByTestId(`pick-chart-${t}`).click();
      await page.getByTestId('chart-edit-data').click();
      await expect(page.getByTestId('chart-editor'), t).toBeVisible();
      await expect(page.getByTestId('chart-apply'), t).toBeEnabled();
      await page.getByTestId('chart-editor').getByRole('button', { name: 'Hủy' }).click();
    }
    expect(errors).toEqual([]);
  });

  test('number steppers change position; background image applies to all slides', async ({ page }) => {
    await importSample(page, 0);
    const heading = page.locator('[data-testid=canvas] [data-el-id="heading"]').first();
    await heading.click();
    const xBox = page.getByTestId('pos-x');
    await expect(xBox).toBeVisible();
    const x0 = Number(await xBox.locator('input').inputValue());
    await xBox.locator('[data-step=up]').click();
    await expect(xBox.locator('input')).toHaveValue(String(x0 + 1));
    await xBox.locator('[data-step=up]').click({ modifiers: ['Shift'] });
    await expect(xBox.locator('input')).toHaveValue(String(x0 + 11));
    await xBox.locator('[data-step=down]').click();
    await expect(xBox.locator('input')).toHaveValue(String(x0 + 10));
    await page.screenshot({ path: `${SHOTS}/properties-steppers.png` });

    // Background: upload an asset image through the media picker, then apply to all
    await page.keyboard.press('Escape');
    await page.locator('[data-testid=canvas]').click({ position: { x: 5, y: 5 } });
    await expect(page.getByTestId('slide-props')).toBeVisible();
    await page.getByTestId('slide-props').getByRole('button', { name: 'Hình ảnh' }).click();
    await page.getByTestId('bg-choose-image').click();
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAABAAAAAJCAIAAAC0SDtlAAAAGUlEQVR4nGP4TyJgGNUwqmFUw6iGgdQAAEAp+/F0Xp5JAAAAAElFTkSuQmCC', 'base64');
    await page.getByTestId('media-picker').getByTestId('media-upload').setInputFiles({ name: 'nen.png', mimeType: 'image/png', buffer: png });
    // the uploaded file becomes a presentation asset ("asset:…") and is shown immediately
    await expect(page.getByTestId('media-picker')).toBeHidden();
    await expect(page.getByTestId('bg-preview')).toHaveAttribute('style', /url\("data:image\/png/, { timeout: 10000 });
    const bgStyle = await page.locator('[data-testid=canvas] [data-slide-bg]').first().getAttribute('style');
    expect(bgStyle).toContain('data:image/png');
    await page.getByTestId('bg-apply-all').click();
    const thumbsBg = page.locator('[data-testid=slide-thumb] [data-slide-bg]');
    const n = await thumbsBg.count();
    for (let i = 0; i < n; i++) expect(await thumbsBg.nth(i).getAttribute('style'), `thumb ${i}`).toContain('data:image/png');
    await page.screenshot({ path: `${SHOTS}/background-apply-all.png` });
    await page.getByTestId('undo').click();
    expect(await thumbsBg.nth(n - 1).getAttribute('style')).not.toContain('data:image/png');
  });

  test('Animate panel is plain Vietnamese', async ({ page }) => {
    await importSample(page, 0);
    await page.locator('[data-testid=canvas] [data-el-id="heading"]').first().click();
    await page.getByTestId('tab-animate').click();
    await page.getByTestId('add-anim-entrance').click();
    const panel = page.getByTestId('animation-panel');
    await expect(panel).toContainText('Hiện dần');
    await expect(page.getByTestId('anim-effect-help')).toContainText('mờ rồi hiện rõ dần');
    await expect(page.getByTestId('anim-trigger').locator('option:checked')).toHaveText('Khi bấm chuột');
    await expect(panel).toContainText('PowerPoint: hỗ trợ đầy đủ');
    const options = await panel.locator('select option').allTextContents();
    expect(options).toContain('Cùng lúc với hiệu ứng trước');
    expect(options).toContain('Chậm dần');
    const text = (await panel.innerText()) + options.join(' ');
    for (const bad of ['onClick', 'withPrevious', 'afterPrevious', 'onEnter', 'easeOut', 'easeIn', 'linear', 'Trigger', 'Easing']) expect(text, bad).not.toContain(bad);
    await page.getByTestId('anim-duration').locator('[data-step=up]').click();
    await expect(page.getByTestId('anim-duration').locator('input')).toHaveValue('0.7');
    await page.screenshot({ path: `${SHOTS}/animate-panel.png` });
    await page.getByTestId('tab-transition').click();
    await page.getByTestId('transition-push').click();
    await expect(page.getByTestId('transition-help')).toContainText('đẩy');
    await page.screenshot({ path: `${SHOTS}/transition-panel.png` });
  });

  test('Edit source code dialog applies changes in place and can be undone', async ({ page }) => {
    await importSample(page, 0);
    const url = page.url();
    const thumbs = await page.getByTestId('slide-thumb').count();
    await page.getByTestId('topbar-source').click();
    const dlg = page.getByTestId('source-dialog');
    await expect(dlg).toBeVisible();
    await expect(dlg).toContainText('Code hợp lệ');
    // break the JSON → error with a line number
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    const setCode = async (c: string) => {
      await page.evaluate((code) => navigator.clipboard.writeText(code), c);
      await page.getByTestId('source-paste').click();
    };
    await setCode('{\n  "schemaVersion": "1.0",\n  "title": "Hỏng",\n  "slides": [ "oops" "x" ]\n}');
    await expect(page.getByTestId('source-issues')).toContainText('Dòng', { timeout: 5000 });
    await expect(page.getByTestId('source-apply')).toBeDisabled();
    await page.screenshot({ path: `${SHOTS}/source-dialog-error.png` });
    // replace the code with an edited version
    const code = await page.evaluate(async () => {
      const s = await import('/src/samples/index.ts');
      const d = JSON.parse(JSON.stringify(s.SAMPLES[0].data));
      d.title = 'Tiêu đề đã sửa bằng code';
      d.slides.pop();
      return JSON.stringify(d, null, 2);
    });
    await setCode(code);
    await expect(dlg).toContainText('Code hợp lệ', { timeout: 5000 });
    await page.screenshot({ path: `${SHOTS}/source-dialog.png` });
    await page.getByTestId('source-apply').click();
    await expect(dlg).toBeHidden();
    expect(page.url()).toBe(url);
    await expect(page.locator('header input').first()).toHaveValue('Tiêu đề đã sửa bằng code');
    await expect(page.getByTestId('slide-thumb')).toHaveCount(thumbs - 1);
    await page.getByTestId('undo').click();
    await expect(page.getByTestId('slide-thumb')).toHaveCount(thumbs);
    await expect(page.locator('header input').first()).not.toHaveValue('Tiêu đề đã sửa bằng code');
  });
});
