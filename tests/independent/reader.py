#!/usr/bin/env python3
"""An independent reader of Intent's files, written from the format contract as
it stood in one file, spec/FORMAT.md, and the fixture set in spec/fixtures/
alone. Those rules are now in the contracts of spec/, by subject. Since then it
has been changed with the contracts by the agent that changes the Library (the
six fields of a Check and its hash, from checks.md), so it is a second
implementation of them, and no longer an independent reading. Python 3
standard library only.

    reader.py record FILE [--label NAME]        one record file, outside any project
    reader.py project-file FILE [--root-name N] one intent/intent.json, read on its own
    reader.py pack DIR                          a Pack release folder
    reader.py project DIR                       a project folder (or a folder under it)
    reader.py form FILE --project DIR           a filled report form, as intent/.reports/FILE
    reader.py ids FILE                          ID-making cases (fixture shape), with `id` filled
    reader.py PATH                              the kind guessed from PATH

It prints one JSON object on standard output. Comments marked `FORMAT:<line>`
name the line of that file a rule came from; `DECIDED:` marks a place where
it was silent or ambiguous and this reader chose, with the fixture that
decided it when one did.
"""

import bisect
import hashlib
import json
import os
import re
import stat
import subprocess
import sys
import unicodedata

# ---------------------------------------------------------------- text (FORMAT:17-52)

WS = ' \t'  # FORMAT:22 white space is space and tab only
_ASCII_LOWER = {c: c + 32 for c in range(ord('A'), ord('Z') + 1)}


def trim(s):
    return s.strip(WS)


def rtrim(s):
    return s.rstrip(WS)


def lower(s):  # FORMAT:27 ASCII letters only
    return s.translate(_ASCII_LOWER)


def blank(line):
    return trim(line) == ''


def sha256_hex(b):
    return hashlib.sha256(b).hexdigest()


def short(b):  # FORMAT:48
    return sha256_hex(b)[:16]


def utf8(s):
    return s.encode('utf-8', 'surrogatepass')


def decode(data):
    try:
        return data.decode('utf-8')
    except UnicodeDecodeError:
        return None


def strip_bom(text):  # FORMAT:36 record files and report forms only
    return text[1:] if text.startswith('﻿') else text


def split_lines(text):  # FORMAT:41-44
    parts = text.split('\n')
    last = parts.pop()  # what follows the final LF ('' when the text ends with one)
    lines = [p[:-1] if p.endswith('\r') else p for p in parts]
    if last != '':
        lines.append(last)
    return lines


WS_RUN = re.compile(r'[ \t]+')

# ---------------------------------------------------------------- JSON (FORMAT:51)


class JSONError(Exception):
    pass


class Node:
    """A JSON value with the line it begins on. An object's value is a list of
    (name, line of the name, Node); an array's is a list of Node."""
    __slots__ = ('kind', 'value', 'line')

    def __init__(self, kind, value, line):
        self.kind, self.value, self.line = kind, value, line

    def member(self, name):
        for n, _, v in self.value:
            if n == name:
                return v
        return None


NUM_RE = re.compile(r'-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?')
HEX = set('0123456789abcdefABCDEF')
ESCAPES = {'"': '"', '\\': '\\', '/': '/', 'b': '\b', 'f': '\f', 'n': '\n', 'r': '\r', 't': '\t'}


class _JSONParser:
    def __init__(self, text):
        self.t = text
        self.i = 0
        self.nl = [k for k, c in enumerate(text) if c == '\n']

    def line(self, pos):
        return bisect.bisect_left(self.nl, pos) + 1

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else ''

    def ws(self):
        while self.i < len(self.t) and self.t[self.i] in ' \t\n\r':
            self.i += 1

    def value(self):
        c = self.peek()
        ln = self.line(self.i)
        if c == '{':
            return self.obj()
        if c == '[':
            return self.arr()
        if c == '"':
            return Node('string', self.string(), ln)
        for word, kind, val in (('true', 'bool', True), ('false', 'bool', False), ('null', 'null', None)):
            if self.t.startswith(word, self.i):
                self.i += len(word)
                return Node(kind, val, ln)
        m = NUM_RE.match(self.t, self.i)
        if m and m.end() > self.i:
            self.i = m.end()
            return Node('number', m.group(0), ln)
        raise JSONError('unexpected character')

    def obj(self):
        ln = self.line(self.i)
        self.i += 1
        members, names = [], set()
        self.ws()
        if self.peek() == '}':
            self.i += 1
            return Node('object', members, ln)
        while True:
            self.ws()
            if self.peek() != '"':
                raise JSONError('member name expected')
            nln = self.line(self.i)
            name = self.string()
            if name in names:  # FORMAT:51-52 a repeated member name is not valid JSON
                raise JSONError('repeated member')
            names.add(name)
            self.ws()
            if self.peek() != ':':
                raise JSONError('colon expected')
            self.i += 1
            self.ws()
            members.append((name, nln, self.value()))
            self.ws()
            c = self.peek()
            self.i += 1
            if c == ',':
                continue
            if c == '}':
                return Node('object', members, ln)
            raise JSONError('comma or brace expected')

    def arr(self):
        ln = self.line(self.i)
        self.i += 1
        items = []
        self.ws()
        if self.peek() == ']':
            self.i += 1
            return Node('array', items, ln)
        while True:
            self.ws()
            items.append(self.value())
            self.ws()
            c = self.peek()
            self.i += 1
            if c == ',':
                continue
            if c == ']':
                return Node('array', items, ln)
            raise JSONError('comma or bracket expected')

    def hex4(self):
        h = self.t[self.i:self.i + 4]
        if len(h) != 4 or not all(ch in HEX for ch in h):
            raise JSONError('bad unicode escape')
        self.i += 4
        return int(h, 16)

    def string(self):
        self.i += 1
        out = []
        while True:
            if self.i >= len(self.t):
                raise JSONError('unterminated string')
            c = self.t[self.i]
            if c == '"':
                self.i += 1
                return ''.join(out)
            if c == '\\':
                e = self.t[self.i + 1:self.i + 2]
                self.i += 2
                if e in ESCAPES:
                    out.append(ESCAPES[e])
                elif e == 'u':
                    code = self.hex4()
                    if 0xD800 <= code < 0xDC00 and self.t.startswith('\\u', self.i):
                        save = self.i
                        self.i += 2
                        low = self.hex4()
                        if 0xDC00 <= low < 0xE000:
                            code = 0x10000 + ((code - 0xD800) << 10) + (low - 0xDC00)
                        else:
                            self.i = save
                    out.append(chr(code))
                else:
                    raise JSONError('bad escape')
            elif ord(c) < 0x20:
                raise JSONError('control character in string')
            else:
                out.append(c)
                self.i += 1


def parse_json(text):
    p = _JSONParser(text)
    p.ws()
    node = p.value()
    p.ws()
    if p.i != len(text):
        raise JSONError('text after the value')
    return node


def to_py(node):
    if node.kind == 'object':
        return {n: to_py(v) for n, _, v in node.value}
    if node.kind == 'array':
        return [to_py(v) for v in node.value]
    if node.kind == 'number':
        t = node.value
        return float(t) if any(ch in t for ch in '.eE') else int(t)
    return node.value

# ---------------------------------------------------------------- paths, IDs, globs


def is_project_path(s):  # FORMAT:56-61
    if not isinstance(s, str) or s == '' or s.startswith('/') or s.endswith('/'):
        return False
    if '\\' in s or any(ord(c) <= 0x1F or ord(c) == 0x7F for c in s):
        return False
    return all(c not in ('', '.', '..') for c in s.split('/'))


def under_intent(p):
    return p == 'intent' or p.startswith('intent/')


LAYERS = ('behavior', 'assurance', 'blueprint', 'description', 'discipline')
NAME_RE = re.compile(r'[a-z0-9_](?:[a-z0-9._-]*[a-z0-9_])?')          # FORMAT:545
SLUG_RE = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*')                       # FORMAT:336
DISCIPLINE_NAME_RE = re.compile(r'[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?')   # FORMAT:611
PACK_NAME_RE = re.compile(r'[a-z0-9]+(?:-[a-z0-9]+)*')                  # FORMAT:721
PACK_VERSION_RE = re.compile(r'[0-9A-Za-z][0-9A-Za-z.+-]*')             # FORMAT:722
FINGERPRINT_RE = re.compile(r'sha256:[0-9a-f]{64}')                     # FORMAT:147
HASH16_RE = re.compile(r'[0-9a-f]{16}')


def is_record_id(s):  # FORMAT:541-545
    if not isinstance(s, str):
        return False
    parts = s.split(':')
    return len(parts) == 2 and parts[0] in LAYERS and NAME_RE.fullmatch(parts[1]) is not None


def is_check_id(s):  # FORMAT:547
    if not isinstance(s, str):
        return False
    parts = s.split(':')
    return (len(parts) == 3 and is_record_id(parts[0] + ':' + parts[1])
            and SLUG_RE.fullmatch(parts[2]) is not None)


def discipline_names_pack(rid, pack):  # FORMAT:609-612
    if not rid.startswith('discipline:'):
        return False
    name = rid[len('discipline:'):]
    head, dot, rest = name.partition('.')
    return dot == '.' and head == pack and DISCIPLINE_NAME_RE.fullmatch(rest) is not None


def is_glob(g):  # FORMAT:194-200
    if not is_project_path(g):
        return False
    # DECIDED: a component such as `***` "holds ** and anything else" (FORMAT:199), so it is invalid.
    return all(c == '**' or '**' not in c for c in g.split('/'))


# ---------------------------------------------------------------- diagnostics (FORMAT:919-1027)

WARNINGS = {'FILE_UNEXPECTED', 'CODE_ROOT_MISSING', 'CODE_ROOTS_EMPTY', 'PACK_APPLIES_EMPTY',
            'RELATION_REPEATED', 'APPLIES_KIND', 'RELATION_BOTH_SIDES'}


def diag(code, file, line, **extra):
    d = {'file': file, 'line': line, 'code': code,
         'severity': 'warning' if code in WARNINGS else 'error'}
    d.update(extra)
    return d


def sort_diags(ds):  # FORMAT:935-936
    return sorted(ds, key=lambda d: (d['file'], 0 if d['line'] is None else 1, d['line'] or 0, d['code']))


# ---------------------------------------------------------------- line forms (FORMAT:238-254)

def parse_heading(line):  # FORMAT:240-245
    n = 0
    while n < len(line) and line[n] == '#':
        n += 1
    if 1 <= n <= 6 and n < len(line) and line[n] == ' ':
        text = trim(line[n + 1:])
        if text:
            return n, text
    return None


def fence_open(line):  # FORMAT:247-249
    lead = len(line) - len(line.lstrip(' '))
    if lead > 3:
        return None
    rest = line[lead:]
    for ch in '`~':
        k = len(rest) - len(rest.lstrip(ch))
        if k >= 3:
            return ch, k
    return None


def fence_closes(line, fence):  # FORMAT:249-251
    ch, k = fence
    lead = len(line) - len(line.lstrip(' '))
    if lead > 3:
        return False
    rest = line[lead:]
    run = len(rest) - len(rest.lstrip(ch))
    return run >= k and blank(rest[run:])


FIELD_RE = re.compile(r'\*\*([A-Za-z ]+)([.:]?)\*\*([.:]?)(.*)', re.S)  # FORMAT:349-351
LABELS = ('Claim', 'Fails when', 'Holds when', 'Evidence', 'Limits', 'Applied by')  # checks.md: the six fields, in the order an unknown label is matched
LABEL_BY_LOWER = {lower(x): x for x in LABELS}
REQUIRED = ('Claim', 'Fails when', 'Applied by')
APPLIED_BY = ('test', 'judgment', 'none yet')
CHECK_HEADING_OTHER_RE = re.compile(r'Check[ \t]+[a-z0-9]+(?:-[a-z0-9]+)*')  # FORMAT:329-330


def check_heading_kind(level, text):
    """'check' for a Check heading, 'wrong' for a CHECK_HEADING one, None otherwise."""
    if level == 3:
        if text == 'Check' or (text.startswith('Check') and text[5] in WS):  # FORMAT:318-319
            return 'check'
        low = lower(text)
        if low == 'check' or (low.startswith('check') and text[5] in WS):  # FORMAT:327-328
            return 'wrong'
        return None
    if level in (2, 4, 5, 6) and CHECK_HEADING_OTHER_RE.fullmatch(text):  # FORMAT:329-331
        return 'wrong'
    return None


def section_kind(text):  # FORMAT:303-306
    if text == 'Relations':
        return 'rel', False
    if text == 'Read against':
        return 'ra', False
    low = lower(text)
    if low.endswith(':'):
        low = low[:-1]
    if low == 'relations':
        return 'rel', True
    if low == 'read against':
        return 'ra', True
    return 'prose', False


class CheckBlock:
    """The lines of one Check block, read by FORMAT:364-407. When `read` is
    False the Check is not read and nothing is reported on its lines
    (FORMAT:340-341), but the lines are still followed so that, in the
    Relations and Read against sections, the block ends where FORMAT:343-347 says."""

    def __init__(self, line, slug, read):
        self.line, self.slug, self.read = line, slug, read
        self.fields = {}      # label -> {'value', 'line'} of its first line
        self.unknown = []     # {'label', 'line'}
        self.cont = None      # the field line being continued
        self.text_run = False
        self.diags = []       # (code, line, extra)

    def report(self, code, line, **extra):
        if self.read:
            self.diags.append((code, line, extra))

    def holds_in_list_section(self, line):  # FORMAT:343-347
        if blank(line) or FIELD_RE.fullmatch(line):
            return True
        return self.cont is not None and not line.startswith('- ')

    def feed(self, line, ln):
        if blank(line):  # rule 1
            self.cont = None
            self.text_run = False
            return
        m = FIELD_RE.fullmatch(line)
        if m:
            self.text_run = False
            label, inside, outside, rest = m.groups()
            key = lower(trim(label))
            canon = LABEL_BY_LOWER.get(key)
            if canon:  # rule 2
                if not (label == canon and inside == '.' and outside == ''):
                    self.report('CHECK_LABEL_FORM', ln)
                entry = {'value': trim(rest), 'line': ln}
                if canon in self.fields:  # FORMAT:386-389
                    self.report('CHECK_FIELD_REPEATED', ln)
                else:
                    self.fields[canon] = entry
                self.cont = {'entry': entry, 'unknown': False}
            else:  # rule 3
                self.unknown.append({'label': key, 'line': ln})
                self.cont = {'unknown': True}
            return
        if self.cont is not None:  # rule 4
            if not self.cont['unknown']:  # checks.md: a value is one paragraph on any number of lines
                e = self.cont['entry']
                e['value'] = trim(e['value'] + ' ' + trim(line))
            return
        if not self.text_run:  # rule 5
            self.report('CHECK_TEXT', ln)
            self.text_run = True

    def finish(self, record_id):
        """Return the Check as read, or None when it is not read."""
        if not self.read:
            return None
        for canon in LABELS:
            e = self.fields.get(canon)
            if e is not None and e['value'] == '':
                self.report('CHECK_FIELD_EMPTY', e['line'])
        matched = set()
        for u in self.unknown:  # FORMAT:392-399
            words = [w for w in u['label'].split(' ') if w]
            first = words[0] if words else None
            stands = None
            for canon in LABELS:
                if canon in self.fields or canon in matched:
                    continue
                if lower(canon).split(' ')[0] == first:
                    stands = canon
                    break
            if stands is None:
                free = [c for c in REQUIRED if c not in self.fields and c not in matched]
                if len(free) == 1:
                    stands = free[0]
            if stands is not None:
                matched.add(stands)
            self.report('CHECK_FIELD_UNKNOWN', u['line'], standsFor=stands)
        for canon in REQUIRED:  # FORMAT:400-401
            if canon not in self.fields and canon not in matched:
                self.report('CHECK_FIELD_MISSING', self.line)
        applied = None
        e = self.fields.get('Applied by')
        if e is not None and e['value'] != '':  # FORMAT:402-407
            v = e['value']
            if v.endswith('.'):
                v = v[:-1]
            v = WS_RUN.sub(' ', lower(trim(v)))
            if v in APPLIED_BY:
                applied = v
            else:
                self.report('CHECK_APPLIED_BY', e['line'])

        def value(label):
            f = self.fields.get(label)
            return f['value'] if f else ''
        claim, fails, holds = value('Claim'), value('Fails when'), value('Holds when')
        evidence, limits = value('Evidence'), value('Limits')
        hashed = claim + '\n' + fails + '\n' + holds  # FORMAT:676-677
        if evidence != '' or limits != '':  # checks.md, The Check hash
            hashed += '\n' + evidence + '\n' + limits
        return {
            'id': record_id + ':' + self.slug,
            'line': self.line,
            'claim': claim,
            'failsWhen': fails,
            'holdsWhen': holds,
            'evidence': evidence,
            'limits': limits,
            'appliedBy': applied,
            'hash': short(utf8(hashed)),
        }


# ---------------------------------------------------------------- relation and stamp lines

VERBS = ('bounded by', 'bounds', 'serves', 'follows', 'keeps', 'covers', 'applies', 'practice')  # FORMAT:439-440
WRITTEN_BY = {  # FORMAT:422-432
    'serves': {'description', 'blueprint'},
    'follows': {'description'},
    'keeps': {'description', 'blueprint'},
    'bounded by': {'behavior'},
    'bounds': {'assurance'},
    'bounds the whole product': {'assurance'},
    'covers': {'description'},
    'applies': {'description'},
    'practice': {'blueprint'},
}
TARGET_LAYER = {'serves': 'behavior', 'follows': 'blueprint', 'keeps': 'assurance',
                'bounded by': 'assurance', 'bounds': 'behavior', 'practice': 'discipline'}
APPLIES_TARGET_RE = re.compile(r' +"(.+)"', re.S)  # FORMAT:440-443


def parse_relation(line, layer):
    """Return (relation, None) or (None, code) for a nonblank line of the Relations section."""
    s = rtrim(line)  # FORMAT:418
    if not s.startswith('- '):
        return None, 'RELATION_LINE'
    rest = s[2:]
    if rest == 'bounds the whole product':  # FORMAT:439
        rel = {'verb': 'bounds the whole product'}
    else:
        verb = target = None
        for v in VERBS:
            if rest.startswith(v + ' '):
                verb, target = v, rest[len(v) + 1:]
                break
        if verb is None or target == '' or target[0] in WS:  # FORMAT:436-438
            return None, 'RELATION_LINE'
        if verb == 'covers':
            if not is_project_path(target) or under_intent(target):  # FORMAT:453-454
                return None, 'PATH_INVALID'
            rel = {'verb': verb, 'target': target}
        elif verb == 'applies':
            cid, comma, after = target.partition(',')
            m = APPLIES_TARGET_RE.fullmatch(after) if comma else None
            if m is None or not is_check_id(cid):
                return None, 'RELATION_LINE'
            rel = {'verb': verb, 'target': cid, 'test': m.group(1)}
        else:
            if not is_record_id(target):
                return None, 'RELATION_LINE'
            rel = {'verb': verb, 'target': target}
    if layer not in WRITTEN_BY[rel['verb']]:  # FORMAT:455
        return None, 'RELATION_LAYER'
    return rel, None


def parse_stamp(line):  # FORMAT:486-492
    s = rtrim(line)
    if not s.startswith('- '):
        return None
    at = s.rfind(' sha256:')
    if at < 2:
        return None
    source, h = s[2:at], s[at + len(' sha256:'):]
    if not HASH16_RE.fullmatch(h):
        return None
    if not (is_record_id(source) or is_check_id(source) or is_project_path(source)):
        return None
    return {'source': source, 'hash': h}


# ---------------------------------------------------------------- record files (FORMAT:206-496)

def read_record_lines(lines):
    """Read a record's lines. Return (record or None, [(code, line, extra)])."""
    out = []

    def report(code, line, **extra):
        out.append((code, line, extra))

    n = len(lines)
    # Header, FORMAT:256-271
    if n < 3 or lines[0] != '---':
        report('RECORD_HEADER', 1)
        return None, out
    if lines[2] != '---':
        report('RECORD_HEADER', 3)
        return None, out
    try:
        header = parse_json(lines[1])
    except JSONError:
        header = None
    if header is None or header.kind != 'object':
        report('HEADER_JSON', 2)
        return None, out
    idn = header.member('id')
    if idn is None or idn.kind != 'string' or not is_record_id(idn.value):
        report('ID_INVALID', 2)
        return None, out
    if len(header.value) > 1:
        report('HEADER_FIELD_UNKNOWN', 2)
    rid = idn.value
    layer = rid.split(':')[0]

    # Title, FORMAT:275-279
    i = 3
    while i < n and blank(lines[i]):
        i += 1
    h = parse_heading(lines[i]) if i < n else None
    title, title_missing, title_line = '', False, None
    if h is not None and h[0] == 1:
        title, title_line = h[1], i + 1
        j = i + 1
        while j < n and blank(lines[j]):
            j += 1
    else:
        title_missing = True
        report('RECORD_TITLE', i + 1 if i < n else 3)
        j = i  # DECIDED (records/invalid/title-missing.md): "goes on from that line" means the summary may start on it.

    # Summary, FORMAT:281-288
    summary_lines = []
    if j < n and parse_heading(lines[j]) is None and fence_open(lines[j]) is None:
        k = j
        while k < n and not blank(lines[k]) and parse_heading(lines[k]) is None:
            summary_lines.append(trim(lines[k]))
            k += 1
        body = k
    else:
        if not title_missing:
            report('RECORD_SUMMARY', j + 1 if j < n else title_line)
        body = j

    # Body, one pass: sections, fences, Check blocks, relations, stamps.
    removed = [False] * n   # lines the meaning hash leaves out (FORMAT:664-668)
    section = 'lead'
    seen_rel = seen_ra = ra_seen = not_last = False
    has_ra = False
    fence = None
    block = None
    checks, slugs, relations, stamps, stamped = [], set(), [], [], set()

    def close_block(b):
        chk = b.finish(rid)
        for code, ln, extra in b.diags:
            report(code, ln, **extra)
        if chk is not None:
            checks.append(chk)

    for k in range(body, n):
        line, ln = lines[k], k + 1
        if fence is not None:  # FORMAT:249-252
            if fence_closes(line, fence[:2]):
                fence = None
            continue
        h = parse_heading(line)
        if block is not None:
            if h is not None:
                close_block(block)
                block = None
            elif section in ('rel', 'ra') and not block.holds_in_list_section(line):
                close_block(block)
                block = None
            else:
                block.feed(line, ln)
                removed[k] = True
                continue
        if h is not None:
            level, text = h
            if level == 1:  # FORMAT:290-293
                report('TITLE_REPEATED', ln)
                removed[k] = section in ('rel', 'ra')
                continue
            kind = check_heading_kind(level, text)
            if level == 2:  # FORMAT:297-314
                sk, misnamed = section_kind(text)
                if ra_seen and sk != 'ra' and not not_last:
                    report('READ_AGAINST_NOT_LAST', ln)
                    not_last = True
                if misnamed:
                    report('SECTION_NAME', ln)
                if sk == 'rel':
                    if seen_rel:
                        report('SECTION_REPEATED', ln)
                    seen_rel = True
                elif sk == 'ra':
                    if seen_ra:
                        report('SECTION_REPEATED', ln)
                    seen_ra = ra_seen = has_ra = True
                    if layer == 'discipline':  # FORMAT:493-496
                        report('DISCIPLINE_READ_AGAINST', ln)
                section = sk
                removed[k] = sk in ('rel', 'ra')
                if kind == 'wrong':  # FORMAT:329-331: a level-2 one still starts a section
                    report('CHECK_HEADING', ln)
                    block = CheckBlock(ln, '', False)
                    removed[k] = True
                continue
            if kind == 'check':  # FORMAT:336-341
                slug = trim(text[5:])
                read = False
                if section in ('rel', 'ra'):
                    report('CHECK_PLACE', ln)
                elif not SLUG_RE.fullmatch(slug):
                    report('CHECK_SLUG', ln)
                elif slug in slugs:
                    report('CHECK_SLUG_REPEATED', ln)
                else:
                    read = True
                    slugs.add(slug)
                block = CheckBlock(ln, slug, read)
                removed[k] = True
                continue
            if kind == 'wrong':
                # DECIDED: a CHECK_HEADING heading in the Relations or Read against section is
                # CHECK_HEADING ("checked before the rules below", FORMAT:333), not RELATION_LINE
                # or READ_AGAINST_LINE (FORMAT:418-419, 492-493). No fixture has one.
                report('CHECK_HEADING', ln)
                block = CheckBlock(ln, '', False)
                removed[k] = True
                continue
            if section == 'rel':  # FORMAT:418-419
                report('RELATION_LINE', ln)
            elif section == 'ra':  # FORMAT:492-493
                report('READ_AGAINST_LINE', ln)
            removed[k] = section in ('rel', 'ra')
            continue
        if section == 'rel':
            removed[k] = True
            if not blank(line):
                rel, code = parse_relation(line, layer)
                if rel is None:
                    report(code, ln)
                else:
                    rel['line'] = ln
                    relations.append(rel)
        elif section == 'ra':
            removed[k] = True
            if not blank(line):
                st = parse_stamp(line)
                if st is None or st['source'] in stamped:
                    report('READ_AGAINST_LINE', ln)
                else:
                    stamped.add(st['source'])
                    st['line'] = ln
                    stamps.append(st)
        else:
            fo = fence_open(line)
            if fo is not None:
                fence = (fo[0], fo[1], ln)
    if block is not None:
        close_block(block)
    if fence is not None:
        report('FENCE_UNCLOSED', fence[2])

    # The meaning hash, FORMAT:660-674
    kept = [rtrim(lines[k]) for k in range(3, n) if not removed[k]]
    while kept and kept[0] == '':
        kept.pop(0)
    while kept and kept[-1] == '':
        kept.pop()
    text = []
    for x in kept:
        if x == '' and text and text[-1] == '':
            continue
        text.append(x)
    record = {
        'id': rid,
        'layer': layer,
        'title': title,
        'summary': ' '.join(summary_lines),
        'meaningHash': short(utf8('\n'.join(text))),
        'checks': checks,
        'relations': relations,
        'hasReadAgainst': has_ra,
        'readAgainst': stamps,
    }
    return record, out


def read_record_bytes(data):
    """(record or None, diagnostics as (code, line, extra)), applying FORMAT:34-37."""
    text = decode(data)
    if text is None:
        return None, [('FILE_UTF8', None, {})]
    return read_record_lines(split_lines(strip_bom(text)))


def public_record(rec):
    keys = ('id', 'layer', 'title', 'summary', 'meaningHash', 'checks', 'relations',
            'hasReadAgainst', 'readAgainst')
    return {k: rec[k] for k in keys}


def cmd_record(path, label):
    with open(path, 'rb') as f:
        rec, ds = read_record_bytes(f.read())
    return {
        'record': public_record(rec) if rec else None,
        'diagnostics': sort_diags([diag(c, label, ln, **x) for c, ln, x in ds]),
    }


# ---------------------------------------------------------------- the project file (FORMAT:108-172)

PROJECT_FILE = 'intent/intent.json'


def read_project_file(data, root_name):
    """Return (project, info, diagnostics). `info` holds what the tree checks need."""
    ds = []
    info = {'adoptions': [], 'names': set(), 'root_lines': {}}
    project = {'name': root_name, 'code': ['.'], 'packs': []}  # FORMAT:159-160

    def report(code, line):
        ds.append(diag(code, PROJECT_FILE, line))

    text = decode(data)
    if text is None:
        ds.append(diag('FILE_UTF8', PROJECT_FILE, None))
        return project, info, ds
    try:
        top = parse_json(text)  # FORMAT:38: no byte order mark is removed
    except JSONError:
        report('PROJECT_JSON', 1)
        return project, info, ds
    if top.kind != 'object':
        report('PROJECT_OBJECT', 1)
        return project, info, ds
    members = {}
    for name, nline, v in top.value:
        if name in ('name', 'code', 'packs'):
            members[name] = (nline, v)
        else:
            report('PROJECT_FIELD_UNKNOWN', nline)
    for name in ('name', 'code', 'packs'):
        if name not in members:
            report('PROJECT_FIELD_REQUIRED', 1)

    if 'name' in members:  # FORMAT:133-134
        nline, v = members['name']
        if (v.kind == 'string' and trim(v.value) != ''
                and not any(ord(c) <= 0x1F or ord(c) == 0x7F for c in v.value)):
            project['name'] = v.value
        else:
            report('PROJECT_NAME', nline)

    if 'code' in members:  # FORMAT:135-140
        nline, v = members['code']
        if v.kind != 'array':
            report('PROJECT_CODE', nline)
        else:
            roots = []
            for el in v.value:
                s = el.value if el.kind == 'string' else None
                if s is not None and (s == '.' or is_project_path(s)) and not under_intent(s):
                    if s not in roots:
                        roots.append(s)
                        info['root_lines'][s] = el.line
                else:
                    report('CODE_ROOT_INVALID', el.line)
            if not v.value:
                ds.append(diag('CODE_ROOTS_EMPTY', PROJECT_FILE, nline))
            project['code'] = roots

    if 'packs' in members:  # FORMAT:141-150
        nline, v = members['packs']
        if v.kind != 'array':
            report('PROJECT_PACKS', nline)
        else:
            seen, packs = set(), []
            for el in v.value:
                if el.kind == 'object':
                    nm = el.member('name')
                    if nm is not None and nm.kind == 'string':
                        info['names'].add(nm.value)  # FORMAT:763-766
                fields = {n: (ln, x) for n, ln, x in el.value} if el.kind == 'object' else {}
                ok = (el.kind == 'object'
                      and set(fields) == {'name', 'version', 'fingerprint', 'applies'}
                      and len(el.value) == 4)
                if ok:
                    name, version = fields['name'][1], fields['version'][1]
                    fp, applies = fields['fingerprint'][1], fields['applies'][1]
                    ok = (name.kind == 'string' and PACK_NAME_RE.fullmatch(name.value) is not None
                          and version.kind == 'string' and PACK_VERSION_RE.fullmatch(version.value) is not None
                          and fp.kind == 'string' and FINGERPRINT_RE.fullmatch(fp.value) is not None
                          and applies.kind == 'array')
                if not ok:
                    report('PACK_ENTRY', el.line)
                    continue
                left_out = False
                if name.value in seen:
                    report('PACK_REPEATED', el.line)
                    left_out = True
                seen.add(name.value)
                for g in applies.value:
                    if not (g.kind == 'string' and is_glob(g.value)):
                        report('GLOB_INVALID', g.line)
                        left_out = True
                if not applies.value:
                    # DECIDED: reported on every adoption with an empty `applies`, a left-out one too.
                    ds.append(diag('PACK_APPLIES_EMPTY', PROJECT_FILE, fields['applies'][0]))
                if left_out:
                    continue
                packs.append({'name': name.value, 'version': version.value,
                              'fingerprint': fp.value, 'applies': [g.value for g in applies.value]})
                info['adoptions'].append({'name': name.value, 'nameLine': fields['name'][0],
                                          'fingerprint': fp.value})
            project['packs'] = packs
    return project, info, ds


def cmd_project_file(path, root_name):
    if root_name is None:
        here = os.path.dirname(os.path.abspath(path))
        root_name = os.path.basename(os.path.dirname(here))
    with open(path, 'rb') as f:
        project, _, ds = read_project_file(f.read(), root_name)
    return {'project': project, 'diagnostics': sort_diags(ds)}


# ---------------------------------------------------------------- the file system

def lstat(p):
    try:
        return os.lstat(p)
    except OSError:
        return None


def is_regular(p):
    st = lstat(p)
    return st is not None and stat.S_ISREG(st.st_mode)


def is_dir(p):
    st = lstat(p)
    return st is not None and stat.S_ISDIR(st.st_mode)


def read_bytes(p):
    with open(p, 'rb') as f:
        return f.read()


def release_files(folder):  # FORMAT:712-715, 756-757
    names = []
    for e in os.listdir(folder):
        if not e.startswith('.') and e.endswith('.md') and is_regular(os.path.join(folder, e)):
            names.append(e)
    return sorted(names)


def fingerprint(folder, names):  # FORMAT:743-747
    lines = [n + ' ' + sha256_hex(read_bytes(os.path.join(folder, n))) for n in names]
    return 'sha256:' + sha256_hex(utf8('\n'.join(lines)))


# ---------------------------------------------------------------- Pack releases (FORMAT:710-747)

def cmd_pack(folder):
    ds = []
    manifest = None
    pj = os.path.join(folder, 'pack.json')
    if is_regular(pj):
        text = decode(read_bytes(pj))
        try:
            node = parse_json(text) if text is not None else None
        except JSONError:
            node = None
        if node is not None and node.kind == 'object':
            m = {n: v for n, _, v in node.value}
            if (set(m) == {'name', 'version', 'title'} and len(node.value) == 3
                    and m['name'].kind == 'string' and PACK_NAME_RE.fullmatch(m['name'].value)
                    and m['version'].kind == 'string' and PACK_VERSION_RE.fullmatch(m['version'].value)
                    and m['title'].kind == 'string' and trim(m['title'].value) != ''):
                manifest = {'name': m['name'].value, 'version': m['version'].value,
                            'title': m['title'].value}
    if manifest is None:
        ds.append(diag('PACK_MANIFEST', 'pack.json', 1))
    names = release_files(folder)
    if not names:
        # DECIDED: "holds at least one record" (FORMAT:730-731) counts record files, whatever their headers.
        ds.append(diag('PACK_EMPTY', 'pack.json', 1))
    records, ids = [], set()
    for name in names:
        rec, rds = read_record_bytes(read_bytes(os.path.join(folder, name)))
        if rec is not None and rec['id'] in ids:  # FORMAT:735-737
            ds.append(diag('ID_DUPLICATE', name, 2))
            continue
        ds.extend(diag(c, name, ln, **x) for c, ln, x in rds)
        if rec is None:
            continue
        ids.add(rec['id'])
        if manifest is not None and not discipline_names_pack(rec['id'], manifest['name']):
            ds.append(diag('DISCIPLINE_ID_PACK', name, 2))  # FORMAT:731-734
        records.append({'file': name, 'id': rec['id'], 'meaning': rec['meaningHash'],
                        'checks': [{'id': c['id'], 'hash': c['hash']} for c in rec['checks']]})
    ds = sort_diags(ds)
    return {
        'valid': not any(d['severity'] == 'error' for d in ds),
        'manifest': manifest,
        'fingerprint': fingerprint(folder, names),
        'records': records,
        'diagnostics': ds,
    }


# ---------------------------------------------------------------- projects

def find_root(start):  # FORMAT:82-84
    d = os.path.abspath(start)
    while True:
        if is_regular(os.path.join(d, 'intent', 'intent.json')):
            return d
        parent = os.path.dirname(d)
        if parent == d:
            return None
        d = parent


def git_listing(root):  # FORMAT:183-186
    """The paths git lists, or None when the condition holds for every file."""
    def git(*args):
        return subprocess.run(['git', *args], cwd=root, capture_output=True)
    try:
        r = git('rev-parse', '--is-inside-work-tree')
    except OSError:
        return None  # DECIDED: with no git, the project is read as outside any git working tree.
    if r.returncode != 0 or r.stdout.strip() != b'true':
        return None
    if git('check-ignore', '-q', PROJECT_FILE).returncode == 0:
        return None
    r = git('ls-files', '--cached', '--others', '--exclude-standard', '-z')
    # DECIDED: the listing is read with -z, so paths are not C-quoted (FORMAT:185 says "prints").
    return {p for p in r.stdout.decode('utf-8', 'surrogateescape').split('\0') if p}


def code_files(root, roots):  # FORMAT:174-187
    listing = git_listing(root)
    found = set()

    def consider(p):
        comps = p.split('/')
        if not is_project_path(p) or under_intent(p):
            return
        if any(c.startswith('.') or c == 'node_modules' for c in comps):
            return
        full = os.path.join(root, p)
        if not is_regular(full):
            return
        if listing is not None and p not in listing:
            return
        with open(full, 'rb') as f:
            if b'\0' in f.read(8000):
                return
        found.add(p)

    for r in roots:
        base = root if r == '.' else os.path.join(root, r)
        if is_regular(base):
            consider(r)
        elif is_dir(base):
            for dirpath, dirnames, filenames in os.walk(base):
                rel = os.path.relpath(dirpath, root).replace(os.sep, '/')
                rel = '' if rel == '.' else rel + '/'
                dirnames[:] = [d for d in dirnames
                               if not d.startswith('.') and d != 'node_modules'
                               and not under_intent(rel + d)]
                for fn in filenames:
                    consider(rel + fn)
    return sorted(found)


def walk_intent(root, ds):
    """The record files under the layer folders, and the walk's diagnostics (FORMAT:86-102)."""
    intent = os.path.join(root, 'intent')
    records = []

    def walk_layer(full, rel):
        for e in sorted(os.listdir(full)):
            if e.startswith('.'):
                continue
            p, r = os.path.join(full, e), rel + '/' + e
            st = lstat(p)
            if stat.S_ISLNK(st.st_mode):
                ds.append(diag('FILE_SYMLINK', r, None))
            elif stat.S_ISDIR(st.st_mode):
                walk_layer(p, r)
            elif stat.S_ISREG(st.st_mode) and e.endswith('.md'):
                records.append(r)
            else:
                ds.append(diag('FILE_UNEXPECTED', r, None))

    for e in sorted(os.listdir(intent)):
        if e.startswith('.'):
            continue
        p, r = os.path.join(intent, e), 'intent/' + e
        st = lstat(p)
        if stat.S_ISLNK(st.st_mode):
            ds.append(diag('FILE_SYMLINK', r, None))
        elif e == 'intent.json' and stat.S_ISREG(st.st_mode):
            continue
        elif e in LAYERS and stat.S_ISDIR(st.st_mode):
            walk_layer(p, r)
        else:
            # DECIDED: a regular file named as a layer folder is FILE_UNEXPECTED (FORMAT:99-102).
            ds.append(diag('FILE_UNEXPECTED', r + ('/' if stat.S_ISDIR(st.st_mode) else ''), None))
    return sorted(records)


def description_place(path):  # FORMAT:508-515
    sub = path.split('/')[2:]
    if sub[-1] == 'README.md':
        return '/'.join(sub[:-1]) or '.', True
    return '/'.join(sub)[:-len('.md')], False


def read_project(start):
    root = find_root(start)
    if root is None:
        raise SystemExit('no intent/intent.json in %s or above it' % start)
    ds = []
    project, info, pds = read_project_file(read_bytes(os.path.join(root, PROJECT_FILE)),
                                           os.path.basename(root))
    ds.extend(pds)
    for r in project['code']:  # FORMAT:137-138
        if r in info['root_lines'] and lstat(os.path.join(root, r)) is None:
            ds.append(diag('CODE_ROOT_MISSING', PROJECT_FILE, info['root_lines'][r]))
    codes = code_files(root, project['code'])

    # Records, in path order (FORMAT:555-556)
    records, known = [], {}
    for path in walk_intent(root, ds):
        rec, rds = read_record_bytes(read_bytes(os.path.join(root, path)))
        if rec is not None and rec['id'] in known:
            # DECIDED: a duplicate keeps the header's own HEADER_FIELD_UNKNOWN and gets nothing
            # else: "not read further" (FORMAT:555-556) is taken to start after the header.
            ds.extend(diag(c, path, ln, **x) for c, ln, x in rds if c == 'HEADER_FIELD_UNKNOWN')
            ds.append(diag('ID_DUPLICATE', path, 2))
            continue
        ds.extend(diag(c, path, ln, **x) for c, ln, x in rds)
        if rec is None:
            continue
        rec['file'] = path
        known[rec['id']] = rec
        records.append(rec)

    # Placement, FORMAT:498-537
    for rec in records:
        parts = rec['file'].split('/')
        folder = parts[1]
        if rec['layer'] == 'discipline':
            placed = folder == 'discipline' and len(parts) == 4
        else:
            placed = folder == rec['layer']
        if not placed:
            ds.append(diag('RECORD_FOLDER', rec['file'], 2))
        if rec['layer'] == 'discipline' and placed and not discipline_names_pack(rec['id'], parts[2]):
            ds.append(diag('DISCIPLINE_ID_PACK', rec['file'], 2))
        if rec['layer'] == 'description' and folder == 'description':
            # DECIDED: only a Description under intent/description/ has a place (FORMAT:508-509).
            place, is_folder = description_place(rec['file'])
            rec['place'], rec['folder'] = place, is_folder
            full = root if place == '.' else os.path.join(root, place)
            if under_intent(place):
                ds.append(diag('DESCRIPTION_PLACE', rec['file'], 2))
            elif is_folder:
                if is_regular(full):
                    ds.append(diag('DESCRIPTION_PLACE', rec['file'], 2))
                elif not is_dir(full):
                    ds.append(diag('DESCRIPTION_CODE_MISSING', rec['file'], 2))
            else:
                if is_dir(full):
                    ds.append(diag('DESCRIPTION_PLACE', rec['file'], 2))
                elif not is_regular(full):
                    ds.append(diag('DESCRIPTION_CODE_MISSING', rec['file'], 2))

    check_index = {c['id']: c for rec in records for c in rec['checks']}

    # Relation rules 2 to 4, FORMAT:445-460
    for rec in records:
        for rel in rec['relations']:
            rel['linked'] = False
            verb, target = rel['verb'], rel.get('target')
            if verb == 'applies' and rec.get('folder') is True:
                ds.append(diag('APPLIES_FOLDER', rec['file'], rel['line']))
                continue
            if verb == 'bounds the whole product':
                rel['linked'] = True
            elif verb == 'covers':
                if is_regular(os.path.join(root, target)):
                    rel['linked'] = True
                else:
                    ds.append(diag('COVERS_MISSING', rec['file'], rel['line']))
            elif verb == 'applies':
                if target in check_index:
                    rel['linked'] = True
                else:
                    ds.append(diag('APPLIES_CHECK_MISSING', rec['file'], rel['line']))
            else:
                t = known.get(target)
                if t is None:
                    ds.append(diag('RELATION_TARGET_MISSING', rec['file'], rel['line']))
                elif t['layer'] != TARGET_LAYER[verb]:
                    ds.append(diag('RELATION_TARGET_LAYER', rec['file'], rel['line']))
                else:
                    rel['linked'] = True

    # Rules on linked relations, FORMAT:466-481; `applies` in force, FORMAT:635-637
    applies_in_force = []
    place_text = {}

    def text_at(place):
        if place not in place_text:
            full = os.path.join(root, place)
            place_text[place] = decode(read_bytes(full)) if is_regular(full) else False
        return place_text[place]

    for rec in records:
        seen = set()
        for rel in rec['relations']:
            if not rel['linked']:
                continue
            key = (rel['verb'], rel.get('target'), rel.get('test'))
            if key in seen:
                ds.append(diag('RELATION_REPEATED', rec['file'], rel['line']))
            seen.add(key)
            if rel['verb'] == 'applies':
                place = rec.get('place')
                text = text_at(place) if place is not None and rec.get('folder') is False else False
                if text is not False:
                    if text is not None and rel['test'] in text:
                        applies_in_force.append({'check': rel['target'], 'path': place,
                                                 'test': rel['test'], 'by': rec['id']})
                    else:
                        ds.append(diag('APPLIES_TEST_MISSING', rec['file'], rel['line']))
                # DECIDED: a Check that states no valid Applied by is not APPLIES_KIND (FORMAT:477-478).
                if check_index[rel['target']]['appliedBy'] in ('judgment', 'none yet'):
                    ds.append(diag('APPLIES_KIND', rec['file'], rel['line']))
    bounded = {(rec['id'], rel['target']) for rec in records for rel in rec['relations']
               if rel['linked'] and rel['verb'] == 'bounded by'}
    for rec in records:
        for rel in rec['relations']:
            if rel['linked'] and rel['verb'] == 'bounds' and (rel['target'], rec['id']) in bounded:
                ds.append(diag('RELATION_BOTH_SIDES', rec['file'], rel['line']))

    # Edges, FORMAT:614-633 (DECIDED: in record file order, then line order, as the project fixtures list them)
    edges = []
    for rec in records:
        for rel in rec['relations']:
            if not rel['linked'] or rel['verb'] in ('covers', 'bounds the whole product'):
                continue
            if rel['verb'] == 'bounds':
                edges.append({'from': rel['target'], 'to': rec['id'], 'verb': 'bounded by'})
            elif rel['verb'] == 'applies':
                edges.append({'from': rec['id'], 'to': rel['target'].rsplit(':', 1)[0],
                              'verb': 'applies', 'check': rel['target']})
            else:
                edges.append({'from': rec['id'], 'to': rel['target'], 'verb': rel['verb']})

    # Sources, stamps and drift, FORMAT:639-708
    def current(kind, source):
        if kind == 'path':
            full = os.path.join(root, source)
            return short(read_bytes(full)) if is_regular(full) else None
        if kind == 'record':
            r = known.get(source)
            return r['meaningHash'] if r else None
        c = check_index.get(source)
        return c['hash'] if c else None

    for rec in records:
        sources = []
        if rec.get('folder') is False:
            sources.append(('path', rec['place']))
        for rel in rec['relations']:
            if rel['verb'] == 'covers':
                sources.append(('path', rel['target']))
        for rel in rec['relations']:
            if rel['verb'] in ('covers', 'bounds the whole product'):
                continue
            sources.append(('check' if rel['verb'] == 'applies' else 'record', rel['target']))
        once, names = [], set()
        for kind, s in sources:
            if s not in names:
                names.add(s)
                once.append((kind, s))
        rec['sources'] = [s for _, s in once]
        rec['wholeProduct'] = any(r['linked'] and r['verb'] == 'bounds the whole product'
                                  for r in rec['relations'])
        if not rec['hasReadAgainst']:
            rec['drift'] = 'never' if once else 'nothing'
            continue
        stamp = {s['source']: s['hash'] for s in rec['readAgainst']}
        changes = []
        for kind, s in once:
            cur = current(kind, s)
            # DECIDED: one entry per source, the first of the three that applies (FORMAT:697-701).
            if s not in stamp:
                changes.append({'source': s, 'change': 'not in its stamp'})
            elif cur is None:
                changes.append({'source': s, 'change': 'missing' if kind == 'path' else 'no longer exists'})
            elif cur != stamp[s]:
                changes.append({'source': s, 'change': {'path': 'changed', 'record': 'its meaning changed',
                                                        'check': 'the Check changed'}[kind]})
        for st in rec['readAgainst']:
            if st['source'] not in names:
                changes.append({'source': st['source'], 'change': 'stamped but no longer a source'})
        rec['drift'] = 'changed' if changes else 'unchanged'
        rec['changes'] = changes

    # Pack copies, FORMAT:749-766
    disc = os.path.join(root, 'intent', 'discipline')
    for a in info['adoptions']:
        folder = os.path.join(disc, a['name'])
        if not is_dir(folder):
            ds.append(diag('PACK_COPY_MISSING', PROJECT_FILE, a['nameLine']))
        elif fingerprint(folder, release_files(folder)) != a['fingerprint']:
            ds.append(diag('PACK_COPY_CHANGED', 'intent/discipline/' + a['name'] + '/', None))
    if is_dir(disc):
        for e in sorted(os.listdir(disc)):
            if not e.startswith('.') and is_dir(os.path.join(disc, e)) and e not in info['names']:
                ds.append(diag('PACK_NOT_ADOPTED', 'intent/discipline/' + e + '/', None))

    # Code that names an ID, FORMAT:1029-1035
    token = re.compile(r'[a-z0-9_.:-]+')
    for path in codes:
        text = decode(read_bytes(os.path.join(root, path)))
        if text is None:
            continue
        for i, line in enumerate(split_lines(text)):
            named = []
            for m in token.finditer(line):
                t = m.group(0).rstrip('.:-')
                if (t in known or t in check_index) and t not in named:
                    named.append(t)
            ds.extend(diag('CODE_NAMES_ID', path, i + 1) for _ in named)

    out_records = []
    for rec in records:
        o = public_record(rec)
        o['file'] = rec['file']
        if 'place' in rec:
            o['place'], o['folder'] = rec['place'], rec['folder']
        o['wholeProduct'] = rec['wholeProduct']
        o['sources'] = rec['sources']
        o['drift'] = rec['drift']
        if 'changes' in rec:
            o['changes'] = rec['changes']
        out_records.append(o)
    return {
        'root': root,
        'project': project,
        'codeFiles': codes,
        'records': out_records,
        'appliesInForce': applies_in_force,
        'edges': edges,
        'diagnostics': sort_diags(ds),
    }


def cmd_project(start):
    out = read_project(start)
    del out['root']
    return out


# ---------------------------------------------------------------- report forms (FORMAT:768-893)

FORM_MEMBERS = ('form', 'made', 'revision', 'base', 'given', 'uncommitted', 'paths', 'change', 'checks')
FORM_FIELDS = ('Result', 'Applied by', 'Evidence', 'Judged by')
FORM_FIELD_RE = re.compile(r'\*\*(Result|Applied by|Evidence|Judged by)\.\*\*(.*)', re.S)  # FORMAT:850-852
TESTS_SUB, INTENT_SUB = 'Tests that apply Checks', 'Intent that looked missing, wrong or unclear'
def test_and_file(text):  # FORMAT:837-847
    """(test file, test name) written as `<test file> "<test name>"`, or None."""
    q = next((k for k in range(1, len(text)) if text[k] == '"' and text[k - 1] in WS), None)
    if q is None or not text.endswith('"') or len(text) - q < 3:
        return None
    # DECIDED: "the white space in front of that opening quote" is the whole run of it.
    file = rtrim(text[:q])
    return (file, text[q + 1:-1]) if is_project_path(file) else None


def form_header(lines, name):  # FORMAT:824-828
    n = len(lines)
    if n < 1 or lines[0] != '---':
        return None, 1
    if n < 3 or lines[2] != '---':
        return None, 3 if n >= 3 else 2
    try:
        node = parse_json(lines[1])
    except JSONError:
        return None, 2
    if node.kind != 'object':
        return None, 2
    m = {k: v for k, _, v in node.value}
    # DECIDED: members are compared as a set, and "values of those types" (FORMAT:825-826) as JSON
    # types: strings, null where the table allows it, booleans and arrays of strings.
    if set(m) != set(FORM_MEMBERS) or len(node.value) != len(FORM_MEMBERS):
        return None, 2

    def kind(k, *kinds):
        return m[k].kind in kinds
    ok = (kind('form', 'string') and m['form'].value == name and kind('made', 'string')
          and kind('revision', 'string', 'null') and kind('base', 'string', 'null')
          and kind('given', 'bool') and kind('uncommitted', 'bool', 'null')
          and kind('paths', 'array') and all(x.kind == 'string' for x in m['paths'].value)
          and kind('change', 'string')
          and kind('checks', 'array') and all(x.kind == 'string' for x in m['checks'].value))
    if not ok:
        return None, 2
    checks = [x.value for x in m['checks'].value]
    if len(set(checks)) != len(checks):
        return None, 2
    return to_py(node), None


def change_fingerprint(root, header):  # FORMAT:797-801
    lines = [header['base'] if header['base'] is not None else 'given']
    for p in sorted(header['paths']):
        full = os.path.join(root, p)
        lines.append(p + '\t' + (sha256_hex(read_bytes(full)) if is_regular(full) else 'deleted'))
    return 'sha256:' + sha256_hex(utf8('\n'.join(lines)))


def form_value(v):  # FORMAT:862-865
    if v.endswith('.'):
        v = v[:-1]
    return trim(v)


def cmd_form(path, project_dir):
    name = os.path.basename(path)[:-len('.md')] if path.endswith('.md') else os.path.basename(path)
    file = 'intent/.reports/' + name + '.md'
    ds = []

    def report(code, line):
        ds.append(diag(code, file, line))

    text = decode(read_bytes(path))
    if text is None:
        raise SystemExit('the form is not UTF-8, which the contracts give no code for')
    lines = split_lines(strip_bom(text))
    header, bad = form_header(lines, name)
    if header is None:
        report('FORM_HEADER', bad)
        return {'codeMoved': None, 'diagnostics': sort_diags(ds)}
    proj = read_project(project_dir)
    read_checks = {c['id'] for r in proj['records'] for c in r['checks']}

    # Headings, fences and sections, FORMAT:830-835
    fence = None
    section = None
    sections = {}            # name -> heading line (first)
    blocks = []              # {'key', 'line', 'fields': [(name, value, line)]}
    subs = {}                # subsection of Handing on -> {'line', 'items': [(text, line)]}
    sub = None
    block = None
    for k in range(3, len(lines)):
        line, ln = lines[k], k + 1
        in_fence = fence is not None
        if in_fence:
            if fence_closes(line, fence):
                fence = None
            h = None
        else:
            h = parse_heading(line)
        if h is not None:
            level, htext = h
            if level <= 3:
                block = None
            if level == 2:
                section, sub = htext, None
                sections.setdefault(htext, ln)
                continue
            if level == 3 and section == 'Checks':
                block = {'key': htext, 'line': ln, 'fields': []}
                blocks.append(block)
                continue
            if level == 3 and section == 'Handing on':
                sub = htext
                subs.setdefault(htext, {'line': ln, 'items': []})
                continue
            if level <= 3:
                sub = None
                continue
        elif not in_fence:
            fo = fence_open(line)
            if fo is not None:
                # DECIDED: in a form a fence only stops headings (FORMAT:830, 244-245); its lines are still read.
                fence = fo
        if block is not None:
            m = FORM_FIELD_RE.match(line)
            if m:
                block['fields'].append([m.group(1), trim(m.group(2)), ln])
            elif block['fields'] and not blank(line):
                f = block['fields'][-1]
                f[1] = trim(f[1] + ' ' + trim(line)) if f[1] else trim(line)
        elif section == 'Handing on' and sub is not None:
            if line == '-' or line.startswith('- '):  # FORMAT:880-882
                t = trim(line[1:])
                if t:
                    subs[sub]['items'].append((t, ln))

    for s in ('Checks', 'Handing on'):  # FORMAT:830-835, once for each part missing
        if s not in sections:
            report('FORM_SECTION', 2)
    if 'Handing on' in sections:
        for s in (TESTS_SUB, INTENT_SUB):
            if s not in subs:
                report('FORM_SECTION', sections['Handing on'])

    # Blocks, FORMAT:849-878
    listed = header['checks']
    first = {}
    for b in blocks:
        seen = set()
        for fname, _, fl in b['fields']:
            if fname in seen:
                report('FORM_FIELD_REPEATED', fl)
            seen.add(fname)
        if b['key'] in first:
            report('FORM_BLOCK_REPEATED', b['line'])
        elif b['key'] not in listed:
            report('FORM_BLOCK_UNLISTED', b['line'])
            first[b['key']] = b
        else:
            first[b['key']] = b
    if 'Checks' in sections:
        for c in listed:
            if c not in first:
                report('FORM_BLOCK_MISSING', sections['Checks'])
    results = []
    for b in blocks:
        if b['key'] not in listed or first.get(b['key']) is not b:
            continue
        vals = {}
        for fname, v, fl in b['fields']:
            vals.setdefault(fname, (form_value(v), fl))

        def get(f):
            return vals.get(f, ('', b['line']))
        rv, rl = get('Result')
        result = WS_RUN.sub(' ', lower(rv))
        if result not in ('held', 'failed', 'did not decide', 'not applied'):  # reports.md, the four results
            report('FORM_RESULT', rl)
            results.append({'check': b['key'], 'result': None})
            continue
        results.append({'check': b['key'], 'result': result})
        av, al = get('Applied by')
        if result == 'not applied':
            if lower(av) != 'nothing':
                report('FORM_APPLIED_BY', al)
        elif lower(av) != 'judgment' and test_and_file(av) is None:
            report('FORM_APPLIED_BY', al)
        if result in ('held', 'failed', 'did not decide') and lower(av) == 'judgment':
            jv, jl = get('Judged by')
            if jv in ('', '-'):
                report('FORM_JUDGED_BY', jl)
        ev, el = get('Evidence')
        if ev in ('', '-'):
            report('FORM_EVIDENCE', el)

    # Handing on, FORMAT:880-893
    handing = {}
    for sname in (TESTS_SUB, INTENT_SUB):
        if sname not in subs:
            continue
        s = subs[sname]
        handing[sname] = [t for t, _ in s['items']]
        if not s['items']:
            report('FORM_HANDING_ON', s['line'])
        if sname == TESTS_SUB:
            for t, tl in s['items']:
                if lower(t) in ('none', 'none.'):
                    continue
                cid, comma, rest = t.partition(',')  # FORMAT:887-890
                spaced = comma and rest.startswith(' ')
                if not spaced or cid not in read_checks or test_and_file(rest.lstrip(' ')) is None:
                    report('FORM_HANDING_ON', tl)
    return {
        'codeMoved': change_fingerprint(proj['root'], header) != header['change'],
        'results': results,
        'handingOn': handing,
        'diagnostics': sort_diags(ds),
    }


# ---------------------------------------------------------------- making IDs (FORMAT:558-607)

DROPPED = set('a an and are as at be been by for from had has have if in into is it its of on or so '
              'than that the their then there these they this those to was were when where which '
              'while with'.split(' '))


def strip_marks(s):
    return ''.join(c for c in unicodedata.normalize('NFKD', s) if unicodedata.category(c) != 'Mn')


def untaken(name, taken):
    if name not in taken:
        return name
    k = 2
    while '%s-%d' % (name, k) in taken:
        k += 1
    return '%s-%d' % (name, k)


def id_from_title(layer, title, taken):
    s = lower(strip_marks(title).replace("'", '').replace('’', ''))
    words = re.findall(r'[a-z0-9]+', s)
    kept = [w for w in words if w not in DROPPED] or words
    if not kept:
        name = 'untitled'
    else:
        name = '-'.join(kept)
        if len(name) > 32:
            if len(kept[0]) > 32:
                name = kept[0][:32]
            else:
                name = kept[0]
                for w in kept[1:]:
                    if len(name) + 1 + len(w) > 32:
                        break
                    name += '-' + w
    return layer + ':' + untaken(name, set(taken))


def id_from_path(path, taken):
    if path == '.':
        name = 'root'
    else:
        comps = []
        for c in path.split('/'):
            c = re.sub(r'[^a-z0-9_-]', '-', lower(strip_marks(c)))
            c = re.sub(r'-+', '-', c).strip('-')
            comps.append(c or 'x')
        name = '.'.join(comps)
    return 'description:' + untaken(name, set(taken))


def cmd_ids(path):
    with open(path, 'rb') as f:
        cases = json.loads(f.read().decode('utf-8'))
    out = []
    for c in cases:
        c = dict(c)
        if 'path' in c:
            c['id'] = id_from_path(c['path'], c.get('taken', []))
        else:
            c['id'] = id_from_title(c['layer'], c['title'], c.get('taken', []))
        out.append(c)
    return out


# ---------------------------------------------------------------- command line

def main(argv):
    args = list(argv)
    opts = {}
    for flag in ('--label', '--root-name', '--project'):
        if flag in args:
            k = args.index(flag)
            opts[flag] = args[k + 1]
            del args[k:k + 2]
    kinds = ('record', 'project-file', 'pack', 'project', 'form', 'ids')
    if not args:
        raise SystemExit(__doc__)
    if args[0] in kinds:
        kind, path = args[0], args[1]
    else:
        path = args[0]
        if os.path.isdir(path):
            kind = 'project' if is_regular(os.path.join(path, 'intent', 'intent.json')) else 'pack'
        elif path.endswith('.md'):
            kind = 'record'
        else:
            kind = 'project-file'
    if kind == 'record':
        out = cmd_record(path, opts.get('--label', path))
    elif kind == 'project-file':
        out = cmd_project_file(path, opts.get('--root-name'))
    elif kind == 'pack':
        out = cmd_pack(path)
    elif kind == 'project':
        out = cmd_project(path)
    elif kind == 'form':
        if '--project' not in opts:
            raise SystemExit('form needs --project DIR')
        out = cmd_form(path, opts['--project'])
    else:
        out = cmd_ids(path)
    sys.stdout.write(json.dumps(out, indent=2) + '\n')


if __name__ == '__main__':
    main(sys.argv[1:])
