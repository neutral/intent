// What `intent` alone, `intent --help` and each command's --help print.

/** The code-work flow, which both `intent` alone and `intent --help` print. */
const FLOW = [
  'While writing code:',
  '  before   intent fetch <words from your task> <paths you expect to touch>',
  '  after    intent checks          apply each Check, then fill the form it names',
  '           intent report <form>',
  '  how      intent guide using',
];

export const BANNER = [
  "Intent holds this project's intent and the Checks derived from it.",
  ...FLOW,
  'Everything else: intent --help',
];
export const NO_PROJECT_LINE = 'No intent/ here or above: intent start creates it.';

// What each command can be refused for, from its operation's Refuses, in the words its exit line uses.
const PROJECT = 'no intent/ found', CHANGE = 'no way to tell where the change starts', STALE = 'a stale --more token';
const either = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')}${list.length > 2 ? ',' : ''} or ${list.at(-1)}` : list[0]);
const exits = (findings, refused) => [`Exit codes: 0 it did what was asked; ${findings ? '1 findings to act on; ' : ''}2 refused: ${either(['bad arguments', ...refused])}.`];

/** Each command: its group, one line on what it does, its synopsis, its arguments and options, and its exits. */
export const HELP = {
  fetch: { group: 'reading', line: 'the intent bearing on paths, IDs or words, or on your change: every record named, then each given whole',
    synopsis: 'intent fetch [ARG]... [--base REV] [--more TOKEN]',
    args: ['ARG: a path, an ID or words, any number; with none, the change read from git.', '--base REV: where the change starts, only with no ARG, and otherwise ignored.',
      '--more TOKEN: continue a bounded answer from the token it printed.'], exits: exits(false, [PROJECT, STALE, CHANGE]) },
  search: { group: 'reading', line: 'candidate records and Checks for words, with excerpts; lexical only',
    synopsis: 'intent search WORDS... [--more TOKEN]', args: ['WORDS: one or more words.', '--more TOKEN: continue a bounded answer.'], exits: exits(false, [PROJECT, STALE]) },
  read: { group: 'reading', line: 'records or Checks, complete, with their relations both ways',
    synopsis: 'intent read ID...', args: ['ID: one or more record or Check IDs.'], exits: exits(false, [PROJECT]) },
  checks: { group: 'code work', line: 'the Checks bearing on your change, how each is applied, and a report form to fill',
    synopsis: 'intent checks [PATH]... [--base REV] [--judge CHECK-ID]',
    args: ['PATH: the changed paths, for when git cannot say; with none, the change read from git.', '--base REV: where the change starts, only with no PATH, and otherwise ignored.',
      '--judge CHECK-ID: print one Check\'s material for a judge other than you, and write no form.'],
    exits: exits(false, [PROJECT, 'a --judge Check that is unknown or that the change does not bring', CHANGE]) },
  report: { group: 'code work', line: 'check a filled report form against its rules and the change, and keep it, or say why not',
    synopsis: 'intent report [FORM]', args: ["FORM: a form's name or the path of its file."],
    exits: exits(true, [PROJECT, 'no such unkept form', 'a form already kept', CHANGE]) },
  start: { group: 'intent work', line: 'create intent/ in this folder, and list the code nobody explains',
    synopsis: 'intent start [--code-root PATH]...', args: ['--code-root PATH: a file or folder holding code, repeatable; with none, the whole folder.'],
    exits: exits(false, ['intent/intent.json already in this folder', 'a code root that is missing, outside this folder, in intent/ or not a project path']) },
  create: { group: 'intent work', line: "create a record with its ID and its layer's skeleton",
    synopsis: 'intent create LAYER TITLE... | intent create description PATH',
    args: ['LAYER: behavior, assurance or blueprint; TITLE: the rest of the arguments, joined with spaces.', 'description PATH: the file or folder the Description explains.'],
    exits: exits(false, [PROJECT, 'a layer, title or path it cannot create a record for', 'a Description already placed there']) },
  validate: { group: 'intent work', line: 'everything code can check in intent, each finding with its code, file and line',
    synopsis: 'intent validate', args: ['No arguments.'], exits: exits(true, [PROJECT]) },
  review: { group: 'intent work', line: 'what changed in intent since a base, record by record and section by section, and what it affects',
    synopsis: 'intent review [--base REV]', args: ['--base REV: the state to compare with; with none, where the change starts.'], exits: exits(false, [PROJECT, CHANGE]) },
  gaps: { group: 'intent work', line: 'code nobody explains, Behaviors and Assurances with no Check, Checks nothing applies, Descriptions that relate to nothing',
    synopsis: 'intent gaps', args: ['No arguments.'], exits: exits(false, [PROJECT]) },
  drift: { group: 'intent work', line: 'what changed under each record since it was last read against its sources',
    synopsis: 'intent drift [ID]...', args: ['ID: record IDs; none means every record.'], exits: exits(false, [PROJECT]) },
  stamp: { group: 'intent work', line: 'record that each record was reread against its sources as they are now',
    synopsis: 'intent stamp ID...', args: ['ID: one or more record IDs.'],
    exits: exits(false, [PROJECT, 'an ID it cannot stamp: a Check, an unknown record, a Discipline, or a record with no sources, a missing source or a Read against section it cannot rewrite']) },
  follow: { group: 'intent work', line: 'move Descriptions after code moves and update covered paths, from git',
    synopsis: 'intent follow', args: ['No arguments.'], exits: exits(true, [PROJECT, 'no git working tree that tracks the project']) },
  reports: { group: 'intent work', line: 'the kept reports that match, each as one agent\'s account, with no totals',
    synopsis: 'intent reports [--check ID] [--record ID] [--path PATH] [--since DATE]',
    args: ['--check ID: reports that list this Check.', '--record ID: reports that list a Check of this record.',
      '--path PATH: reports whose changed paths hold this path or a path under it.', '--since DATE: reports kept on this UTC day, YYYY-MM-DD, or later.'],
    exits: exits(false, [PROJECT]) },
  adopt: { group: 'intent work', line: 'copy a Pack release as released and record where it applies; on an update, what changed',
    synopsis: 'intent adopt DIR [--applies GLOB]...', args: ['DIR: a Pack release folder on this machine.', '--applies GLOB: where the Pack applies, repeatable.'],
    exits: exits(false, [PROJECT, 'a folder that is not a valid Pack release', 'a project file with errors adopting would rewrite']) },
  guide: { group: 'intent work', line: 'the page on working on intent; with a topic, the page on using it, a page of the base, the model page or a contract',
    synopsis: 'intent guide [TOPIC]',
    args: ['TOPIC: using for the page on using intent, a page of the base (principles, behavior, assurance, blueprint, description, discipline, checks, judge, keeping-true), base for its index,',
      '  spec for the model page, or a contract (spec/project, spec/records, spec/checks, spec/relations, spec/reports, spec/currency, spec/packs, spec/presentation, spec/portal);',
      '  with none, the page on working on intent.'],
    exits: exits(false, ['an unknown topic']) },
  mcp: { group: 'server', line: 'run the MCP server over standard input and output',
    synopsis: 'intent mcp [DIR]', args: ['DIR: the folder the server starts in; the working directory when absent.'],
    exits: ['Exit codes: 0 when its input ends; 2 when DIR is not a folder.'] },
  portal: { group: 'server', line: "serve the portal, where people read this project's intent, on this machine; with --export, write it as files",
    synopsis: 'intent portal [DIR] [--port PORT] [--base REV] | intent portal --export OUT [DIR]',
    args: ['DIR: the folder the project is found from; the working directory when absent.', '--port PORT: the port on 127.0.0.1; a free one when absent or 0.',
      '--base REV: the state the Review page compares with; with none, where the change starts.', '--export OUT: write every page but Review and Reports into the folder OUT, and serve nothing.'],
    exits: [`Exit codes: 0 when it is stopped, or when the export is written; 2 refused: ${either(['bad arguments', PROJECT, 'a port in use', 'a folder it must not write the export to'])}.`] },
};

/** One command's help. */
export function commandHelp(name) {
  const h = HELP[name];
  return [`Usage: ${h.synopsis}`, '', `${h.line[0].toUpperCase()}${h.line.slice(1)}.`, '', ...h.args, '', ...h.exits];
}

/** The code-work flow, then every command, grouped. */
export function overallHelp() {
  const out = ['Usage: intent <command> [ARGUMENT]... [OPTION]...', '', ...FLOW, ''];
  for (const [group, title] of [['reading', 'Reading, for both kinds of work:'], ['code work', 'Code work:'], ['intent work', 'Intent work:'], ['server', 'The servers:']]) {
    out.push(title, ...Object.entries(HELP).filter(([, h]) => h.group === group).map(([name, h]) => `  ${name.padEnd(10)}${h.line}`), '');
  }
  out.push('Every command takes --help. Working on intent: intent guide.');
  return out;
}
