// Checks for a change: the Checks bearing on it, how each is applied, and the report form; or one Check's material for a judge.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { decode, shellWord } from './text.mjs';
import { walk } from './walk.mjs';
import { kindOf, testsInForce } from './gaps.mjs';
import { givenChange, gitChange } from './change.mjs';
import { NO_GIT } from './git.mjs';
import { formText, readForm, changeFingerprint } from './form.mjs';
import { recordLine, titleOf, summaryOf, checkFields, pathLimits } from './render.mjs';
import { openProject, refuse, argsRefusal, answer, outOfDate, couldNotRead, closing, withClosing, command, count } from './answer.mjs';
import { entries, isFile, readBytes } from './fsx.mjs';

/** What a judge of a change against a Check is told: the judge is an agent that has read nothing else. */
const HOW_TO_JUDGE = ['You were handed this because the author of the change cannot judge it: an author sees what they meant to write.',
  'Decide from what is below and from the change itself. An account of the change written by its author is not the change.',
  'Read the claim, then what it fails when: those are the things to look for.',
  'Read the whole change against them, and the code around the changed lines where the claim reaches further than the change.',
  'Answer one of three, and say what you looked at:',
  '  held: what you examined, and why none of the failures is there.',
  '  failed: the place, and which failure it is.',
  '  did not decide: what you would need to see.',
  'A judge who could not tell has not approved. Never round "did not decide" to held because nothing looked wrong, or to failed because you were unsure.',
  'If the Check itself looks wrong, decide the change against it as it is written, and say what looked wrong separately.'];
/** The indent of the line under a listed Check: under its ID, past the two spaces and the kind's eleven characters. */
const UNDER = ' '.repeat(13);
/** The line naming paths git does not track, which no diff shows, when there are any. */
export const untrackedLine = (paths, label) => (paths.length ? [`${label}${paths.join(', ')}`] : []);
const CHANGE_INSTEAD = 'Name where the change starts with --base REV, or give the changed paths: intent checks PATH...';

/** Each Check of a walk with the changed paths it bears on. */
function bearing(M, change) {
  const per = new Map(change.paths.map((p) => [p, new Set(walk(M, { paths: [p], change: true }).records.map((r) => r.id))]));
  return (check) => {
    const rec = M.records.get(check.record);
    return change.paths.filter((p) => rec.wholeProduct || per.get(p).has(check.record));
  };
}

/** How the form says to apply a Check. */
function howToApply(M, c) {
  const tests = testsInForce(M, c.id);
  if (tests.length) return tests.map((t) => `run the test named "${t.test}" in ${t.path}.`);
  if (c.appliedBy === 'judgment') return ['judgment, by a judge other than you.'];
  if (c.appliedBy === 'test') return ['a test, but no test is named for it; find one that decides it, or report it as not applied.'];
  return ['nothing applies it yet; report it as not applied.'];
}

/** A form name not taken in intent/.reports/ or intent/.reports/kept/. */
function formName(root, now, random) {
  const day = now.toISOString().slice(0, 10);
  for (;;) {
    const name = `${day}-${random()}`;
    if (!isFile(path.join(root, 'intent/.reports', `${name}.md`)) && !isFile(path.join(root, 'intent/.reports/kept', `${name}.md`))) return name;
  }
}
const randomHex = () => crypto.randomBytes(2).toString('hex');

export function checks({ cwd, paths = [], base, judge, now = () => new Date(), random = randomHex }) {
  const p = openProject(cwd);
  if (p.refusal) return p.refusal;
  const { root, M } = p;
  if (judge !== undefined && !M.checks.has(judge)) {
    return refuse({ code: 'ID_UNKNOWN', message: `${judge} is not a Check that is read` }, 'Give --judge the ID of a Check this change brings, as intent checks lists it.');
  }
  let change;
  if (paths.length) {
    change = givenChange(M, cwd, paths);
    if (change.outside) return argsRefusal(`${change.outside.join(', ')} ${change.outside.length > 1 ? 'are' : 'is'} outside the project`, 'Give the changed paths inside the project.');
  } else {
    change = gitChange(M, base);
    if (change.refusal) return refuse(change.refusal, NO_GIT.has(change.refusal.code) ? 'Give the changed paths: intent checks PATH...' : CHANGE_INSTEAD);
  }
  const w = change.paths.length ? walk(M, { paths: change.paths, change: true }) : { records: [], checks: [] };
  const list = w.checks.map((id) => M.checks.get(id));
  const bearsOn = bearing(M, change);
  if (judge !== undefined) {
    if (!w.checks.includes(judge)) {
      return refuse({ code: 'JUDGE_NOT_IN_CHANGE', message: `the change does not bring ${judge}` }, 'Run intent checks to list the Checks this change brings, and give --judge one of them.');
    }
    const c = M.checks.get(judge), rec = M.records.get(c.record), on = bearsOn(c);
    return answer([`For a judge of ${judge}, other than the author of the change. Give the judge everything below, and the change, and nothing else.`, '',
      'How to judge:', ...HOW_TO_JUDGE.map((l) => `  ${l}`), '',
      'The Check:', `  ${judge}`, ...checkFields(M, c, '    '), '',
      'What it protects:', `  ${recordLine(rec)}`, `  ${summaryOf(rec)}`, ...rec.meaningText.split('\n').map((l) => (l ? `    ${l}` : '')), '',
      'The change it bears on:', ...on.map((x) => `  ${x}`),
      `  ${change.given ? 'the paths were given; read them as they are now' : `git -C ${shellWord(root)} diff ${change.base} -- ${on.map(shellWord).join(' ')}`}`,
      ...untrackedLine(on.filter((x) => change.untracked?.includes(x)), '  not tracked by git, so read them as they are: '), '',
      'The author writes your decision in the report, and who made it.']);
  }
  const how = change.given ? `${count(change.paths.length, 'path')} given on the command line, not read from git` : `${count(change.paths.length, 'path')} changed ${change.how}`;
  if (!change.paths.length) {
    return answer([`No Checks: the change touches no paths ${change.how}. No form was written. Give the changed paths (intent checks PATH...), or name another start with --base REV.`]);
  }
  const reports = path.join(root, 'intent/.reports');
  const removed = [];
  for (const e of entries(reports)) {
    if (!e.isFile() || !e.name.endsWith('.md')) continue;
    const name = e.name.slice(0, -3), text = decode(readBytes(path.join(reports, e.name)) ?? Buffer.alloc(0));
    const h = text === null ? null : readForm(text, name, () => true).header;
    if (!h) continue;
    const same = change.given ? h.given && JSON.stringify(h.paths) === JSON.stringify(change.paths) : !h.given && h.base === change.base;
    if (same) removed.push(name);
  }
  const time = now(), name = formName(root, time, random);
  const fp = changeFingerprint(root, change.given ? null : change.base, change.paths);
  const form = formText(name, time.toISOString(), { ...change, change: fp, root }, list.map((c) => ({ id: c.id, record: c.record,
    title: titleOf(M.records.get(c.record)), claim: c.claim, holdsWhen: c.holdsWhen, failsWhen: c.failsWhen, evidence: c.evidence, limits: c.limits, how: howToApply(M, c) })));
  for (const r of removed) fs.rmSync(path.join(reports, `${r}.md`));
  fs.mkdirSync(reports, { recursive: true });
  fs.writeFileSync(path.join(reports, `${name}.md`), form);

  const lines = [`${count(list.length, 'Check')} ${list.length === 1 ? 'bears' : 'bear'} on your change: ${how}.${paths.length && base !== undefined ? ' --base was ignored, since paths were given.' : ''}`];
  if (removed.length) lines.push(`This replaces the unkept form ${removed.join(', ')} for the same start; its results were not carried over, since the change may have moved under them.`);
  if (list.length) lines.push('', 'Checks:');
  // The judge's material is asked for with the change this command was given: its paths, or its base.
  for (const c of list) {
    const kind = kindOf(M, c);
    lines.push(`  ${kind.padEnd(11)}${c.id}`);
    if (kind === 'test') {
      const t = testsInForce(M, c.id);
      lines.push(...(t.length ? t.map((a) => `${UNDER}${a.path} "${a.test}"`) : [`${UNDER}no test is named for it: find one that decides it, or write one`]));
    } else if (kind === 'judgment') lines.push(`${UNDER}for a judge other than you: ${command('checks', paths, { before: ['--judge', c.id], after: base !== undefined ? ['--base', base] : [] })}`);
    else lines.push(`${UNDER}${kind === 'none yet' ? 'nothing can apply it yet' : 'it states no way to apply it'}: report it as not applied`);
  }
  const edits = change.paths.flatMap((x) => (M.explained.get(x) ?? []).map((id) => `${x}, which ${id} explains: if your change alters how that code works, say so in the form.`));
  if (edits.length) lines.push('', 'Code your change edits:', ...edits.map((x) => `  ${x}`));
  lines.push('', 'Apply each Check: run the tests named, and give each judgment Check to a judge other than you.',
    `Then fill intent/.reports/${name}.md, and run: intent report ${name}`);
  const lim = pathLimits(M, change.paths, { change: true });
  return answer(withClosing(lines, closing({ outOfDate: outOfDate(M, w.records.map((r) => r.id)), notCovered: lim.notCovered,
    outsideRoots: lim.outsideRoots, couldNotRead: couldNotRead(M, w.records.map((r) => M.records.get(r.id).file)) })));
}

