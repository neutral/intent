// The tools: one per command, its input schema built from the command's arguments and options, and the command line a call becomes.

const string = { type: 'string' };
const strings = { type: 'array', items: { type: 'string' } };
const atLeastOne = { type: 'array', items: { type: 'string' }, minItems: 1 };

/**
 * Each tool: its name and description, and its parameters in order, each as
 * [name, schema, where it goes on the command line, required]. Where it goes is
 * `arg` for a positional argument, or the name of the option.
 */
const TABLE = [
  ['fetch', 'The intent bearing on paths, IDs or words, or on your change: each record and Check with why it is included, and what nothing covers.',
    [['args', strings, 'arg'], ['base', string, 'base'], ['more', string, 'more']]],
  ['search', 'Candidate records and Checks for words, with excerpts; lexical only.',
    [['words', atLeastOne, 'arg', true], ['more', string, 'more']]],
  ['read', 'Records or Checks, complete, with their relations both ways; for a Check, the question a judge of its strength asks.',
    [['ids', atLeastOne, 'arg', true]]],
  ['checks', 'The Checks bearing on your change, how each is applied, and a report form to fill; with `judge`, one Check\'s material for a judge other than you.',
    [['paths', strings, 'arg'], ['base', string, 'base'], ['judge', string, 'judge']]],
  ['report', 'Check a filled report form against its rules and the change, and keep it, or say why not.',
    [['form', string, 'arg']]],
  ['start', 'Create intent/ in this folder, and list the code nobody explains.',
    [['codeRoot', strings, 'code-root']]],
  ['create', 'Create a record with its ID and its layer\'s skeleton: a title for a Behavior, Assurance or Blueprint, a path for a Description.',
    [['layer', string, 'arg', true], ['title', string, 'arg'], ['path', string, 'arg']]],
  ['validate', 'Everything code can check in intent, each finding with its code, file and line.', []],
  ['review', 'What changed in intent since BASE, record by record and section by section, and what it affects.',
    [['base', string, 'base']]],
  ['gaps', 'Code nobody explains, Behaviors and Assurances with no Check, Checks nothing applies, and Descriptions that relate to nothing.', []],
  ['drift', 'What changed under each record since it was last read against its sources.',
    [['ids', strings, 'arg']]],
  ['stamp', 'Record that each record was reread against its sources as they are now; nothing checks the reread.',
    [['ids', atLeastOne, 'arg', true]]],
  ['follow', 'Move Descriptions after code moves and update covered paths, from git.', []],
  ['reports', 'The kept reports that match, each as one agent\'s account, with no totals.',
    [['check', string, 'check'], ['record', string, 'record'], ['path', string, 'path'], ['since', string, 'since']]],
  ['adopt', 'Copy a Pack release as released and record where it applies; on an update, what changed.',
    [['dir', string, 'arg', true], ['applies', strings, 'applies']]],
  ['guide', 'The page on working on intent; with a topic, the page on using it, one page of what agents lean on for a kind of work, the model page or a contract.',
    [['topic', string, 'arg']]],
];

const PARAMS = new Map(TABLE.map(([name, , params]) => [name, params]));
/** The layers `create` makes from a title. */
const TITLED = ['behavior', 'assurance', 'blueprint'];

/** What `tools/list` returns, in the order of the commands. */
export const TOOLS = TABLE.map(([name, description, params]) => {
  const required = params.filter((p) => p[3]).map((p) => p[0]);
  return {
    name, description,
    inputSchema: { type: 'object', properties: Object.fromEntries(params.map(([p, schema]) => [p, schema])), additionalProperties: false, ...(required.length ? { required } : {}) },
  };
});

export const isTool = (name) => PARAMS.has(name);

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const lines = (list) => list.join('\n') + '\n';

/** The ARGS refusal the command prints, with the line saying what to do instead. */
const refusal = (name, message) => lines([`error ARGS ${message}`, `Run intent ${name} --help for its arguments and options.`]);

/** Why `args` does not fit the tool's input schema, or null. A parameter that is absent is left to the command, which counts its arguments. */
function misfit(name, params, args) {
  if (!isObject(args)) return `${name} takes its parameters as an object`;
  const known = params.map((p) => p[0]);
  for (const key of Object.keys(args)) {
    if (!known.includes(key)) return `unknown parameter ${key}; ${name} takes ${known.length ? known.join(', ') : 'no parameter'}`;
  }
  for (const [key, schema] of params) {
    if (!Object.hasOwn(args, key)) continue;
    const v = args[key];
    if (schema.type === 'array') {
      if (!Array.isArray(v) || !v.every((x) => typeof x === 'string')) return `${key} must be an array of strings`;
    } else if (typeof v !== 'string') return `${key} must be a string`;
  }
  if (name === 'create' && !Object.hasOwn(args, 'layer') && (Object.hasOwn(args, 'title') || Object.hasOwn(args, 'path'))) {
    return 'create takes layer, with title for behavior, assurance or blueprint and path for description';
  }
  // `title` and `path` are both positional, so a call that gives the one its layer does not take could be read as the other.
  // A layer the command cannot create, or a title it refuses, is left to the command, which says why.
  if (name === 'create' && Object.hasOwn(args, 'layer')) {
    if (args.layer === 'description' && Object.hasOwn(args, 'title')) return 'create with layer description takes path and no title';
    if (TITLED.includes(args.layer) && Object.hasOwn(args, 'path')) return `create with layer ${args.layer} takes title and no path`;
  }
  return null;
}

/**
 * The command line one call of a tool becomes: {argv}, the arguments after
 * `intent`; or {text}, the ARGS refusal when the call's arguments do not fit.
 * Options go as `--name=value`, so a value is never read as an option, and
 * positional arguments go after `--`, so none is read as an option or as
 * `--help`.
 */
export function commandLine(name, args = {}) {
  const params = PARAMS.get(name);
  const why = misfit(name, params, args);
  if (why) return { text: refusal(name, why) };
  const options = [], positional = [];
  for (const [key, , to] of params) {
    if (!Object.hasOwn(args, key)) continue;
    const values = Array.isArray(args[key]) ? args[key] : [args[key]];
    if (to === 'arg') positional.push(...values);
    else options.push(...values.map((v) => `--${to}=${v}`));
  }
  return { argv: [name, ...options, ...(positional.length ? ['--', ...positional] : [])] };
}
