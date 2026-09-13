#!/usr/bin/env node
// Fresh-agent/automated installation qualification. Uses only shipped public APIs,
// schemas, declarations, executables, and self-authored disposable consumer data.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const option = (name, fallback) => args.find(value => value.startsWith(`${name}=`))?.slice(name.length + 1) ?? fallback;
const extended = args.includes('--extended');
const archiveDirectory = path.resolve(option('--artifacts', '/tmp/intent-release-initial'));
const archiveInventory=JSON.parse(await fs.readFile(path.join(archiveDirectory,'artifacts.json'),'utf8'));
assert.equal(archiveInventory.schema,'intent.release-artifacts.v1');
assert.equal(archiveInventory.artifacts.length,1,'Qualification requires one Intent package archive');
assert.equal(archiveInventory.artifacts[0].name,'@neutral/intent');
const archiveNames=archiveInventory.artifacts.map(item=>{assert.equal(path.basename(item.filename),item.filename);return item.filename;});
const targets = [
  'Clean installation of the exact package archive; internal examples, fixtures and workflows are absent, and installed paths stay inside the consumer.',
  'npm-created local commands, npx package selection, and an isolated global install run the released version without installation scripts; global removal removes its commands.',
  'Installed package, archive and VERSION identities agree; every declared command/export, browser asset, guide and license is present.',
  'Public Library, interface and processing imports, all exported schemas, and strict TypeScript consumer compile.',
  'CLI inspect/query/select and explicit reconciliation return the same public wire values as Library; installed CLI and MCP discover and read complete shared and available Blueprint family guidance.',
  'Installed readCheck and read-check expose the same complete authored Check and support; readable CLI text and exact shipped review-guide bytes are available.',
  'The installation has one complete shared specification; removing or replacing optional family guidance leaves Library, CLI and fresh-process MCP reading, source identity, tool catalog and common Check review unchanged.',
  'Actual installed Editor child serves its HTML and referenced assets over loopback HTTP.',
  'Portal API and CLI produce identical selected files, usable under an ordinary static HTTP prefix.',
  'Every Portal output excludes sentinels in an unselected record, code, output, and private notes.',
  'Actual MCP stdio initialize/tools/list/inspect/read returns catalog, source identity, and exact retained bytes.',
  'Installed MCP current edits preserve stable identity, update selected globals, expose exact before/after review and remove completed recovery state.',
  'Installed MCP staged edits read and replace an exact 1 MiB catalog through a small request, retain reviewable bytes, clean completed recovery state, and refuse a stale proposal without a journal.',
  'Linux repeats these oracles with only staged archives and this harness mounted, without a development checkout.',
];

const extendedTargets = [
  'CLI initialization, explicit draft creation, coherent editing and lifecycle changes work through reviewed proposals.',
  'An explicitly copied synthetic local Pack can be adopted and removed with current selected pins and correspondence.',
];

async function command(executable, argv, options = {}) {
  const started = Date.now();
  const child = spawn(executable, argv, { cwd: options.cwd, env: { ...process.env, ...options.env }, stdio: ['ignore', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.on('data', value => stdout += value);
  child.stderr.on('data', value => stderr += value);
  const timer = setTimeout(() => child.kill('SIGKILL'), options.timeout ?? 180_000);
  const [code, signal] = await once(child, 'exit');
  clearTimeout(timer);
  const result = { command: [executable, ...argv], cwd: options.cwd, code, signal, stdout, stderr, elapsedMs: Date.now() - started };
  if (code !== 0 && !options.allowFailure) throw Object.assign(new Error(`Command failed: ${executable} ${argv.join(' ')}\n${stderr}\n${stdout}`), { result });
  return result;
}

async function put(root, name, bytes) {
  const destination = path.join(root, name);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, bytes);
}

async function pathsIn(root, relative = '') {
  const names = [];
  for (const item of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, item.name);
    if (item.isDirectory()) names.push(...await pathsIn(root, name));
    else names.push(name);
  }
  return names.sort();
}

async function withMcp(executable, selectedRoot, action) {
  const child = spawn(process.execPath, [executable, '--root', selectedRoot], { cwd: selectedRoot, stdio: ['pipe', 'pipe', 'pipe'] });
  let stderr = '', id = 0;
  const pending = new Map();
  child.stderr.on('data', value => stderr += value);
  const lines = createInterface({ input: child.stdout });
  lines.on('line', line => {
    try { const message = JSON.parse(line); const request = pending.get(message.id); if (request) { pending.delete(message.id); clearTimeout(request.timer); request.resolve(message); } }
    catch (error) { for (const item of pending.values()) item.reject(error); }
  });
  const request = (method, params = {}) => new Promise((resolve, reject) => {
    const nextId = ++id;
    const timer = setTimeout(() => { pending.delete(nextId); reject(new Error(`MCP timeout: ${method}; ${stderr}`)); }, 20_000);
    pending.set(nextId, { resolve, reject, timer });
    child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', id: nextId, method, params })}\n`);
  });
  const tool = async (name, input) => {
    const answer = await request('tools/call', { name, arguments: input });
    assert.equal(answer.error, undefined, JSON.stringify(answer)); assert.equal(answer.result.isError, false, JSON.stringify(answer));
    return JSON.parse(answer.result.content[0].text);
  };
  const notify = method => child.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method })}\n`);
  try { return await action({ request, tool, notify, stderr: () => stderr }); }
  finally { for (const item of pending.values()) clearTimeout(item.timer); child.stdin.end(); child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit'); lines.close(); }
}

function record({ id, title, codePath, detail, relationships = [] }) {
  const header = {
    schema: 'intent.knowledge-record.v2', kind: 'description', id,
    status: 'current',
  };
  const coordinate = id;
  const context = {catalog:{schema:'intent.catalog.v1',sources:[],records:[{record:coordinate,owners:['consumer-owner'],tags:[]}]},connections:{schema:'intent.connections.v1',relationships:relationships.map((edge,index)=>({id:`relation-${index+1}`,record:coordinate,...edge})),conflicts:[],sourceUses:[],coverage:[{id:'implementation-unit',record:coordinate,path:codePath,mode:'file',role:'primary'}],checkSelections:[]}};
  const sourceText = `---\n${JSON.stringify(header, null, 2)}\n---\n# ${title}\n\nAn independently authored consumer implementation unit.\n\n## Responsibility\n\n${detail}\n\n## Behavior\n\n### entry:calculation\n\nApply the declared calculation.\n\n## Boundaries\n\n### entry:subtotal\n\nAccepts a numeric subtotal.\n\n## Invariants\n\n### entry:input\n\nDoes not mutate input.\n\n## Dependencies\n\n## Failure Behavior\n\n### entry:unsupported\n\nNonnumeric input is unsupported.\n\n## Rationale\n\n### entry:local-policy\n\nKeep the policy in one function.\n`;
  return {sourceText,context};
}


// Additional authoring fixtures exercise only installed public exports and
// documented CLI JSON carriers.
async function extendedChecks({ root, library, check, run }) {
  const target = path.join(root, 'authoring-consumer');
  const cliPath = path.join(root, 'node_modules/@neutral/intent/apps/cli/intent.mjs');
  const cli = async (...argv) => JSON.parse((await run(process.execPath, [cliPath, ...argv, '--json'])).stdout);
  const options = { resolveSources: true };
  const inspect = async () => library.readWorkspace(await library.FileSystemSource.open(target), options);
  let requestNumber = 0;
  const jsonFile = async (label, value) => {
    const name = `requests/${++requestNumber}-${label}.json`; await put(root, name, JSON.stringify(value, null, 2)); return path.join(root, name);
  };
  const apply = async proposal => {
    assert.equal(proposal?.schema, 'intent.file-proposal.v1', 'CLI must expose a reviewed FileProposal');
    const result = await cli('apply', target, await jsonFile('reviewed-proposal', proposal), '--resolve-sources');
    assert.equal(result.status, 'completed', JSON.stringify(result));
    assert.equal(result.journal, null);
    for (const change of proposal.changes) assert.equal(await fs.readFile(path.join(target, change.path), 'utf8').catch(error => { if(error.code === 'ENOENT') return null; throw error; }), change.after, 'Applied bytes match reviewed proposal');
    return result;
  };
  await check('extended-cli-initialize-create-edit-status', async () => {
    assert.ok(library, 'Installed Library must be available');
    await put(target, 'src/widget.mjs', 'export const label = "Ready";\n');
    const init = await cli('init-propose', target, await jsonFile('initialize', { name: 'Installed authoring consumer', owners: ['consumer-owner'], implementationRoots: ['src'] }), '--resolve-sources');
    assert.equal(init.complete, true, JSON.stringify(init.diagnostics));
    assert.equal(await fs.stat(path.join(target, 'intent/project.json')).then(() => true, () => false), false);
    const initialized = await apply(init.fileProposal);
    const draftPath = 'intent/description/src/_widget.desc.md';
    const creation = await cli('create-propose', target, await jsonFile('create', { kind: 'description', path: draftPath, id: 'description.widget', title: 'Widget label', coverage: [{ path: 'src/widget.mjs', mode: 'file', role: 'primary' }] }), '--resolve-sources');
    assert.equal(creation.complete, true, JSON.stringify(creation.diagnostics));
    await apply(creation.fileProposal);
    const draft = (await inspect()).records.find(record => record.header.id === 'description.widget');
    assert.equal(draft.header.status, 'draft'); assert.match(draft.sourceText, /PROPOSED PLACEHOLDER/);
    const completeSource = record({ id: 'description.widget', title: 'Widget label', codePath: 'src/widget.mjs', detail: 'The widget module exports the constant label Ready and performs no I/O.' });
    completeSource.sourceText = completeSource.sourceText.replace('"status": "current"', '"status": "draft"');
    const edit = await cli('change-propose', target, await jsonFile('edit', { path: draftPath, operation: { kind: 'edit', sourceText: completeSource.sourceText, context: completeSource.context } }), '--resolve-sources');
    assert.equal(edit.complete, true, JSON.stringify(edit.diagnostics));
    assert.equal(await fs.readFile(path.join(target,draftPath),'utf8'), draft.sourceText);
    await apply(edit.fileProposal);
    const promotion = await cli('change-propose', target, await jsonFile('status', { path: draftPath, operation: { kind: 'set-status', status: 'current' } }), '--resolve-sources');
    assert.equal(promotion.complete,true,JSON.stringify(promotion.diagnostics));
    await apply(promotion.fileProposal);
    const workspace = await inspect(), current = workspace.records.find(record => record.header.id === 'description.widget');
    assert.equal(workspace.valid, true, JSON.stringify(workspace.diagnostics));
    assert.equal(current.header.status, 'current'); assert.equal(Object.hasOwn(current.header,'revision'), false);
    assert.equal(Object.hasOwn(workspace,'history'), false);
    assert.equal((await pathsIn(path.join(target,'intent'))).some(name=>name.startsWith('history/')),false);
    return { root: target, initializedOperation: initialized.id, current: { id: current.header.id, path: current.path }, complete: workspace.complete, valid: workspace.valid };
  });
  await check('extended-local-pack-copy-adoption-removal', async () => {
    const publisher = path.join(root, 'fixture-publisher'), copied = path.join(root, 'selected-local-pack');
    const template = library.createRecordTemplate('discipline', { id: 'discipline.fixture-output-review', title: 'Read selected fixture output', owners: ['fixture-publisher'], publisher: 'fixture-publisher' });
    const parsed = library.inspectRecord(template.sourceText, { location: 'unplaced', context:template.context }); assert.equal(parsed.valid, true);
    const header = JSON.parse(JSON.stringify(parsed.record.authoredHeader));
    const text = `---\n${JSON.stringify(header, null, 2)}\n---\n# Read selected fixture output\n\nOptional fixture advice to compare selected output with the expected byte rule.\n\n## Practice\n\nRead selected output before recording a result.\n\n## Applicability\n\n### entry:local-fixture\n\nA small local fixture has an explicit expected result.\n\n## Exclusions\n\n### entry:unknown-rule\n\nThe expected result is unknown.\n\n## Guidance\n\n### entry:compare\n\nCompare selected output with the declared rule and record only what was observed.\n\n## Verification Guidance\n\n### entry:observation\n\nName the selected input, expected rule, and actual outcome.\n`;
    await put(publisher, 'records/output-review.md', text);
    for(const [name,value]of Object.entries(template.context))await put(publisher, `${name}.json`, JSON.stringify(value,null,2));
    await put(publisher, 'pack.json', JSON.stringify({ schema: 'intent.discipline-pack.v2', id: 'pack.installed-fixture', title: 'Installed fixture advice', version: '1.0.0', publisher: 'fixture-publisher', recordSchema: 'urn:intent:schema:knowledge-record:v2', sets: [{ id: 'set.read-output', title: 'Read output', description: 'Optional local output comparison.', recordIds: [header.id] }] }, null, 2));
    const built = await library.buildDisciplinePack(await library.FileSystemSource.open(publisher));
    assert.equal(built.valid, true, JSON.stringify(built.diagnostics)); assert.equal(built.complete, true);
    await put(publisher, 'pack.manifest.json', JSON.stringify(built.candidateManifest, null, 2));
    await fs.cp(publisher, copied, { recursive: true, errorOnExist: true, force: false });
    const packSource = await library.FileSystemSource.open(copied), validated = await library.validateDisciplinePack(packSource); assert.equal(validated.valid, true);
    const targetPath = 'intent/disciplines/output-review.md';
    const adoption = await library.proposeRepositoryAdoption(await library.FileSystemSource.open(target), packSource, { source: 'local:installed-consumer-fixture', revision: 'fixture-v1', choices: [{ id: header.id, packId: 'pack.installed-fixture', packVersion: '1.0.0', path: targetPath }] });
    assert.equal(adoption.adoption.valid, true, JSON.stringify(adoption.adoption.diagnostics)); assert.equal(adoption.proposed.valid, true, JSON.stringify(adoption.proposed.diagnostics));
    assert.equal(await fs.stat(path.join(target, targetPath)).then(() => true, () => false), false);
    const applied = await apply(adoption.fileProposal);
    assert.equal(await fs.readFile(path.join(target, targetPath), 'utf8'), text);
    const adopted = await inspect(); assert.equal(adopted.complete, true); assert.equal(adopted.valid, true, JSON.stringify(adopted.diagnostics));
    assert.equal(adopted.disciplines.correspondence.find(item => item.id === header.id).state, 'matched');
    assert.equal((await pathsIn(path.join(target,'intent'))).some(name=>name.startsWith('history/')),false);
    const removal = await cli('remove-adoption-propose', target, await jsonFile('remove-adoption', { ids: [header.id] }));
    const removed = await apply(removal.fileProposal);
    assert.equal(await fs.stat(path.join(target, targetPath)).then(() => true, () => false), false);
    const final = await inspect(); assert.equal(final.complete, true); assert.equal(final.valid, true, JSON.stringify(final.diagnostics));
    assert.equal(final.records.some(record => record.header.id === header.id), false); assert.equal(final.disciplines.registry.adoptions.length, 0);
    return { fixtureOnly: true, selectedLocalCopy: copied, packId: built.definition.id, selectedId: header.id, adoptionOperation: applied.id, removalOperation: removed.id, currentPackSelections: final.disciplines.registry.packs.length, finalComplete: final.complete, finalValid: final.valid, noSiblingCatalogInput: true };
  });
}

async function worker() {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'intent-installed-consumer-')));
  const resultPath = path.resolve(option('--result', path.join(root, 'qualification-result.json')));
  const result = { kind: extended ? 'automated installed-candidate qualification' : 'fresh-agent/automated installation qualification', humanParticipants: 0,
    ...(extended ? { independence: 'The extended harness was authored with prior development context; this is not a new blind fresh-agent or human study.' } : {}),
    declaredTargets: [...targets, ...(extended ? extendedTargets : [])], extended, startedAt: new Date().toISOString(), root,
    environment: { node: process.version, platform: process.platform, arch: process.arch, release: os.release() },
    artifacts: [], checks: [], commands: [] };
  const run = async (executable, argv, extra = {}) => {
    try { const value = await command(executable, argv, { cwd: root, ...extra }); result.commands.push(value); return value; }
    catch (error) { if (error.result) result.commands.push(error.result); throw error; }
  };
  const check = async (name, action) => {
    const started = Date.now();
    try { const details = await action(); result.checks.push({ name, status: 'pass', elapsedMs: Date.now() - started, details }); console.log(`PASS ${name}`); }
    catch (error) { result.checks.push({ name, status: 'fail', elapsedMs: Date.now() - started, error: error.stack }); console.error(`FAIL ${name}: ${error.message}`); }
  };
  console.log(`Declared targets before running:\n${result.declaredTargets.map(value => `- ${value}`).join('\n')}`);
  for (const name of archiveNames) {
    const bytes = await fs.readFile(path.join(archiveDirectory, name));
    const sha256=createHash('sha256').update(bytes).digest('hex');assert.equal(sha256,archiveInventory.artifacts.find(item=>item.filename===name).sha256,'Archive bytes must match the selected assembly inventory');
    result.artifacts.push({ name, bytes: bytes.length, sha256 });
  }
  await put(root, 'package.json', JSON.stringify({ name: 'intent-installed-shipping-consumer', version: '1.0.0', private: true, type: 'module' }, null, 2));
  let requireFromConsumer, packageUrls, library, source, workspace, portalBuild;
  const publicPath = 'intent/description/src/_shipping.desc.md';
  const privatePath = 'intent/description/src/_internal-costs.desc.md';
  const privateSentinels = ['PRIVATE_RECORD_81c472', 'PRIVATE_CODE_57a092', 'PRIVATE_OUTPUT_f26d18', 'PRIVATE_HISTORY_398cb4'];
  const selection = { recordIds: ['description.shipping'] };
  await check('clean-install', async () => {
    const archiveContents = {};
    for (const name of archiveNames) {
      const listing = await run('tar', ['-tzf', path.join(archiveDirectory, name)]);
      const paths = listing.stdout.split(/\r?\n/).filter(Boolean).map(name => name.replace(/^package\//, ''));
      assert.ok(paths.includes('package.json'), `${name}: archive package metadata is required`);
      const internal = paths.filter(name => /^(?:atlas|examples|tests|qualification|implementations|scripts|workflows)\//.test(name)
        || /^spec\/(?:examples|tools)\//.test(name)
        || /(?:^|\/)bounded-integer(?:\/|$)/.test(name)
        || /(?:^|\/)(?:verify-installed|editor-fixture)\.mjs$/.test(name));
      assert.deepEqual(internal, [], `${name}: internal examples, fixtures and workflows must not ship`);
      archiveContents[name] = { files: paths.length, internalExamplesAndFixtures: 0, internalWorkflows: 0 };
    }
    await run('npm', ['install', '--ignore-scripts', '--cache', '/tmp/intent-npm-cache', ...archiveNames.map(name => path.join(archiveDirectory, name))]);
    await run('npm', ['install', '--cache', '/tmp/intent-npm-cache', '--save-dev', 'typescript@5.9.3', '@types/node@24.13.3']);
    await run('npm', ['ls', '--all', '--json']);
    requireFromConsumer = createRequire(path.join(root, 'package.json'));
    await put(root, 'resolve-public.mjs', `console.log(JSON.stringify(Object.fromEntries(['library','cli','agent','editor','portal'].map(name=>[name,import.meta.resolve('@neutral/intent/'+name)]))));\n`);
    packageUrls = JSON.parse((await run(process.execPath, ['resolve-public.mjs'])).stdout);
    const resolutions = {};
    for (const name of ['library', 'cli', 'agent', 'editor', 'portal']) {
      const target = fileURLToPath(packageUrls[name]);
      const real = await fs.realpath(target);
      assert.ok(real.startsWith(`${root}/node_modules/`), `Dependency escapes ordinary consumer: ${real}`);
      resolutions[name] = real;
    }
    const installedMetadata=JSON.parse(await fs.readFile(path.join(root,'node_modules/@neutral/intent/package.json'),'utf8'));
    assert.equal(installedMetadata.name,'@neutral/intent');
    assert.deepEqual(Object.keys(installedMetadata.bin).sort(),['intent','intent-agent','intent-editor','intent-portal']);
    assert.ok(!Object.keys(installedMetadata.dependencies).some(name=>name.startsWith('@neutral/intent')));
    assert.equal(Object.hasOwn(installedMetadata.exports,'./cache'),false);
    assert.equal(installedMetadata.version,archiveInventory.version);
    assert.equal(installedMetadata.version,archiveInventory.artifacts[0].version);
    assert.deepEqual(installedMetadata.publishConfig,{access:'public'});
    return { resolutions, archiveContents, packageName:installedMetadata.name, binaries:Object.keys(installedMetadata.bin) };
  });
  await check('npm-command-installation', async () => {
    const packageRoot=path.join(root,'node_modules/@neutral/intent');
    const metadata=JSON.parse(await fs.readFile(path.join(packageRoot,'package.json'),'utf8'));
    assert.equal((await fs.readFile(path.join(packageRoot,'VERSION'),'utf8')).trim(),metadata.version);
    for(const [name,target] of Object.entries(metadata.bin)) {
      const installed=path.join(root,'node_modules/.bin',name);
      assert.equal(await fs.realpath(installed),await fs.realpath(path.join(packageRoot,target)),`npm command target: ${name}`);
      if(name!=='intent-agent')assert.match((await run(installed,['--help'])).stdout,/intent open/);
    }
    const localVersion=(await run(path.join(root,'node_modules/.bin/intent'),['--version'])).stdout.trim();
    const npxVersion=(await run('npx',['--offline','@neutral/intent','--version'])).stdout.trim();
    assert.equal(localVersion,metadata.version);assert.equal(npxVersion,metadata.version);
    const globalPrefix=path.join(root,'isolated-global-install');
    await run('npm',['install','--global','--prefix',globalPrefix,'--ignore-scripts','--cache','/tmp/intent-npm-cache',...archiveNames.map(name=>path.join(archiveDirectory,name))]);
    const globalCommand=path.join(globalPrefix,'bin/intent');
    assert.equal((await run(globalCommand,['--version'])).stdout.trim(),metadata.version);
    assert.match((await run(globalCommand,['--help'])).stdout,/intent open/);
    await run('npm',['uninstall','--global','--prefix',globalPrefix,'--ignore-scripts','--cache','/tmp/intent-npm-cache','@neutral/intent']);
    for(const name of Object.keys(metadata.bin))assert.equal(await fs.lstat(path.join(globalPrefix,'bin',name)).then(()=>true,error=>{if(error.code==='ENOENT')return false;throw error;}),false,`npm removed ${name}`);
    return {version:metadata.version,localCommand:true,npxPackageSelection:true,globalPrefix,globalInstallAndRemoval:true,installationScripts:false};
  });
  await check('packaged-runtime-files-and-guides', async () => {
    const packageRoot=path.join(root,'node_modules/@neutral/intent');
    const metadata=JSON.parse(await fs.readFile(path.join(packageRoot,'package.json'),'utf8'));
    const exportFiles=value=>typeof value==='string'?[value]:Object.values(value).flatMap(exportFiles);
    const declared=Object.values(metadata.exports).flatMap(exportFiles).filter(name=>!name.includes('*'));
    const required=[...Object.values(metadata.bin),...declared,'README.md','CHANGELOG.md','CONTRIBUTING.md','SECURITY.md','THIRD_PARTY.md','LICENSE','LICENSE.CC0-1.0','LICENSE.0BSD','VERSION','library/README.md','apps/agent/tools.json','docs/install.md','docs/integration.md','distribution/README.md'];
    for(const name of required)assert.ok((await fs.stat(path.join(packageRoot,name))).isFile(),`Required package file: ${name}`);
    for(const folder of ['apps/editor/assets','apps/portal/assets']) {
      const files=await pathsIn(path.join(packageRoot,folder));
      assert.ok(files.some(name=>name.endsWith('.js')),`${folder}: browser JavaScript`);
      assert.ok(files.some(name=>name.endsWith('.css')),`${folder}: browser styles`);
    }
    const {Parser}=requireFromConsumer('commonmark');
    const markdown=(await pathsIn(packageRoot)).filter(name=>name.endsWith('.md'));
    let relativeFileLinks=0;
    for(const name of markdown) {
      const document=path.join(packageRoot,name),walker=new Parser().parse(await fs.readFile(document,'utf8')).walker();let event;
      while((event=walker.next()))if(event.entering&&['link','image'].includes(event.node.type)) {
        const target=event.node.destination??'';
        if(/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target))continue;
        const destination=path.resolve(path.dirname(document),decodeURIComponent(target.split(/[?#]/)[0]||'.')),local=path.relative(packageRoot,destination);
        assert.ok(!path.isAbsolute(local)&&local!=='..'&&!local.startsWith('../'),`Documentation link leaves installed package: ${name} -> ${target}`);
        await fs.stat(destination);relativeFileLinks++;
      }
    }
    return {requiredFiles:required.length,markdownFiles:markdown.length,relativeFileLinks,scope:'Package-owned Markdown file links; remote URLs and heading fragments are not checked'};
  });
  await check('public-imports-schemas-types', async () => {
    // import.meta.resolve supports the import condition from a consumer-local module.
    await put(root, 'public-imports.mjs', `import * as root from '@neutral/intent';\nimport * as library from '@neutral/intent/library';\nimport * as processing from '@neutral/intent/processing';\nimport {main} from '@neutral/intent/cli';\nimport {runAgent} from '@neutral/intent/agent';\nimport {startEditor} from '@neutral/intent/editor';\nimport {buildPortal} from '@neutral/intent/portal';\nconsole.log(JSON.stringify({sameRootApi:root.readWorkspace===library.readWorkspace,interfaces:[main,runAgent,startEditor,buildPortal].every(value=>typeof value==='function'),library:Object.keys(library).length,processing:Object.keys(processing),root:import.meta.resolve('@neutral/intent/library')}));\n`);
    const imported = JSON.parse((await run(process.execPath, ['public-imports.mjs'])).stdout);
    assert.equal(imported.sameRootApi,true);assert.equal(imported.interfaces,true);
    library = await import(pathToFileURL(imported.root.startsWith('file:') ? fileURLToPath(imported.root) : imported.root).href);
    const schemaFolder = path.join(root, 'node_modules/@neutral/intent/spec/schemas');
    const schemaNames = (await fs.readdir(schemaFolder)).filter(name => name.endsWith('.json'));
    for (const name of schemaNames) {
      const resolved = requireFromConsumer.resolve(`@neutral/intent/schemas/${name}`);
      JSON.parse(await fs.readFile(resolved, 'utf8'));
    }
    await put(root, 'consumer-types.mts', `import {FileSystemSource,readWorkspace,readCheck,queryKnowledge,selectKnowledge,validateSchema,type SourceReader,type WorkspaceInspection,type CheckReading} from '@neutral/intent/library';\nimport {canonicalJson} from '@neutral/intent/processing';\nimport {startEditor} from '@neutral/intent/editor';\nimport {buildPortal,type PortalSelection} from '@neutral/intent/portal';\nimport {main} from '@neutral/intent/cli';\nimport {runAgent} from '@neutral/intent/agent';\nimport {readWorkspace as rootReadWorkspace} from '@neutral/intent';\nconst source: SourceReader = await FileSystemSource.open('.');\nconst workspace: WorkspaceInspection = await readWorkspace(source);\nconst selection: PortalSelection = {recordIds:[]};\nconst check: CheckReading = readCheck(workspace,'check.committed',{maxBytes:524288});\nqueryKnowledge(workspace,{text:'shipping'});selectKnowledge(workspace,[]);await buildPortal(workspace,source,selection);\nvalidateSchema('project',workspace.config);canonicalJson({ok:true});\nvoid check;void startEditor;void main;void runAgent;void rootReadWorkspace;\n`);
    await run(process.execPath, ['node_modules/typescript/bin/tsc', '--noEmit', '--strict', '--target', 'ES2022', '--module', 'NodeNext', '--moduleResolution', 'NodeNext', 'consumer-types.mts']);
    return { imports: imported, schemas: schemaNames, typeScript: '5.9.3', nodeTypes: '24.13.3', skipLibCheck: false };
  });
  await check('ordinary-current-source', async () => {
    assert.ok(library, 'Public Library import must succeed');
    await put(root, 'src/shipping.mjs', 'export const shippingFee = subtotal => subtotal >= 50 ? 0 : 5;\n');
    await put(root, 'src/internal-costs.mjs', `// ${privateSentinels[1]}\nexport const internalCost = subtotal => subtotal * 0.03;\n`);
    await put(root, 'intent/project.json', JSON.stringify({ schema: 'intent.project.v1', name: 'Installed shipping consumer', owners: ['consumer-owner'], implementationRoots: ['src'], exemptions: [] }, null, 2));
    const publicRecord=record({ id: 'description.shipping', title: 'Shipping fee', codePath: 'src/shipping.mjs', detail: 'Orders of 50 or more ship free; smaller orders cost 5.', relationships: [{ type: 'related-to', target: 'description.internal-costs', required: false }] });
    const privateRecord=record({ id: 'description.internal-costs', title: 'Internal costs', codePath: 'src/internal-costs.mjs', detail: `Internal cost policy. ${privateSentinels[0]}` });
    await put(root, publicPath, publicRecord.sourceText);await put(root, privatePath, privateRecord.sourceText);
    const context=structuredClone(publicRecord.context);context.catalog.records.push(...privateRecord.context.catalog.records);
    for(const key of ['relationships','conflicts','sourceUses','coverage','checkSelections'])context.connections[key].push(...privateRecord.context.connections[key]);
    for(const [name,value]of Object.entries(context))await put(root, `intent/${name}.json`, JSON.stringify(value,null,2));
    await put(root, 'reports/private-output.txt', `${privateSentinels[2]}\nControlled private output fixture, not an executed Check result.\n`);
    source = await library.FileSystemSource.open(root);
    const initial = await library.readWorkspace(source);
    assert.equal(initial.records.length, 2);
    assert.deepEqual(initial.diagnostics.filter(item => item.severity === 'error'), []);
    await put(root, 'private/notes.txt', `${privateSentinels[3]}\nUnselected private notes.\n`);
    workspace = await library.readWorkspace(source);
    assert.equal(workspace.complete, true, JSON.stringify(workspace.diagnostics));
    assert.equal(workspace.valid, true, JSON.stringify(workspace.diagnostics));
    assert.deepEqual(library.validateSchema('project', workspace.config), []);
    assert.equal(Object.hasOwn(workspace,'history'),false);
    const { shippingFee } = await import(pathToFileURL(path.join(root, 'src/shipping.mjs')).href);
    assert.deepEqual([shippingFee(49), shippingFee(50)], [5, 0]);
    return { records: workspace.records.map(item => item.header.id), complete: workspace.complete, valid: workspace.valid, sourceBasis: workspace.sourceBasis };
  });
  await check('cli-library-agreement', async () => {
    assert.ok(workspace, 'Ordinary source inspection must be available');
    const bin = 'node_modules/@neutral/intent/apps/cli/intent.mjs';
    const inspect = JSON.parse((await run(process.execPath, [bin, 'inspect', root, '--json'])).stdout);
    const query = JSON.parse((await run(process.execPath, [bin, 'query', root, 'shipping', '--json'])).stdout);
    const select = JSON.parse((await run(process.execPath, [bin, 'select', root, 'description.shipping', '--json'])).stdout);
    const jsonWire = value => JSON.parse(JSON.stringify(library.toWire(value)));
    assert.deepEqual(inspect, jsonWire(workspace));
    assert.deepEqual(query, jsonWire(library.queryKnowledge(workspace, { text: 'shipping' })));
    assert.deepEqual(select, jsonWire(library.selectKnowledge(workspace, ['description.shipping'])));
    assert.deepEqual(query.records.map(item => item.header.id), ['description.shipping']);
    assert.deepEqual(select.records.map(item => item.header.id), ['description.shipping']);
    const reconciliation=JSON.parse((await run(process.execPath,[bin,'reconcile',root,'--json'])).stdout);
    assert.equal(reconciliation.mode,'reconciliation');assert.equal(reconciliation.coverage.complete,true);
    assert.deepEqual(reconciliation,jsonWire(await library.reconcileWorkspace(source)));
    const discovered=JSON.parse((await run(process.execPath,[bin,'guidance','--json'])).stdout);
    const family=discovered.files.find(file=>file.path.startsWith('families/blueprint/')&&file.path.endsWith('.md'));
    const selectedGuidance=['GUIDANCE.md','guidance/blueprint.md',...(family?[family.path]:[])];
    for(const guidePath of selectedGuidance){
      const guide=JSON.parse((await run(process.execPath,[bin,'guidance',guidePath,'--json'])).stdout);
      const expected=await fs.readFile(path.join(root,'node_modules/@neutral/intent/spec',guidePath));
      assert.equal(guide.markdown,expected.toString('utf8'));assert.equal(guide.bytes,expected.length);
      assert.equal(guide.sourceDigest,`sha256:${createHash('sha256').update(expected).digest('hex')}`);
    }
    return { inspect: 'full wire equality', query: 'full wire equality', select: 'full wire equality', reconciliation:'full wire equality including governed coverage',guidance:selectedGuidance };
  });
  await check('installed-readable-check-api-cli-guide', async () => {
    assert.ok(library, 'Installed public Library must be available');
    const target = path.join(root, 'check-consumer');
    const checkId = 'check.committed', behaviorId = 'behavior.committed';
    const checkPath = 'intent/checks/committed.md', behaviorPath = 'intent/behavior/committed.md';
    const local = (kind, id, body) => `---\n${JSON.stringify({ schema: 'intent.knowledge-record.v2', kind, id, status: 'current' }, null, 2)}\n---\n${body}`;
    const checkBody = `# Read an acknowledged value

Examine committed state through an independent reader.

## Proposition

An acknowledged value remains readable after its writer closes.

## Pass

After each acknowledged write and writer closure, an independent reader returns the exact committed value.

## Fail

An acknowledged value is missing or changed after writer closure.

## Indeterminate

The examination cannot distinguish committed storage from shared process memory.

## Not Run

No independent read was attempted.

## Evidence

Identify inputs, acknowledgements, writer closure and actual independent reads.

## Limits

### entry:failure-boundary

This examination does not establish survival of power failure.

## Falsifiers

### entry:memory-only

A memory-only store acknowledges writes but loses them when the writer closes.

## Method

Keep the independent reader in a separate process.
`;
    const behaviorBody = `# Preserve acknowledged values

Callers can recover acknowledged values after the writer closes.

## Outcome

An independent reader recovers every acknowledged value after writer closure.

## Actors

### entry:caller

A caller writes and later reads a value.

## Conditions

## Included

### entry:acknowledged-value

Preserve every acknowledged value across writer closure.

## Excluded

### entry:power-failure

Recovery after power failure is outside this promise.

## Examples

## Falsifiers

### entry:lost-value

An acknowledged value disappears when the writer closes.

## Connection: commit-definition

### Scope

Acknowledged values across writer closure.

### Rationale

An immediate read by the writer can conceal memory-only storage.
`;
    const coordinate = id => id;
    const fixture = {
      'intent/project.json': JSON.stringify({ schema: 'intent.project.v1', name: 'Installed readable Check consumer', owners: ['consumer-owner'], implementationRoots: [], exemptions: [] }),
      'intent/catalog.json': JSON.stringify({ schema: 'intent.catalog.v1', sources: [], records: [checkId, behaviorId].map(id => ({ record: coordinate(id), owners: ['consumer-owner'], tags: [] })) }),
      'intent/connections.json': JSON.stringify({ schema: 'intent.connections.v1', relationships: [{ id: 'commit-definition', record: coordinate(behaviorId), type: 'verified-by', target: checkId, required: true }], conflicts: [], sourceUses: [], coverage: [], checkSelections: [{ id: 'store-subject', record: coordinate(checkId), subjects: [{ kind: 'file', selector: 'future/store.mjs' }], evidenceKinds: ['inspection'] }] }),
      [checkPath]: local('check', checkId, checkBody),
      [behaviorPath]: local('behavior', behaviorId, behaviorBody),
    };
    for (const [name, text] of Object.entries(fixture)) await put(target, name, text);
    const observed = await library.readWorkspace(await library.FileSystemSource.open(target));
    const reading = library.readCheck(observed, checkId, { maxBytes: 16777216 });
    assert.equal(reading.complete, true, JSON.stringify(reading.diagnostics));
    assert.equal(reading.valid, true);
    assert.equal(reading.check.body, checkBody);
    assert.equal(Object.hasOwn(reading.check,'evaluation'),false, 'Readable Check must not duplicate authored criteria');
    const checkRecord=observed.records.find(record=>record.header.id===checkId);
    assert.equal(library.readRecordDocument(checkRecord).spec.evaluation.notRun, 'No independent read was attempted.');
    assert.deepEqual(reading.check.subjects, [{ kind: 'file', selector: 'future/store.mjs' }]);
    assert.equal(reading.supportedKnowledge.length, 1);
    assert.equal(reading.supportedKnowledge[0].knowledge.body, behaviorBody);
    assert.equal(reading.supportedKnowledge[0].relationship.scope, 'Acknowledged values across writer closure.');
    assert.equal(reading.supportedKnowledge[0].relationship.rationale, 'An immediate read by the writer can conceal memory-only storage.');
    assert.deepEqual(library.validateSchema('urn:intent:schema:reader-results:v1#/$defs/checkReading', reading), []);
    const bin = 'node_modules/@neutral/intent/apps/cli/intent.mjs';
    const json = JSON.parse((await run(process.execPath, [bin, 'read-check', target, checkId, '--json'])).stdout);
    assert.deepEqual(json, reading, 'Installed CLI and Library must return the same complete Check reading');
    const markdown = (await run(process.execPath, [bin, 'read-check', target, checkId])).stdout;
    for (const expected of [checkBody, behaviorBody, checkId, 'file: future/store.mjs', 'verified-by check.committed', 'Relationship scope:', reading.supportedKnowledge[0].relationship.rationale]) assert.ok(markdown.includes(expected), `Readable CLI output omits ${expected}`);
    assert.deepEqual(await pathsIn(target), Object.keys(fixture).sort(), 'Reading must not create implementation or result files');
    for (const [name, text] of Object.entries(fixture)) assert.equal(await fs.readFile(path.join(target, name), 'utf8'), text, `Reading changed ${name}`);
    const guidePath = 'spec/guidance/check-review.md';
    const guide = await fs.readFile(path.join(root, 'node_modules/@neutral/intent', guidePath));
    const archivedGuide = (await run('tar', ['-xOf', path.join(archiveDirectory, archiveNames[0]), `package/${guidePath}`])).stdout;
    assert.deepEqual(guide, Buffer.from(archivedGuide), 'Installed guide must preserve the exact selected archive bytes');
    assert.ok(guide.toString('utf8').includes('What unacceptable implementation could still pass this Check?'));
    return { root: target, check: checkId, supportedKnowledge: [behaviorId], jsonAgreement: 'full carrier equality', markdown: 'exact authored Check and Behavior bodies plus global selections and relationship explanations', guide: { path: guidePath, bytes: guide.length, sha256: createHash('sha256').update(guide).digest('hex') }, missingImplementation: 'future/store.mjs', unchangedFixtureFiles: Object.keys(fixture).length };
  });
  await check('installed-optional-family-independence', async () => {
    assert.ok(library, 'Installed public Library must be available');
    const target = path.join(root, 'check-consumer'), checkId = 'check.committed';
    const packages = ['@neutral/intent'];
    const specificationRoots = [path.join(root, 'node_modules/@neutral/intent/spec')];
    const snapshot = async directory => Promise.all((await pathsIn(directory)).map(async name => [name, await fs.readFile(path.join(directory, name))]));
    const specifications = await Promise.all(specificationRoots.map(snapshot));
    assert.ok(specifications[0].some(([name])=>name==='GUIDANCE.md'),'Common guidance is part of the shared specification');
    const specificationManifest = specifications[0].map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }));
    const familyReadme = specifications[0].find(([name]) => name === 'families/README.md')?.[1];
    assert.ok(familyReadme, 'The stable family guidance entry must be shipped');
    const familyDirectories = (await fs.readdir(path.join(specificationRoots[0], 'families'), { withFileTypes: true })).filter(item => item.isDirectory()).map(item => item.name).sort();
    const replacementKind = familyDirectories[0] ?? 'behavior';
    const commonReview = specifications[0].find(([name]) => name === 'guidance/check-review.md')?.[1];
    assert.ok(commonReview, 'The common Check review guide must be shipped');

    const consumerBytes = await snapshot(target);
    const cli = path.join(root, 'node_modules/@neutral/intent/apps/cli/intent.mjs');
    const agent = path.join(root, 'node_modules/@neutral/intent/apps/agent/intent-agent.mjs');
    const wire = value => JSON.parse(JSON.stringify(library.toWire(value)));
    const observe = async () => {
      const current = await library.readWorkspace(await library.FileSystemSource.open(target));
      assert.equal(current.valid, true, JSON.stringify(current.diagnostics));
      assert.equal(current.complete, true);
      assert.equal(Object.hasOwn(current,'history'), false);
      const reading = library.readCheck(current, checkId, { maxBytes: 16777216 });
      assert.equal(reading.complete, true, JSON.stringify(reading.diagnostics));
      assert.equal(reading.valid, true);
      const cliWorkspace = JSON.parse((await run(process.execPath, [cli, 'inspect', target, '--json'])).stdout);
      const cliReading = JSON.parse((await run(process.execPath, [cli, 'read-check', target, checkId, '--json'])).stdout);
      const markdown = (await run(process.execPath, [cli, 'read-check', target, checkId])).stdout;
      assert.deepEqual(cliWorkspace, wire(current), 'Installed CLI and Library workspace reads must agree');
      assert.deepEqual(cliReading, reading, 'Installed CLI and Library Check reads must agree');
      const mcp = await withMcp(agent, target, async ({ request, tool, notify }) => {
        const initialize = await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'installed-family-independence', version: '1.0.0' } });
        assert.equal(initialize.result.protocolVersion, '2025-11-25');
        notify('notifications/initialized');
        const catalog = await request('tools/list');
        assert.equal(catalog.error, undefined);
        const { session, ...inspection } = await tool('intent_inspect', {});
        const { session: readingSession, ...checkReading } = await tool('intent_read_check', { session, id: checkId });
        assert.equal(readingSession, session);
        assert.equal(checkReading.reviewGuide, commonReview.toString('utf8'));
        const { reviewGuide, ...definition } = checkReading;
        const agentWorkspace = await library.readWorkspace(await library.FileSystemSource.open(target), { limits: inspection.limits });
        assert.deepEqual(definition, library.readCheck(agentWorkspace, checkId, { maxBytes: 524288 }), 'MCP must return the full Library Check under its declared limits');
        return { initialize: initialize.result, catalog: catalog.result, inspection, checkReading };
      });
      assert.deepEqual(await snapshot(target), consumerBytes, 'Observations must preserve all consumer source bytes');
      return { workspace: wire(current), reading, cliWorkspace, cliReading, markdown, mcp };
    };
    const original = await observe();
    const backupRoot = await fs.mkdtemp(path.join(root, 'optional-family-backups-'));
    const moved = [];
    try {
      for (const [index, specificationRoot] of specificationRoots.entries()) {
        const families = path.join(specificationRoot, 'families'), backup = path.join(backupRoot, String(index));
        await fs.rename(families, backup);
        moved.push({ families, backup });
        await put(families, 'README.md', familyReadme);
      }
      assert.deepEqual(await observe(), original, 'Removing optional family content must leave every observed public result unchanged');
      for (const { families } of moved) await put(families, `${replacementKind}/consumer-replacement.md`, '# Consumer replacement guidance\n\nOptional locally supplied advice with no Product authority.\n');
      assert.deepEqual(await observe(), original, 'Replacement optional family content must leave every observed public result unchanged');
    } finally {
      for (const { families, backup } of moved.reverse()) {
        await fs.rm(families, { recursive: true, force: true });
        await fs.rename(backup, families);
      }
      await fs.rm(backupRoot, { recursive: true, force: true });
    }
    for (const [index, specificationRoot] of specificationRoots.entries()) assert.deepEqual(await snapshot(specificationRoot), specifications[index], `${packages[index]} specification bytes must be restored exactly`);
    return { packages, specificationFiles: specificationManifest.length, specificationSha256: createHash('sha256').update(JSON.stringify(specificationManifest)).digest('hex'), states: ['original', 'optional families removed', 'arbitrary replacement item'], agreement: 'full Library/CLI workspace and Check, readable CLI, fresh-process MCP inspection/Check/catalog/common review; only MCP session IDs omitted', unchangedConsumerFiles: consumerBytes.length, restoredSpecificationBytes: true };
  });
  await check('editor-real-installed-service', async () => {
    const executable = path.join(root, 'node_modules/@neutral/intent/apps/editor/intent-editor.mjs');
    const child = spawn(process.execPath, [executable, root, '--no-browser'], { cwd: root, env:{...process.env,INTENT_STATE_DIR:path.join(root,'tmp','editor-user-data')}, stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '', stdout = '';
    child.stderr.on('data', value => stderr += value);
    try {
      const url = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`Editor did not announce URL: ${stderr}`)), 15_000);
        child.once('exit', code => { clearTimeout(timer); reject(new Error(`Editor exited ${code}: ${stderr}`)); });
        child.stdout.on('data', value => { stdout += value; const match = stdout.match(/http:\/\/127\.0\.0\.1:\d+[^\s]*/); if (match) { clearTimeout(timer); resolve(match[0]); } });
      });
      const response = await fetch(url);
      assert.equal(response.status, 200);
      const html = await response.text();
      assert.match(html, /Intent/i);
      const assets = [...html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))(?:["'])/g)].map(match => match[1]);
      assert.ok(assets.some(value => value.endsWith('.js')));
      assert.ok(assets.some(value => value.endsWith('.css')));
      for (const asset of assets) { const answer = await fetch(new URL(asset, url)); assert.equal(answer.status, 200, asset); assert.ok((await answer.arrayBuffer()).byteLength > 0); }
      return { command: [process.execPath, executable, root], url, assets, stdout, stderr };
    } finally { child.kill('SIGTERM'); if (child.exitCode === null) await once(child, 'exit'); }
  });
  await check('portal-api-cli-static-http-private-boundary', async () => {
    const portal = await import(packageUrls.portal);
    const reads = [], lists = [];
    const selectedPaths = [publicPath,'intent/catalog.json','intent/connections.json'].sort();
    const tracedSource = { identity: source.identity, immutable: source.immutable,
      list: async name => { lists.push(name); assert.ok(selectedPaths.includes(name), `Portal enumerated unselected scope: ${name}`); return source.list(name); },
      read: async (name, limit) => { reads.push(name); assert.ok(selectedPaths.includes(name), `Portal read unselected content: ${name}`); return source.read(name, limit); } };
    portalBuild = await portal.buildPortal(workspace, tracedSource, selection);
    assert.equal(portalBuild.complete, true, JSON.stringify(portalBuild.diagnostics));
    assert.deepEqual([...new Set(reads)].sort(), selectedPaths);
    assert.deepEqual([...new Set(lists)].sort(), selectedPaths);
    assert.deepEqual(portalBuild.manifest.records.map(item => item.id), ['description.shipping']);
    assert.equal(Object.hasOwn(portalBuild.manifest,'history'),false);
    assert.ok(portalBuild.manifest.omissions.some(item => item.target === 'description.internal-costs'));
    for (const file of portalBuild.files) {
      for (const sentinel of privateSentinels) assert.equal(Buffer.from(file.bytes).includes(Buffer.from(sentinel)), false, `${file.path} leaked ${sentinel}`);
      assert.equal(Buffer.from(file.bytes).includes(Buffer.from(root)), false, `${file.path} leaked repository root`);
    }
    await put(root, 'selection.json', JSON.stringify(selection, null, 2));
    const out = path.join(root, 'selected-site');
    await run(process.execPath, ['node_modules/@neutral/intent/apps/portal/portal-cli.mjs', root, path.join(root, 'selection.json'), out]);
    assert.deepEqual(await pathsIn(out), portalBuild.files.map(file => file.path).sort());
    for (const file of portalBuild.files) assert.deepEqual(await fs.readFile(path.join(out, file.path)), Buffer.from(file.bytes), `API/CLI differ: ${file.path}`);
    const server = createServer(async (request, response) => {
      try {
        const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
        assert.ok(pathname.startsWith('/selected/'));
        const relative = pathname.slice('/selected/'.length) || 'index.html';
        assert.ok(portalBuild.files.some(file => file.path === relative));
        response.setHeader('Content-Type', portalBuild.files.find(file => file.path === relative).mediaType);
        response.end(await fs.readFile(path.join(out, relative)));
      } catch { response.writeHead(404); response.end('Not found'); }
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const url = `http://127.0.0.1:${server.address().port}/selected/`;
    try {
      for (const file of portalBuild.files) {
        const response = await fetch(new URL(file.path, url)); assert.equal(response.status, 200, file.path);
        assert.deepEqual(Buffer.from(await response.arrayBuffer()), Buffer.from(file.bytes));
        if (file.path.endsWith('.html')) {
          for (const match of Buffer.from(file.bytes).toString('utf8').matchAll(/(?:href|src)="([^"#]+)"/g)) {
            const linked = new URL(match[1], new URL(file.path, url));
            assert.equal(linked.origin, new URL(url).origin, 'Static content must not require a remote origin');
            assert.equal((await fetch(linked)).status, 200, `${file.path}: ${match[1]}`);
          }
        }
      }
    } finally { await new Promise(resolve => server.close(resolve)); }
    return { files: portalBuild.files.length, selected: selection, sourceLists: lists, sourceReads: reads, privateSentinels, staticHttpUrl: url, checks: 'Every byte of every emitted file and every HTML link fetched through ordinary static HTTP' };
  });
  await check('mcp-stdio-initialize-list-inspect-read', async () => {
    const executable = path.join(root, 'node_modules/@neutral/intent/apps/agent/intent-agent.mjs');
    return withMcp(executable, root, async ({ request, tool, notify, stderr }) => {
      const initialize = await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'installed-consumer-qualification', version: '1.0.0' } });
      assert.equal(initialize.result.protocolVersion, '2025-11-25');
      assert.equal(initialize.result.serverInfo.version,archiveInventory.version);
      notify('notifications/initialized');
      const list = await request('tools/list');
      const catalog = JSON.parse(await fs.readFile(path.join(root, 'node_modules/@neutral/intent/apps/agent/tools.json'), 'utf8'));
      assert.deepEqual(list.result.tools, catalog.tools ?? catalog);
      assert.ok(list.result.tools.some(tool => tool.name === 'intent_read_check' && tool.annotations.readOnlyHint === true), 'Installed MCP catalog exposes readable Check retrieval');
      assert.match(initialize.result.instructions, /intent_read_check/);
      assert.ok(list.result.tools.some(tool=>tool.name==='intent_guidance'&&tool.annotations.readOnlyHint===true));
      const discovered=await tool('intent_guidance',{});
      const family=discovered.files.find(file=>file.path.startsWith('families/blueprint/')&&file.path.endsWith('.md'));
      const selectedGuidance=['GUIDANCE.md','guidance/blueprint.md',...(family?[family.path]:[])];
      for(const guidePath of selectedGuidance){
        const guide=await tool('intent_guidance',{path:guidePath});
        const expected=await fs.readFile(path.join(root,'node_modules/@neutral/intent/spec',guidePath));
        assert.equal(guide.markdown,expected.toString('utf8'));assert.equal(guide.bytes,expected.length);
        assert.equal(guide.sourceDigest,`sha256:${createHash('sha256').update(expected).digest('hex')}`);
      }
      const inspection = await tool('intent_inspect', {});
      assert.equal(inspection.records, workspace.records.length);
      const libraryWithAgentLimits = await library.readWorkspace(source, { limits: inspection.limits });
      assert.equal(inspection.sourceBasis.id, libraryWithAgentLimits.sourceBasis.id);
      assert.equal(inspection.valid, true); assert.equal(inspection.complete, true);
      const query = await tool('intent_query', { session: inspection.session, text: 'shipping' });
      assert.equal(query.total, 1);
      const bytes = await tool('intent_read', { session: inspection.session, path: publicPath });
      assert.equal(bytes.encoding, 'base64'); assert.equal(bytes.nextOffset, null);
      assert.deepEqual(Buffer.from(bytes.data, 'base64'), await fs.readFile(path.join(root, publicPath)));
      return { command: [process.execPath, executable, '--root', root], protocol: initialize.result.protocolVersion, catalogCount: list.result.tools.length, sourceBasis: inspection.sourceBasis, exactReadBytes: bytes.totalBytes,guidance:selectedGuidance, stderr: stderr() };
    });
  });
  await check('mcp-installed-current-edit', async () => {
    const target = path.join(root, 'agent-edit-consumer'), recordPath = 'intent/description/src/_unit.desc.md';
    const original = record({ id: 'description.unit', title: 'Local calculation', codePath: 'src/unit.mjs', detail: 'Calculate the subtotal.' });
    await put(target, 'src/unit.mjs', 'export const calculate = value => value;\n');
    await put(target, 'intent/project.json', JSON.stringify({ schema: 'intent.project.v1', name: 'Agent edit consumer', owners: ['consumer-owner'], implementationRoots: ['src'], exemptions: [] }));
    await put(target, 'intent/catalog.json', JSON.stringify(original.context.catalog));
    await put(target, 'intent/connections.json', JSON.stringify(original.context.connections));
    await put(target, recordPath, original.sourceText);
    const executable = path.join(root, 'node_modules/@neutral/intent/apps/agent/intent-agent.mjs');
    return withMcp(executable, target, async ({ request, tool, notify }) => {
      await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'installed-edit-fixture', version: '1' } });
      notify('notifications/initialized');
      const inspected = await tool('intent_inspect', { resolveSources: true });
      const prepared = await tool('intent_prepare_change', { session: inspected.session, path: recordPath,
        operation: { kind: 'edit', sourceText: original.sourceText.replace('Calculate the subtotal.', 'Calculate the subtotal with the declared local policy.') } });
      assert.equal(prepared.applicable, true, JSON.stringify(prepared));
      assert.equal(await fs.readFile(path.join(target, recordPath), 'utf8'), original.sourceText);
      const chunks = []; let offset = 0;
      while (offset !== null) { const chunk = await tool('intent_result', { result: prepared.result, offset, maxBytes: 65536 }); chunks.push(Buffer.from(chunk.data, 'base64')); offset = chunk.nextOffset; }
      const review = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      assert.equal(review.fileProposal.changes.find(change=>change.path===recordPath).before, original.sourceText);
      assert.equal(Object.hasOwn(review.original.records[0],'sourceText'),false);
      assert.equal(review.proposed.records[0].header.id, 'description.unit');
      assert.equal(Object.hasOwn(review.proposed.records[0].header,'revision'),false);
      assert.ok(review.fileProposal.changes.some(change => change.path === recordPath));
      const applied = await tool('intent_apply', { proposal: prepared.result });
      assert.equal(applied.status, 'completed', JSON.stringify(applied));
      assert.equal(applied.journal, null);
      const observed = await library.readWorkspace(await library.FileSystemSource.open(target), { resolveSources: true });
      assert.equal(observed.records[0].header.id, 'description.unit');
      assert.equal(observed.valid,true);
      assert.equal(Object.hasOwn(observed,'history'),false);
      return { root: target, identity: 'description.unit', writtenPaths: applied.written, originalPreserved: true, review: 'full result retrieved before separate application' };
    });
  });
  await check('mcp-installed-staged-edit-one-mib', async () => {
    assert.ok(library, 'Installed public Library must be available');
    const target = path.join(root, 'staged-edit-consumer');
    const executable = path.join(root, 'node_modules/@neutral/intent/apps/agent/intent-agent.mjs');
    const unit = record({ id: 'description.staged', title: 'Staged consumer value', codePath: 'src/value.mjs', detail: 'Return the supplied numeric value unchanged.' });
    unit.context.catalog.sources.push({ id: 'decision', reference: 'docs/decision.md' });
    unit.context.connections.sourceUses.push({ id: 'decision-use', record: 'description.staged', source: 'decision', required: true, revision: null, role: 'decision' });
    const size = 1048576, catalogPath = 'intent/catalog.json';
    const padded = tag => {
      const value = structuredClone(unit.context.catalog);
      if (tag) value.records[0].tags = [tag];
      const text = JSON.stringify(value, null, 2) + '\n';
      return text + ' '.repeat(size - Buffer.byteLength(text));
    };
    const before = padded(), after = padded('edited'), replacementPath = 'tmp/intent-agent/edits/catalog.json';
    const sha256 = bytes => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    await put(target, 'intent/project.json', JSON.stringify({ schema: 'intent.project.v1', name: 'Installed staged edit consumer', owners: ['consumer-owner'], implementationRoots: ['src'], exemptions: [] }));
    await put(target, catalogPath, before);
    await put(target, 'intent/connections.json', JSON.stringify(unit.context.connections));
    await put(target, 'intent/description/src/_value.desc.md', unit.sourceText);
    await put(target, 'src/value.mjs', 'export const value = input => input;\n');
    await put(target, 'docs/decision.md', 'The installed fixture explicitly retains and resolves this local design source.\n');
    return withMcp(executable, target, async ({ request, tool, notify, stderr }) => {
      const initialized = await request('initialize', { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'installed-staged-edit-qualification', version: '1.0.0' } });
      assert.equal(initialized.result.protocolVersion, '2025-11-25');
      notify('notifications/initialized');
      const list = await request('tools/list');
      assert.ok(list.result.tools.some(item => item.name === 'intent_prepare_edit' && item.annotations.readOnlyHint === true));
      const inspection = await tool('intent_inspect', { resolveSources: true });
      assert.equal(inspection.stages.find(item => item.name === 'source-basis').complete, true);
      assert.equal(inspection.stages.find(item => item.name === 'sources').complete, true);
      const retainedBytes = async (name, input) => {
        const parts = []; let offset = 0, total;
        while (offset !== null) {
          const part = await tool(name, { ...input, offset, maxBytes: 65536 });
          assert.equal(part.encoding, 'base64'); assert.equal(part.offset, offset);
          total ??= part.totalBytes; assert.equal(part.totalBytes, total);
          parts.push(Buffer.from(part.data, 'base64')); offset = part.nextOffset;
        }
        const bytes = Buffer.concat(parts); assert.equal(bytes.length, total); return bytes;
      };
      const original = await retainedBytes('intent_read', { session: inspection.session, path: catalogPath });
      assert.equal(original.length, size); assert.deepEqual(original, Buffer.from(before));
      await put(target, replacementPath, after);
      const prepareInput = { session: inspection.session, path: catalogPath, replacementPath, replacementDigest: sha256(after) };
      const requestBytes = Buffer.byteLength(JSON.stringify({ jsonrpc: '2.0', id: 100, method: 'tools/call', params: { name: 'intent_prepare_edit', arguments: prepareInput } }));
      assert.ok(requestBytes < 1024, 'The reference request stays small for a 1 MiB replacement');
      const prepared = await tool('intent_prepare_edit', prepareInput);
      assert.equal(prepared.applied, false);
      assert.deepEqual(prepared.changes, [{ path: catalogPath, beforeBytes: size, afterBytes: size }]);
      const proposal = JSON.parse((await retainedBytes('intent_result', { result: prepared.result })).toString('utf8'));
      assert.equal(proposal.sourceBasis, inspection.sourceBasis.id);
      assert.deepEqual(proposal.changes, [{ path: catalogPath, before, after }]);
      assert.equal(await fs.readFile(path.join(target, catalogPath), 'utf8'), before, 'Preparation is effect-free');
      const laterStaging = 'Staging changed after proposal preparation.\n';
      await put(target, replacementPath, laterStaging);
      const applied = await tool('intent_apply', { proposal: prepared.result });
      assert.equal(applied.status, 'completed'); assert.deepEqual(applied.written, [catalogPath]);
      assert.equal(await fs.readFile(path.join(target, catalogPath), 'utf8'), after);
      assert.equal(await fs.readFile(path.join(target, replacementPath), 'utf8'), laterStaging, 'Apply leaves later staging bytes untouched');
      assert.equal(applied.journal, null);
      assert.equal(await fs.stat(path.join(target,`tmp/intent/operations/${applied.id}.json`)).then(()=>true,()=>false), false);
      const fresh = await tool('intent_inspect', { resolveSources: true });
      await put(target, replacementPath, padded('next'));
      const stale = await tool('intent_prepare_edit', { session: fresh.session, path: catalogPath, replacementPath, replacementDigest: sha256(padded('next')) });
      const external = padded('external'); await put(target, catalogPath, external);
      const refusal = await request('tools/call', { name: 'intent_apply', arguments: { proposal: stale.result } });
      assert.equal(refusal.error, undefined); assert.equal(refusal.result.isError, true);
      assert.equal(JSON.parse(refusal.result.content[0].text).code, 'intent.agent.stale-proposal');
      assert.equal(await fs.readFile(path.join(target, catalogPath), 'utf8'), external);
      const missingJournal = `tmp/intent/operations/${stale.id}.json`;
      assert.equal(await fs.stat(path.join(target, missingJournal)).then(() => true, () => false), false, 'A stale proposal rejected before apply must not create a journal');
      return { root: target, sourceBytes: size, replacementBytes: size, requestBytes, resolveSources: true, exactOriginalDigest: sha256(original), exactReplacementDigest: sha256(after), appliedOperation: applied.id, completedRecoveryRemoved: applied.journal === null, staleOperation: stale.id, staleJournalAbsent: missingJournal, stagePreserved: true, stderr: stderr() };
    });
  });
  if (extended) await extendedChecks({ root, library, check, run });
  result.finishedAt = new Date().toISOString();
  result.passed = result.checks.every(item => item.status === 'pass');
  await put(path.dirname(resultPath), path.basename(resultPath), JSON.stringify(result, null, 2));
  console.log(`RESULT ${resultPath}`);
  process.exitCode = result.passed ? 0 : 1;
}

async function orchestrate() {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'intent-qualification-run-'));
  const harness = fileURLToPath(import.meta.url);
  const local = await command(process.execPath, [harness, '--worker', ...(extended ? ['--extended'] : []), `--artifacts=${archiveDirectory}`, `--result=${directory}/native.json`], { allowFailure: true, timeout: 300_000 });
  await put(directory, 'native.log', local.stdout + local.stderr);
  console.log(local.stdout); console.error(local.stderr);
  let linux = null;
  if (args.includes('--linux')) {
    const stage = path.join(directory, 'container-input');
    const output = path.join(directory, 'container-output');
    await fs.mkdir(stage); await fs.mkdir(output);
    await fs.copyFile(harness, path.join(stage, 'installed-consumer.mjs'));
    for (const name of [...archiveNames,'artifacts.json']) await fs.copyFile(path.join(archiveDirectory, name), path.join(stage, name));
    const image = option('--image', 'node:24-bookworm-slim');
    const dockerArguments = ['run', '--rm', '--mount', `type=bind,source=${stage},target=/qualification,readonly`, '--mount', `type=bind,source=${output},target=/results`, image, 'node', '/qualification/installed-consumer.mjs', '--worker', ...(extended ? ['--extended'] : []), '--artifacts=/qualification', '--result=/results/linux.json'];
    linux = await command('docker', dockerArguments, { allowFailure: true, timeout: 600_000 });
    await put(directory, 'linux.log', linux.stdout + linux.stderr);
    const imageIdentity = await command('docker', ['image', 'inspect', '--format', '{{json .RepoDigests}}', image]);
    await put(directory, 'container-run.json', JSON.stringify({ image, imageDigests: JSON.parse(imageIdentity.stdout), mounts: [stage, output], command: dockerArguments, code: linux.code }, null, 2));
    console.log(linux.stdout); console.error(linux.stderr);
  }
  console.log(`Qualification report directory: ${directory}`);
  process.exitCode = local.code === 0 && (!linux || linux.code === 0) ? 0 : 1;
}

if (args.includes('--worker')) await worker(); else await orchestrate();
