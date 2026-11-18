// The store: one JSON document in one file. A write lands whole or not at all.
import fs from 'node:fs';
import path from 'node:path';

const EMPTY = { entries: [] };

export function openStore(file) {
  return {
    /** The document as last written, or an empty one when nothing was written yet. */
    read() {
      try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch (error) {
        if (error.code === 'ENOENT') return structuredClone(EMPTY);
        throw error;
      }
    },
    /** Replace the document. The new one is written beside the old and then renamed over it. */
    write(document) {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const next = `${file}.next`;
      fs.writeFileSync(next, JSON.stringify(document));
      fs.renameSync(next, file);
    },
  };
}
