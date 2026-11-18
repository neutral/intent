#!/usr/bin/env python3
"""Run reader.py over every fixture in spec/fixtures/ and compare what it prints
with the fixture's expectation. Python 3 standard library only.

Objects are compared as subsets (every member the expectation gives must be
there and equal; members only the reader prints are ignored) and lists exactly.
Only what the format rules define is compared: the members that come from
the operations alone are left out by name below. Projects are read from a copy
outside any git working tree, as spec/fixtures/README.md says.

    check_fixtures.py [-v]     exit status 1 when any fixture differs
"""

import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
FIXTURES = os.path.join(REPO, 'spec', 'fixtures')
READER = os.path.join(HERE, 'reader.py')

# Members of expectations that the operations define, or that are fixture metadata.
NOT_FORMAT = {
    'project': {'gaps', 'walks'},
    'form': {'checksNow', 'added', 'dropped', 'kept', 'project'},
}
NOT_FORMAT_CODES = {'FORM_CHECKS_CHANGED'}  # FORMAT:1037-1039: reported by Report


def run(args, cwd):
    r = subprocess.run([sys.executable, '-I', READER, *args], cwd=cwd, capture_output=True)
    if r.returncode != 0:
        raise RuntimeError('reader failed on %s: %s' % (' '.join(args), r.stderr.decode(errors='replace')))
    return json.loads(r.stdout.decode('utf-8'))


def compare(want, got, where, out):
    if isinstance(want, dict):
        if not isinstance(got, dict):
            out.append('%s: expected an object, got %r' % (where, got))
            return
        for k, v in want.items():
            if k not in got:
                out.append('%s.%s: missing (expected %s)' % (where, k, json.dumps(v)))
            else:
                compare(v, got[k], where + '.' + k, out)
    elif isinstance(want, list):
        if not isinstance(got, list):
            out.append('%s: expected a list, got %r' % (where, got))
            return
        for i in range(max(len(want), len(got))):
            if i >= len(want):
                out.append('%s[%d]: unexpected %s' % (where, i, json.dumps(got[i])))
            elif i >= len(got):
                out.append('%s[%d]: missing %s' % (where, i, json.dumps(want[i])))
            else:
                compare(want[i], got[i], '%s[%d]' % (where, i), out)
    elif want != got or type(want) is not type(got):
        out.append('%s: expected %s, got %s' % (where, json.dumps(want), json.dumps(got)))


def drop(expected, kind):
    e = {k: v for k, v in expected.items() if k not in NOT_FORMAT.get(kind, ())}
    if 'diagnostics' in e:
        e['diagnostics'] = [d for d in e['diagnostics'] if d['code'] not in NOT_FORMAT_CODES]
    return e


def load(path):
    with open(path, 'rb') as f:
        return json.loads(f.read().decode('utf-8'))


def cases(tmp):
    """Yield (name, kind, expected, actual)."""
    for sub in ('valid', 'invalid'):
        d = os.path.join(FIXTURES, 'records', sub)
        for f in sorted(os.listdir(d)):
            if f.endswith('.md'):
                rel = 'records/%s/%s' % (sub, f)
                yield rel, 'record', load(os.path.join(d, f[:-3] + '.expected.json')), \
                    run(['record', rel], FIXTURES)
    for f in ('titles.json', 'paths.json'):
        rel = 'ids/' + f
        want = load(os.path.join(FIXTURES, rel))
        got = run(['ids', rel], FIXTURES)
        for i, (w, g) in enumerate(zip(want, got)):
            yield '%s[%d]' % (rel, i), 'id', {'id': w['id']}, {'id': g['id']}
    d = os.path.join(FIXTURES, 'project-files')
    for f in sorted(os.listdir(d)):
        if f.endswith('.json') and not f.endswith('.expected.json'):
            rel = 'project-files/' + f
            yield rel, 'project-file', load(os.path.join(d, f[:-5] + '.expected.json')), \
                run(['project-file', rel, '--root-name', 'x-project'], FIXTURES)
    d = os.path.join(FIXTURES, 'pack')
    for f in sorted(os.listdir(d)):
        if os.path.isdir(os.path.join(d, f)):
            rel = 'pack/' + f
            yield rel, 'pack', load(os.path.join(d, f + '.expected.json')), run(['pack', rel], FIXTURES)
    d = os.path.join(FIXTURES, 'project')
    for f in sorted(os.listdir(d)):
        if os.path.isdir(os.path.join(d, f)):
            copy = os.path.join(tmp, 'project', f)
            shutil.copytree(os.path.join(d, f), copy, symlinks=True)
            yield 'project/' + f, 'project', load(os.path.join(d, f + '.expected.json')), \
                run(['project', copy], FIXTURES)
    d = os.path.join(FIXTURES, 'forms')
    for f in sorted(os.listdir(d)):
        if f.endswith('.md'):
            want = load(os.path.join(d, f[:-3] + '.expected.json'))
            copy = os.path.join(tmp, 'form-projects', f[:-3])
            shutil.copytree(os.path.join(FIXTURES, want['project']), copy, symlinks=True)
            yield 'forms/' + f, 'form', want, run(['form', 'forms/' + f, '--project', copy], FIXTURES)


def main():
    verbose = '-v' in sys.argv
    tmp = tempfile.mkdtemp(prefix='intent-independent-')
    try:
        total, failed, by_kind = 0, [], {}
        for name, kind, want, got in cases(tmp):
            diffs = []
            compare(drop(want, kind), got, name, diffs)
            total += 1
            k = by_kind.setdefault(kind, [0, 0])
            k[0] += 1
            if diffs:
                k[1] += 1
                failed.append((name, diffs))
        for name, diffs in failed:
            print('DIFFERS %s' % name)
            for x in diffs if verbose else diffs[:12]:
                print('    ' + x)
            if not verbose and len(diffs) > 12:
                print('    ... %d more' % (len(diffs) - 12))
        for kind, (n, bad) in by_kind.items():
            print('%-13s %3d compared, %3d agree, %3d differ' % (kind, n, n - bad, bad))
        print('%d compared, %d agree, %d differ' % (total, total - len(failed), len(failed)))
        return 1 if failed else 0
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == '__main__':
    sys.exit(main())
