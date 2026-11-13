// The Editor in a real browser against its real service: the refresh, conflict and
// recovery behaviour the service tests cannot see, the keyboard paths, and axe.
// These establish the exercised paths only, not human usefulness.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { startEditor } from '../../dist/apps/editor/server.js';
import { fixtureFiles, document, header, location } from '../fixtures.mjs';

const services = [];
test.afterEach(async () => { for (const service of services.splice(0)) { await service.close(); await rm(service.temporary, { recursive: true, force: true }); } });

async function editor(extra = {}) {
  const root = await mkdtemp(join(tmpdir(), 'intent-editor-browser-'));
  const path = location('blueprint');
  const files = fixtureFiles({ 'intent/project.json': JSON.stringify({ schema: 'intent.project.v1', name: 'Refresh fixture', owners: ['example'], implementationRoots: ['src'], exemptions: [] }), [path]: document(header('blueprint')), 'src/store.js': 'export const value = 1;\n', ...extra });
  for (const [name, text] of Object.entries(files)) { await mkdir(dirname(join(root, name)), { recursive: true }); await writeFile(join(root, name), text); }
  const service = await startEditor(root, { stateDirectory: join(root, 'tmp', 'editor-user-data') });
  service.temporary = root; services.push(service);
  const token = /name="intent-token" content="([a-f0-9]+)"/.exec(await (await fetch(service.url)).text())[1];
  const request = async route => (await fetch(service.url + route, { headers: { 'x-intent-token': token } })).json();
  return { root, path, service, request, url: service.url, append: async (name, text) => writeFile(join(root, name), (await readFile(join(root, name), 'utf8')) + text) };
}

function watch(page) {
  const calls = [], errors = [];
  page.on('request', request => { if (request.method() === 'POST' && request.url().includes('/api/')) calls.push({ path: new URL(request.url()).pathname, body: request.postDataJSON() }); });
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  return { calls, errors, last: path => calls.filter(call => call.path === path).at(-1)?.body, count: path => calls.filter(call => call.path === path).length };
}

const sourceView = (f, view = 'source') => `${f.url}/#/record/${encodeURIComponent(f.path)}/${view}`;
const button = (page, name) => page.getByRole('button', { name, exact: true });
const notice = page => page.locator('.notice');
async function reviewed(page) {
  const dialog = page.getByRole('dialog', { name: 'Apply this proposal' });
  await expect(dialog).toBeVisible();
  await expect(button(page, 'Apply reviewed changes')).toBeEnabled();
  return dialog;
}

test('preserves both editors across stale preparation, refresh and refused application', async ({ page }) => {
  const f = await editor(), seen = watch(page);
  await page.goto(sourceView(f));
  const source = page.getByRole('textbox', { name: 'Markdown source' }), metadata = page.getByRole('textbox', { name: 'Record metadata' });
  await expect(source).toBeVisible();
  const original = await source.inputValue(), local = original.replace('Isolate storage behind an interface', 'Keep this local storage boundary');
  const context = JSON.parse(await metadata.inputValue()); context.catalog.records[0].tags.push('local-ui-tag');
  const localMetadata = JSON.stringify(context, null, 2);
  await source.fill(local); await metadata.fill(localMetadata);
  await expect(page.getByRole('status').filter({ hasText: 'unapplied local edit' })).toBeVisible();
  await f.append('intent/project.json', '\n');
  await button(page, 'Review source change').click();
  await expect(notice(page)).toContainText('Refresh');
  await button(page, 'Refresh').click();
  await expect(notice(page)).toContainText('Your local text is preserved');
  await expect(source).toHaveValue(local); await expect(metadata).toHaveValue(localMetadata);
  await button(page, 'Review source change').click();
  await reviewed(page);
  expect(seen.last('/api/change').before).toBe(original); expect(seen.last('/api/change').operation.sourceText).toBe(local);
  await f.append('intent/project.json', '\n');
  await button(page, 'Apply reviewed changes').click();
  await expect(page.getByRole('complementary', { name: 'Repository inspection' })).toContainText('No files were written and no recovery journal');
  await expect(source).toHaveValue(local); await expect(metadata).toHaveValue(localMetadata);
  await expect(page.getByRole('textbox', { name: 'Operation ID from the retained journal' })).toHaveValue('');
  await button(page, 'Refresh and keep local edits').click();
  await button(page, 'Review source change').click();
  await reviewed(page);
  await button(page, 'Apply reviewed changes').click();
  await expect.poll(() => readFile(join(f.root, f.path), 'utf8')).toBe(local);
  // The stale preparation is refused by design; the browser logs that response.
  expect(seen.errors.filter(error => !/status of 409 \(Conflict\)/.test(error))).toEqual([]);
});

test('requires a conflict choice and preserves configuration text during refresh', async ({ page }) => {
  const f = await editor(), seen = watch(page);
  await page.goto(sourceView(f));
  const source = page.getByRole('textbox', { name: 'Markdown source' });
  await expect(source).toBeVisible();
  const original = await source.inputValue(), local = original.replace('Isolate storage behind an interface', 'Local conflict text');
  await source.fill(local);
  await writeFile(join(f.root, f.path), original.replace('Isolate storage behind an interface', 'External conflict text'));
  await button(page, 'Refresh').click();
  await expect(page.locator('main')).toContainText('Edited source changed outside');
  await expect(source).toHaveValue(local);
  const count = seen.count('/api/change');
  await button(page, 'Review source change').click();
  await expect(notice(page)).toContainText('Resolve the edited-source conflict');
  expect(seen.count('/api/change')).toBe(count);
  await button(page, 'Keep local text and review against current source').click();
  await expect(source).toHaveValue(local);
  await button(page, 'Review source change').click();
  await reviewed(page);
  expect(seen.last('/api/change').before).toMatch(/External conflict text/); expect(seen.last('/api/change').operation.sourceText).toBe(local);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await button(page, 'Discard local edit').click();
  await page.getByRole('navigation', { name: 'Project tools' }).getByRole('link', { name: 'Project configuration' }).click();
  await button(page, 'Read configuration').click();
  const configuration = page.getByRole('textbox', { name: 'Configuration source' });
  await expect(configuration).toBeVisible();
  const configLocal = (await configuration.inputValue()) + '\n';
  await configuration.fill(configLocal);
  await writeFile(join(f.root, 'src/store.js'), 'export const value = 5;\n');
  await button(page, 'Refresh').click();
  await expect(notice(page)).toContainText('Repository refreshed');
  await expect(configuration).toHaveValue(configLocal);
  await button(page, 'Review configuration change').click();
  await reviewed(page);
  expect(seen.last('/api/propose').after).toBe(configLocal);
  await button(page, 'Close proposal').click();
  const current = JSON.parse(await readFile(join(f.root, 'intent/project.json'), 'utf8')); current.name = 'External configuration';
  await writeFile(join(f.root, 'intent/project.json'), JSON.stringify(current));
  await button(page, 'Refresh').click();
  await expect(page.locator('main')).toContainText('Edited source changed outside');
  await expect(configuration).toHaveValue(configLocal);
  const prior = seen.count('/api/propose');
  await button(page, 'Review configuration change').click();
  expect(seen.count('/api/propose')).toBe(prior);
  await button(page, 'Use current source and discard local edits').click();
  await expect.poll(async () => JSON.parse(await configuration.inputValue()).name).toBe('External configuration');
  // Nothing is left unsaved: another view opens without a refusal.
  await page.getByRole('navigation', { name: 'Project tools' }).getByRole('link', { name: 'Compare changes' }).click();
  await expect(page.getByRole('heading', { name: 'Review code with its meaning.' })).toBeVisible();
  expect(seen.errors).toEqual([]);
});

test('retains edits typed during refresh and through a deleted-source conflict', async ({ page }) => {
  const f = await editor(), seen = watch(page);
  await page.goto(sourceView(f));
  const source = page.getByRole('textbox', { name: 'Markdown source' });
  await expect(source).toBeVisible();
  const local = (await source.inputValue()).replace('Isolate storage behind an interface', 'Restore the intended storage boundary');
  const refreshing = button(page, 'Refresh').click();
  await source.fill(local);
  await refreshing;
  await expect(button(page, 'Refresh')).toBeEnabled();
  await expect(source).toHaveValue(local);
  await rm(join(f.root, f.path));
  await button(page, 'Refresh').click();
  await expect(page.locator('main')).toContainText('Edited source changed outside');
  await expect(source).toHaveValue(local);
  await button(page, 'Keep local text and review against current source').click();
  await expect(page.locator('main')).toContainText('Local text retained for source repair');
  await expect(source).toHaveValue(local);
  await button(page, 'Review source change').click();
  await reviewed(page);
  expect(seen.last('/api/propose').before).toBe(null); expect(seen.last('/api/propose').after).toBe(local);
  expect(seen.errors).toEqual([]);
});

test('restores a durable source draft, resolves changed originals and applies a fresh review', async ({ page, context }) => {
  const f = await editor();
  await page.goto(sourceView(f));
  const source = page.getByRole('textbox', { name: 'Markdown source' });
  await expect(source).toBeVisible();
  const before = await source.inputValue(), local = before.replace('Isolate storage behind an interface', 'Recovered local storage boundary');
  await source.fill(local);
  await expect(page.getByRole('status').filter({ hasText: 'Draft saved for recovery.' })).toBeVisible();
  expect((await f.request('/api/recovery')).draft.source).toBe(local);
  await writeFile(join(f.root, f.path), before + '\nExternal text after the draft was saved.\n');
  await page.close();
  const restarted = await context.newPage(), seen = watch(restarted);
  await restarted.goto(f.url);
  await expect(restarted.getByRole('heading', { name: 'Continue a draft or reviewed change.' })).toBeVisible();
  await button(restarted, 'Restore saved draft').click();
  const recovered = restarted.getByRole('textbox', { name: 'Recovered source' });
  await expect(recovered).toHaveValue(local);
  await expect(restarted.locator('main')).toContainText('Edited source changed outside');
  await button(restarted, 'Keep local text and review against current source').click();
  await button(restarted, 'Review recovered change').click();
  await reviewed(restarted);
  await button(restarted, 'Apply reviewed changes').click();
  await expect.poll(() => readFile(join(f.root, f.path), 'utf8')).toBe(local);
  await expect.poll(async () => (await f.request('/api/recovery')).draft).toBe(null);
  expect(seen.errors).toEqual([]);
});

test('builds local and Docker agent configurations without host settings writes', async ({ page }) => {
  const f = await editor(), seen = watch(page);
  await page.goto(f.url);
  await page.getByRole('link', { name: 'Connect an agent' }).click();
  const main = page.locator('main');
  await expect(main).toContainText('mcpServers'); await expect(main).toContainText('intent_inspect');
  await expect(page.getByRole('textbox', { name: 'Container name' })).toBeDisabled();
  await page.getByRole('radio', { name: 'Docker container' }).or(page.getByRole('button', { name: 'Docker container' })).click();
  await expect(main).toContainText('Enter the existing container name.');
  await page.getByRole('textbox', { name: 'Container name' }).fill('intent-project');
  const configuration = page.getByLabel('Agent configuration', { exact: true });
  await expect(configuration).toContainText('"docker"'); await expect(configuration).toContainText('"exec"'); await expect(configuration).toContainText('"-i"');
  await expect(configuration).not.toContainText('"-t"');
  expect(seen.errors).toEqual([]);
});

test('keyboard reaches every part in order with focus shown, collections take arrow keys, Escape closes the review', async ({ page }) => {
  const f = await editor({ [location('behavior')]: document(header('behavior')), [location('check')]: document(header('check')) }), seen = watch(page);
  await page.goto(f.url);
  await expect(page.getByRole('link', { name: 'New Product draft' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Operation recovery' })).toBeVisible();
  const focused = () => page.evaluate(() => ({ text: document.activeElement?.textContent?.trim(), outline: getComputedStyle(document.activeElement).outlineStyle }));
  await page.keyboard.press('Tab');
  expect(await focused()).toEqual({ text: 'Skip to content', outline: 'solid' });
  await page.keyboard.press('Tab');
  expect((await focused()).text).toBe('Intent Editor');
  await page.keyboard.press('Tab');
  expect((await focused()).text).toBe('Refresh');
  await page.keyboard.press('Tab');
  expect(await focused()).toEqual({ text: 'Project configuration', outline: 'solid' });
  // The records list is one stop; arrow keys move within it and Enter opens a record.
  const options = page.getByRole('listbox', { name: 'Records' }).getByRole('option');
  await expect(options).toHaveCount(3);
  await options.first().focus();
  const first = (await focused()).text;
  await page.keyboard.press('ArrowDown');
  const second = (await focused()).text;
  expect(second).not.toBe(first);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#\/record\//);
  await expect(options.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tab', { name: 'Meaning', selected: true })).toBeVisible();
  // Record views are tabs: arrows move focus, Enter opens, and the URL keeps the view.
  await page.getByRole('tab', { name: 'Meaning' }).focus();
  await page.keyboard.press('ArrowRight');
  expect((await focused()).text).toBe('Relationships');
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/source$/);
  const source = page.getByRole('textbox', { name: 'Markdown source' });
  await source.fill((await source.inputValue()) + '\nA reviewed line.\n');
  await button(page, 'Review source change').focus();
  await page.keyboard.press('Enter');
  await reviewed(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect((await focused()).text).toBe('Review source change');
  // Open work holds the view: back is refused with the reason, and the text stays.
  await page.goBack();
  await expect(notice(page)).toContainText('Apply or discard the open edit first.');
  await expect(source).toHaveValue(/A reviewed line\./);
  expect(seen.errors).toEqual([]);
});

test('every view passes axe at 1440px and 375px', async ({ page }) => {
  const f = await editor(), seen = watch(page);
  const record = encodeURIComponent(f.path);
  const views = ['#/', `#/record/${record}`, `#/record/${record}/relationships`, `#/record/${record}/implementation`, `#/record/${record}/source`, '#/new', '#/configuration', '#/practices', '#/comparison', '#/export', '#/agent', '#/recovery'];
  for (const width of [1440, 375]) {
    await page.setViewportSize({ width, height: width === 375 ? 812 : 1000 });
    for (const view of views) {
      await page.goto(`${f.url}/${view}`);
      await expect(page.locator('.project')).toHaveText('Refresh fixture');
      await page.waitForLoadState('networkidle');
      if (view === '#/configuration') await button(page, 'Read configuration').click();
      // React Aria's announcer briefly names a pending button by reference after it has gone.
      const results = await new AxeBuilder({ page }).exclude('[data-live-announcer]').analyze();
      expect(results.violations.map(violation => `${view} ${width}: ${violation.id} ${violation.nodes.map(node => node.target).join(' ')}`)).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), `${view} overflows at ${width}px`).toBeLessThanOrEqual(0);
    }
  }
  await page.goto(`${f.url}/#/record/${record}/source`);
  const source = page.getByRole('textbox', { name: 'Markdown source' });
  await source.fill((await source.inputValue()) + '\nAxe review.\n');
  await button(page, 'Review source change').click();
  await reviewed(page);
  const dialog = await new AxeBuilder({ page }).exclude('[data-live-announcer]').analyze();
  expect(dialog.violations.map(violation => `dialog: ${violation.id}`)).toEqual([]);
  expect(seen.errors).toEqual([]);
});
