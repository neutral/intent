// The exported Portal reader in a real browser, served by an ordinary static server:
// it reads in full before its script runs, hydrates without warnings, searches,
// takes the keyboard in order and passes axe.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createServer } from 'node:http';
import { MemorySource, readWorkspace } from '../../dist/library/index.js';
import { buildPortal } from '../../dist/apps/portal/build.js';
import { document, header, location, fixtureFiles } from '../fixtures.mjs';

let server, base, plan;
test.beforeAll(async () => {
  const files = fixtureFiles({
    'intent/project.json': JSON.stringify({ schema: 'intent.project.v1', name: 'Portal browser fixture', owners: ['example'], implementationRoots: ['src'], exemptions: [] }),
    [location('description')]: document(header('description', { status: 'current', relationships: [{ type: 'depends-on', target: 'blueprint.store', required: true }] })),
    [location('check')]: document(header('check', { status: 'current' })),
  });
  const source = new MemorySource(files), workspace = await readWorkspace(source);
  plan = await buildPortal(workspace, source, { recordIds: ['description.store', 'check.store'] }, { title: 'Selected example' });
  if (!plan.complete) throw new Error(JSON.stringify(plan.diagnostics));
  const output = new Map(plan.files.map(file => [file.path, file]));
  server = createServer((request, response) => {
    const path = new URL(request.url, 'http://localhost').pathname.replace(/^\/site\//, '');
    const file = output.get(path || 'index.html');
    if (!file) { response.writeHead(404).end(); return; }
    response.writeHead(200, { 'content-type': file.mediaType }); response.end(file.bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${server.address().port}/site/`;
});
test.afterAll(async () => { await new Promise(resolve => server.close(resolve)); });

function watch(page) {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) errors.push(message.text()); });
  return errors;
}
const pages = () => plan.files.filter(file => file.path.endsWith('.html')).map(file => file.path);

test('every page reads in full before any script runs', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(base + 'index.html');
  await expect(page.getByRole('heading', { level: 1, name: 'Selected example' })).toBeVisible();
  await expect(page.getByRole('link', { name: /description example/ })).toBeVisible();
  await expect(page.getByRole('searchbox', { name: 'Search selected Knowledge' })).toBeDisabled();
  await page.getByRole('link', { name: /description example/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'description example' })).toBeVisible();
  await expect(page.locator('#lead')).toHaveText('An independently authored test record');
  await expect(page.getByText('Required reference omitted from this publication')).toBeVisible();
  await page.getByText('Structured Knowledge and technical identity').click();
  await expect(page.getByText('Source fingerprint')).toBeVisible();
  await context.close();
});

test('hydrates every page without errors or warnings', async ({ page }) => {
  const errors = watch(page);
  for (const path of pages()) {
    await page.goto(base + path);
    await expect(page.locator('#root a.skip')).toHaveAttribute('data-rac', '');
    await page.waitForLoadState('networkidle');
  }
  expect(errors).toEqual([]);
});

test('search filters by every word, reports matches politely and clears from the keyboard', async ({ page }) => {
  const errors = watch(page);
  await page.goto(base + 'index.html');
  const search = page.getByRole('searchbox', { name: 'Search selected Knowledge' });
  await expect(search).toBeEnabled();
  const status = page.locator('#search-status');
  await expect(status).toHaveAttribute('aria-live', 'polite');
  await search.fill('description');
  await expect(status).toHaveText('1 of 2 selected records match');
  await expect(page.locator('[data-record]:visible')).toHaveCount(1);
  await search.fill('no match at all');
  await expect(page.getByText('No selected Knowledge matches this search.')).toBeVisible();
  await search.press('Enter');
  await expect(page).toHaveURL(base + 'index.html');
  await page.getByRole('button', { name: 'Clear search' }).click();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue('');
  await expect(page.locator('[data-record]:visible')).toHaveCount(2);
  await expect(status).toHaveText('2 of 2 selected records');
  await search.fill('check');
  await search.press('Escape');
  await expect(search).toHaveValue('');
  expect(errors).toEqual([]);
});

test('the keyboard reaches the skip link, the places and the records in reading order', async ({ page }) => {
  await page.goto(base + 'index.html');
  await expect(page.getByRole('searchbox')).toBeEnabled();
  const focused = () => page.evaluate(() => ({ text: document.activeElement?.textContent?.trim() || document.activeElement?.getAttribute('placeholder'), outline: getComputedStyle(document.activeElement).outlineStyle }));
  const order = [];
  for (let step = 0; step < 7; step++) { await page.keyboard.press('Tab'); order.push(await focused()); }
  expect(order.map(item => item.text)).toEqual(['Skip to content', 'Browse', 'Selected sources', 'Manifest', '4 selected files', 'Find a decision, responsibility, or ID', expect.stringContaining('check example')]);
  expect(order.every(item => item.outline === 'solid')).toBe(true);
  await expect(page.getByRole('link', { name: 'Browse' })).toHaveAttribute('aria-current', 'page');
});

test('every page passes axe at 1440px and 375px without horizontal scroll', async ({ page }) => {
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    for (const path of pages()) {
      await page.goto(base + path);
      await page.waitForLoadState('networkidle');
      const results = await new AxeBuilder({ page }).analyze();
      expect(results.violations.map(violation => `${path} ${width}: ${violation.id} ${violation.nodes.map(node => node.target).join(' ')}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${path} overflows at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
});
