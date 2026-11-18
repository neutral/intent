// Diagnostics: code, severity, file, line and message; their order and how they are printed.
import { byPath } from './text.mjs';

const WARNINGS = new Set(['FILE_UNEXPECTED', 'CODE_ROOT_MISSING', 'CODE_ROOTS_EMPTY', 'PACK_APPLIES_EMPTY',
  'RELATION_REPEATED', 'APPLIES_KIND', 'RELATION_BOTH_SIDES']);

const MESSAGES = {
  FILE_UTF8: 'the file is not valid UTF-8, so it is not read',
  FILE_SYMLINK: 'a symbolic link inside intent/ is not followed',
  FILE_UNEXPECTED: 'Intent does not read this entry',
  PROJECT_JSON: 'the project file is not valid JSON, or repeats a member name',
  PROJECT_OBJECT: 'the project file is not a JSON object',
  PROJECT_FIELD_REQUIRED: 'the project file lacks a member: it has exactly "name", "code" and "packs"',
  PROJECT_FIELD_UNKNOWN: 'a member other than "name", "code" and "packs"',
  PROJECT_NAME: '"name" is not a nonblank string without control characters',
  PROJECT_CODE: '"code" is not an array of code roots',
  CODE_ROOT_INVALID: 'a code root is a project path or ".", outside intent/',
  CODE_ROOT_MISSING: 'this code root does not exist',
  CODE_ROOTS_EMPTY: '"code" is empty, so no file is code',
  PROJECT_PACKS: '"packs" is not an array of adoptions',
  PACK_ENTRY: 'an adoption is an object with exactly "name", "version", "fingerprint" and "applies" of the right forms',
  PACK_REPEATED: 'a second adoption of the same Pack',
  GLOB_INVALID: 'not a glob: a project path whose components may hold *, ? or a whole **',
  PACK_APPLIES_EMPTY: 'this Pack applies nowhere, so no fetch brings its Disciplines',
  PACK_COPY_MISSING: 'no copy folder in intent/discipline/ for this adoption',
  PACK_COPY_CHANGED: 'the copy differs from the release it was adopted from; a copy is never edited',
  PACK_NOT_ADOPTED: 'no adoption in intent/intent.json names this folder',
  PACK_MANIFEST: 'pack.json is missing or is not an object with exactly a valid "name", "version" and "title"',
  PACK_EMPTY: 'the release holds no record',
  RECORD_HEADER: 'the header is three lines: ---, {"id":"<layer>:<name>"}, ---',
  HEADER_JSON: 'the header line is not a JSON object',
  HEADER_FIELD_UNKNOWN: 'the header holds only "id"',
  ID_INVALID: '"id" is missing or not a record ID, <layer>:<name>',
  ID_DUPLICATE: 'another record file has this ID; this one is not read',
  RECORD_FOLDER: "the record is outside its layer's folder",
  DISCIPLINE_ID_PACK: 'a Discipline ID is discipline:<pack>.<name>, naming the Pack that holds it',
  DESCRIPTION_PLACE: 'a Description is placed at code outside intent/, a file Description at a file and a folder Description at a folder',
  DESCRIPTION_CODE_MISSING: 'the code this Description is placed at does not exist',
  RECORD_TITLE: 'a level-1 heading, the title, must follow the header',
  RECORD_SUMMARY: 'a summary paragraph must follow the title',
  TITLE_REPEATED: 'a second level-1 heading',
  SECTION_REPEATED: 'a second section of this name',
  SECTION_NAME: 'write the section name exactly: "Relations" or "Read against"',
  READ_AGAINST_NOT_LAST: 'the Read against section must be the last section',
  FENCE_UNCLOSED: 'this fence never closes and runs to the end of the file',
  CHECK_HEADING: 'a Check heading is a level-3 heading "### Check <slug>"',
  CHECK_SLUG: 'a Check slug is lower-case letters and digits in words joined by hyphens',
  CHECK_SLUG_REPEATED: 'an earlier Check of this record has this slug',
  CHECK_PLACE: 'a Check cannot sit in the Relations or Read against section',
  CHECK_LABEL_FORM: 'write the label exactly: **Claim.**, **Fails when.**, **Holds when.** or **Applied by.**',
  CHECK_FIELD_UNKNOWN: 'the fields are **Claim.**, **Holds when.**, **Fails when.**, **Evidence.**, **Limits.** and **Applied by.**',
  CHECK_FIELD_REPEATED: 'this field is written twice; the first is kept',
  CHECK_FIELD_EMPTY: 'this field has no value',
  CHECK_FIELD_MISSING: 'a Check needs Claim, Fails when and Applied by',
  CHECK_TEXT: 'text in a Check block that is not a field',
  CHECK_APPLIED_BY: 'Applied by is test, judgment or none yet',
  RELATION_LINE: 'not a relation: - <verb> <target>, with a known verb',
  PATH_INVALID: 'a covers target is a project path outside intent/',
  RELATION_LAYER: "this record's layer does not write this verb",
  APPLIES_FOLDER: 'applies is written in a file Description, the one placed at the test file',
  RELATION_TARGET_MISSING: 'no record has this ID',
  APPLIES_CHECK_MISSING: 'no Check that is read has this ID',
  COVERS_MISSING: 'no regular file is at this path',
  RELATION_TARGET_LAYER: 'the target is not of the layer this verb names',
  APPLIES_TEST_MISSING: 'the test name does not occur in the described file',
  RELATION_REPEATED: 'the same relation written twice',
  APPLIES_KIND: 'the Check this applies does not state Applied by test',
  RELATION_BOTH_SIDES: 'the Behavior already writes bounded by this Assurance; one side is enough',
  READ_AGAINST_LINE: 'not a stamp line, - <source> sha256:<16 hex>, or a repeated source',
  DISCIPLINE_READ_AGAINST: 'a Discipline has no Read against section',
  CODE_NAMES_ID: 'code names an Intent ID; code never names a record or a Check',
  FORM_HEADER: "the form's header is missing or changed",
  FORM_SECTION: 'a section or subsection of the form is missing',
  FORM_BLOCK_MISSING: 'a Check the form lists has no block',
  FORM_BLOCK_REPEATED: "this Check's block appears twice",
  FORM_BLOCK_UNLISTED: 'a block for a Check the form does not list',
  FORM_FIELD_REPEATED: 'this field is written twice in the block; the first is kept',
  FORM_RESULT: 'Result is held, failed, did not decide or not applied',
  FORM_APPLIED_BY: 'Applied by is <test file> "<test name>" or judgment for held, failed or did not decide, and nothing for not applied',
  FORM_JUDGED_BY: 'a judgment that held, failed or did not decide names who judged it, or says: the author; no other judge',
  FORM_EVIDENCE: 'Evidence is empty',
  FORM_HANDING_ON: 'a handing-on list holds at least one item, - none when there is nothing, and each test item is - <check id>, <test file> "<test name>"',
  FORM_CHECKS_CHANGED: 'the Checks for the change no longer match the form',
};

export const severityOf = (code) => (WARNINGS.has(code) ? 'warning' : 'error');

/** A diagnostic; `detail` is added to the message. */
export function diag(file, line, code, detail, extra) {
  const message = MESSAGES[code] + (detail ? `: ${detail}` : '');
  return { file, line: line ?? null, code, severity: severityOf(code), message, ...extra };
}

export const compareDiagnostics = (a, b) => byPath(a.file, b.file)
  || ((a.line ?? 0) - (b.line ?? 0)) || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
export const sortDiagnostics = (list) => [...list].sort(compareDiagnostics);

export const printDiagnostic = (d) => (d.line == null
  ? `${d.file}: ${d.severity} ${d.code} ${d.message}`
  : `${d.file}:${d.line}: ${d.severity} ${d.code} ${d.message}`);
