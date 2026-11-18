// Shared test helpers: temporary folders, git repositories with a fixed identity, and the command line.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const REPO = fileURLToPath(new URL('..', import.meta.url));
export const FIXTURES = path.join(REPO, 'spec/fixtures');
export const CLI = path.join(REPO, 'apps/cli/src/cli.mjs');

// Git in tests reads no system or user configuration and commits as a fixed identity.
Object.assign(process.env, {
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null',
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.com', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.com',
});

/** A new empty folder outside any repository; its real path. */
export function tempDir(prefix = 'intent-test-') {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

/** A copy of a fixture project, in a new folder of the same name. */
export function copyFixture(name) {
  const dir = path.join(tempDir(), name);
  fs.cpSync(path.join(FIXTURES, 'project', name), dir, { recursive: true });
  return dir;
}

export function git(cwd, ...args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}

/** A git repository on branch main, with the given files committed when `commit` is true. */
export function repo(files = {}, { commit = true, name = 'app' } = {}) {
  const dir = path.join(tempDir(), name);
  fs.mkdirSync(dir);
  git(dir, 'init', '-q', '-b', 'main');
  write(dir, files);
  if (commit && Object.keys(files).length) { git(dir, 'add', '-A'); git(dir, 'commit', '-q', '-m', 'first'); }
  return dir;
}

export function write(dir, files) {
  for (const [rel, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), text);
  }
}

export const readText = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');

/** Run the command line as a program: {code, out, err}. */
export function intent(cwd, ...args) {
  const r = spawnSync(process.execPath, [CLI, ...args], { cwd, encoding: 'utf8' });
  return { code: r.status, out: r.stdout, err: r.stderr };
}

/** A record file's text. */
export function record(id, title, body = '') {
  return `---\n${JSON.stringify({ id })}\n---\n# ${title}\n\n${body}`;
}
