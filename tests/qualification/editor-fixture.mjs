// Disposable UI-qualification carrier built only through public imports.
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRecordTemplate, FileSystemSource, buildDisciplinePack } from '../../dist/library/index.js';
import { startEditor } from '../../dist/apps/editor/server.js';

const root = await mkdtemp(join(tmpdir(), 'intent-editor-journeys-'));
const repository = join(root, 'ordinary-repository');
const pack = join(root, 'advisory-pack');
await mkdir(join(repository, 'src'), { recursive: true });
await mkdir(join(pack, 'records'), { recursive: true });
await writeFile(join(repository, 'README.md'), '# Widget fixture\n\nDisposable ordinary repository for agent UI qualification.\n');
await writeFile(join(repository, 'src', 'widget.js'), 'export const label = "Ready";\n');
await writeFile(join(repository, 'src', 'sample.bin'), Buffer.from([0, 255, 195, 40, 128, 10]));
const template = createRecordTemplate('discipline', {id:'discipline.local-review',title:'Read the changed output',owners:['fixture-publisher'],publisher:'fixture-publisher'});
const parts = template.sourceText.split('---\n');
const header = JSON.parse(parts[1]);
await writeFile(join(pack, 'records', 'local-review.md'), `---\n${JSON.stringify(header,null,2)}\n---\n# Read the changed output\n\nOptional advice to read visible output after making a small change.\n\n## Practice\n\nRead visible output after a change.\n\n## Applicability\n\n### entry:local-output\n\nA small user-visible change can be exercised locally.\n\n## Exclusions\n\n### entry:no-output\n\nNo runnable output is available.\n\n## Guidance\n\n### entry:exercise-change\n\nExercise the changed path and record the output actually observed.\n\n## Verification Guidance\n\n### entry:identify-output\n\nIdentify the path, input, and observed output.\n`);
await writeFile(join(pack, 'pack.json'), JSON.stringify({schema:'intent.discipline-pack.v2',id:'pack.ui-fixture',title:'Local UI fixture advice',version:'1.0.0',publisher:'fixture-publisher',recordSchema:'urn:intent:schema:knowledge-record:v2',sets:[{id:'set.local-review',title:'Output review',description:'Optional local output review.',recordIds:['discipline.local-review']}]},null,2));
for(const [name,value]of Object.entries(template.context))await writeFile(join(pack, `${name}.json`), JSON.stringify(value,null,2));
const built = await buildDisciplinePack(await FileSystemSource.open(pack));
if (!built.valid || !built.complete || !built.candidateManifest) throw new Error(JSON.stringify(built.diagnostics));
await writeFile(join(pack, 'pack.manifest.json'), JSON.stringify(built.candidateManifest,null,2));
const service = await startEditor(repository, {port:0,stateDirectory:join(root,'editor-user-data')});
console.log(JSON.stringify({root,repository,pack,url:service.url,node:process.execPath},null,2));
for (const signal of ['SIGINT','SIGTERM']) process.on(signal, async () => { await service.close(); process.exit(0); });
