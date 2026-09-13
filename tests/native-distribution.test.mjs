import test from 'node:test';
import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { archiveBundle } from '../distribution/archive.mjs';

test('native archive is reproducible and preserves executable paths with spaces',async()=>{
  const root=await mkdtemp(join(tmpdir(),'intent-archive-test-'));
  try {
    const folder=join(root,'Intent bundle');await mkdir(join(folder,'bin'),{recursive:true});
    await writeFile(join(folder,'bin/intent'),'#!/bin/sh\nexit 0\n');await chmod(join(folder,'bin/intent'),0o755);
    await writeFile(join(folder,'Project name.md'),'Example\n');
    await archiveBundle(folder,join(root,'first.tar.gz'));await archiveBundle(folder,join(root,'second.tar.gz'));
    assert.deepEqual(await readFile(join(root,'first.tar.gz')),await readFile(join(root,'second.tar.gz')));
    const unpacked=join(root,'unpacked');await mkdir(unpacked);
    execFileSync('tar',['-xzf',join(root,'first.tar.gz'),'-C',unpacked]);
    assert.equal(await readFile(join(unpacked,'Intent bundle/Project name.md'),'utf8'),'Example\n');
    execFileSync(join(unpacked,'Intent bundle/bin/intent'),[],{env:{PATH:''}});
    await symlink('/outside',join(folder,'external'));
    await assert.rejects(archiveBundle(folder,join(root,'invalid.tar.gz')),/Unsupported bundle file/);
  } finally {await rm(root,{recursive:true,force:true});}
});
