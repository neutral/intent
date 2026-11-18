#!/usr/bin/env node
// The `intent` command: everything it prints goes to standard output; standard error only when the program fails.
import { runCommand } from './run.mjs';

const argv = process.argv.slice(2);
// A served portal stops when it is asked to, closes and exits 0. Every other command keeps Node's own handling of signals.
let signal;
if (argv[0] === 'portal') {
  const stop = new AbortController();
  for (const s of ['SIGINT', 'SIGTERM']) process.once(s, () => stop.abort());
  signal = stop.signal;
}

try {
  const { exitCode, text } = await runCommand(argv, { cwd: process.cwd(), signal });
  process.stdout.write(text);
  process.exitCode = exitCode;
} catch (error) {
  process.stderr.write(`intent: ${error?.stack ?? error}\n`);
  process.exitCode = 3;
}
