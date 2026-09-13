import test from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const root=fileURLToPath(new URL('../',import.meta.url)),run=promisify(execFile);
async function filesAt(directory,prefix=''){
  const files=[];
  for(const entry of await readdir(join(directory,prefix),{withFileTypes:true})){
    const path=prefix?`${prefix}/${entry.name}`:entry.name;
    if(entry.isDirectory())files.push(...await filesAt(directory,path));else files.push(path);
  }
  return files.sort();
}

test('one package preserves compiled imports, ships every interface and recursively selects replaceable guidance',async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'intent-package-')),source=join(temporary,'source'),destination=join(temporary,'archives');
  try{
    const metadata=JSON.parse(await readFile(join(root,'package.json'),'utf8'));
    for(const path of new Set([...metadata.files,'package.json','distribution/assemble.mjs'])){
      await mkdir(dirname(join(source,path)),{recursive:true});await cp(join(root,path),join(source,path),{recursive:true});
    }
    await writeFile(join(source,'package.json'),JSON.stringify({...metadata,publishConfig:{access:'public'}}));
    await symlink(join(root,'node_modules'),join(source,'node_modules'));
    const originalFamilies=await filesAt(join(source,'spec/families'));
    const familyReadme=await readFile(join(source,'spec/families/README.md'));
    await rm(join(source,'spec/families'),{recursive:true});
    for(const kind of ['behavior','assurance','blueprint','description','check','discipline'])await mkdir(join(source,'spec/families',kind),{recursive:true});
    await writeFile(join(source,'spec/families/README.md'),familyReadme);
    const arbitraryPath='spec/families/blueprint/nested/arbitrary.md';
    const arbitrary='# Arbitrary optional advice\n\nA replaceable family item. Read the [common guide](../../../guidance/blueprint.md).\n';
    await mkdir(dirname(join(source,arbitraryPath)),{recursive:true});await writeFile(join(source,arbitraryPath),arbitrary);
    await run(process.execPath,[join(source,'distribution/assemble.mjs'),destination],{maxBuffer:2_000_000});
    const report=JSON.parse(await readFile(join(destination,'artifacts.json'),'utf8'));
    assert.equal(report.artifacts.length,1);const artifact=report.artifacts[0];assert.equal(artifact.name,'@neutral/intent');assert.equal(artifact.documentation.status,'closed');
    assert.equal(report.version,metadata.version);assert.equal(artifact.version,metadata.version);assert.equal(artifact.filename,`neutral-intent-${metadata.version}.tgz`);
    const packed=join(destination,'package'),manifest=JSON.parse(await readFile(join(packed,'package.json'),'utf8'));
    assert.deepEqual(Object.keys(manifest.bin).sort(),['intent','intent-agent','intent-editor','intent-portal']);
    assert.deepEqual(Object.keys(manifest.exports).sort(),['.','./agent','./cli','./editor','./library','./portal','./processing','./schemas/*']);
    assert.equal(Object.hasOwn(manifest,'private'),false);assert.equal(Object.hasOwn(manifest,'devDependencies'),false);
    assert.deepEqual(manifest.publishConfig,{access:'public'});assert.equal(manifest.version,metadata.version);
    assert.deepEqual(manifest.repository,{type:'git',url:'git+https://github.com/neutral/intent.git'});
    assert.equal((await readFile(join(packed,'VERSION'),'utf8')).trim(),metadata.version);
    assert.ok(!Object.keys(manifest.dependencies).some(name=>name.startsWith('@neutral/intent')));
    for(const path of artifact.files.filter(path=>path.startsWith('dist/')))assert.deepEqual(await readFile(join(packed,path)),await readFile(join(root,path)),`Compiled bytes changed: ${path}`);
    assert.equal(await readFile(join(packed,arbitraryPath),'utf8'),arbitrary);
    for(const path of originalFamilies.filter(path=>path!=='README.md'))assert.ok(!artifact.files.includes(`spec/families/${path}`));
    const {stdout}=await run('tar',['-xOf',join(destination,artifact.filename),`package/${arbitraryPath}`]);assert.equal(stdout,arbitrary);
    assert.ok(artifact.files.every(path=>!path.startsWith('atlas/')&&!path.startsWith('tests/')&&!path.startsWith('workflows/')));
    assert.ok(artifact.files.every(path=>!/^dist\/library\/cache\./.test(path)), 'Removed cache modules, declarations and maps must not ship');
    for(const path of Object.values(manifest.bin))assert.ok(artifact.files.includes(path.replace(/^\.\//,'')));
    await assert.rejects(run(process.execPath,[join(source,'distribution/assemble.mjs'),destination]),/Refusing to replace/);
  }finally{await rm(temporary,{recursive:true,force:true});}
});


test('the build workflow discards stale generated modules before compiling the selected source',async()=>{
  const temporary=await mkdtemp(join(tmpdir(),'intent-clean-build-'));
  try{
    await mkdir(join(temporary,'distribution'),{recursive:true});
    await mkdir(join(temporary,'library'),{recursive:true});
    await mkdir(join(temporary,'dist/library'),{recursive:true});
    await cp(join(root,'distribution/build.mjs'),join(temporary,'distribution/build.mjs'));
    await symlink(join(root,'node_modules'),join(temporary,'node_modules'));
    await writeFile(join(temporary,'package.json'),JSON.stringify({type:'module'}));
    await writeFile(join(temporary,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ES2022',module:'NodeNext',moduleResolution:'NodeNext',outDir:'dist',rootDir:'.',declaration:true,sourceMap:true,declarationMap:true,types:[]},include:['library/**/*.ts']}));
    await writeFile(join(temporary,'library/current.ts'),'export const current = true;\n');
    for(const suffix of ['js','js.map','d.ts','d.ts.map'])await writeFile(join(temporary,`dist/library/cache.${suffix}`),'stale removed output\n');
    await run(process.execPath,[join(temporary,'distribution/build.mjs')],{maxBuffer:2_000_000});
    const outputs=await filesAt(join(temporary,'dist'));
    assert.ok(outputs.every(path=>!path.startsWith('library/cache.')));
    assert.deepEqual(outputs,['library/current.d.ts','library/current.d.ts.map','library/current.js','library/current.js.map']);
    assert.match(await readFile(join(temporary,'dist/library/current.js'),'utf8'),/export const current = true/);
  }finally{await rm(temporary,{recursive:true,force:true});}
});
