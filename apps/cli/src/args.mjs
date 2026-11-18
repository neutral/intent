// The command line's arguments: options as `--x v` or `--x=v`, `--` ends options, only some repeat.

/**
 * Parse a command's arguments against its options, each `one` or `many`.
 * Returns {positional, options, help} or {error}.
 */
export function parseArgs(argv, spec) {
  const positional = [], options = {};
  let help = false, rest = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (rest || !a.startsWith('--')) { positional.push(a); continue; }
    if (a === '--') { rest = true; continue; }
    const eq = a.indexOf('=');
    const name = eq < 0 ? a.slice(2) : a.slice(2, eq);
    if (name === 'help') { help = true; continue; }
    if (!(name in spec)) return { error: `unknown option --${name}` };
    let value;
    if (eq >= 0) value = a.slice(eq + 1);
    else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) value = argv[++i];
    if (value === undefined || value === '') return { error: `--${name} needs a value` };
    if (spec[name] === 'many') (options[name] ??= []).push(value);
    else if (name in options) return { error: `--${name} is given twice, and it does not repeat` };
    else options[name] = value;
  }
  return { positional, options, help };
}

/** Whether `--help` appears among a command's arguments, before any `--`. */
export const asksHelp = (argv) => { const end = argv.indexOf('--'); return (end < 0 ? argv : argv.slice(0, end)).includes('--help'); };
