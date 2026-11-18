// Small file-system helpers: never follow a symbolic link where the format says not to.
import fs from 'node:fs';
import path from 'node:path';

export const lstat = (abs) => { try { return fs.lstatSync(abs); } catch { return null; } };
export const isFile = (abs) => !!lstat(abs)?.isFile();
export const isDir = (abs) => !!lstat(abs)?.isDirectory();
export const readBytes = (abs) => { try { return fs.readFileSync(abs); } catch { return null; } };
export const entries = (abs) => { try { return fs.readdirSync(abs, { withFileTypes: true }); } catch { return []; } };
/** The project path of `abs` under `root`, with `/` as the separator; `.` for the root itself. */
export const relative = (root, abs) => { const r = path.relative(root, abs).split(path.sep).join('/'); return r === '' ? '.' : r; };
export const inside = (rel) => rel !== '..' && !rel.startsWith('../') && !path.isAbsolute(rel);

/** Write a file, creating its folders. */
export function writeFile(abs, text) {
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, text);
}
