import { copyFileSync, existsSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = new URL('../', import.meta.url);
const path = relative => fileURLToPath(new URL(relative, root));
rmSync(new URL('dist/', root), { recursive: true, force: true });
execFileSync(process.execPath, [path('node_modules/typescript/bin/tsc'), '-p', 'tsconfig.json'], { cwd: path('.'), stdio: 'inherit' });

// The Editor and Portal browser assets: React and React Aria Components bundled by
// Vite into fixed file names beside the compiled service and builder that read them.
// Each bundle names the packages it carries, and their licenses travel beside it.
const { build } = await import('vite');
const { default: react } = await import('@vitejs/plugin-react');

function inventory(notice) {
  return {
    name: 'third-party-licenses',
    generateBundle(_, bundle) {
      const packages = new Set();
      for (const chunk of Object.values(bundle)) if (chunk.type === 'chunk')
        for (const id of chunk.moduleIds ?? Object.keys(chunk.modules)) {
          const match = id.replace(/\\/g, '/').match(/.*\/node_modules\/((?:@[^/]+\/)?[^/]+)\//);
          if (match) packages.add(match[1]);
        }
      const sections = [...packages].sort().map(name => {
        const folder = path(`node_modules/${name}/`), metadata = JSON.parse(readFileSync(`${folder}package.json`, 'utf8'));
        const files = readdirSync(folder).filter(file => /^(?:licen[cs]e|notice)(?:\.(?:md|txt))?$/i.test(file)).sort();
        if (!files.some(file => /^licen[cs]e/i.test(file))) throw new Error(`Bundled package ${name} has no license file`);
        return [`${metadata.name} ${metadata.version} (${metadata.license})`, ...files.map(file => readFileSync(`${folder}${file}`, 'utf8').trim())].join('\n\n');
      });
      this.emitFile({ type: 'asset', fileName: notice, source: `Third-party software bundled into the files beside this notice, with each package's license.\n\n${sections.join('\n\n----------------------------------------------------------------\n\n')}\n` });
    },
  };
}
const banner = notice => `/*! Bundles React and React Aria Components with their dependencies; each package's license is in ${notice} beside this file. */`;
const shared = { configFile: false, logLevel: 'warn', define: { 'process.env.NODE_ENV': JSON.stringify('production') } };
const client = (ui, outDir, entry, file, name) => build({
  ...shared,
  plugins: [react(), inventory('third-party-licenses.txt')],
  root: path(ui),
  build: { outDir: path(outDir), emptyOutDir: true, minify: true, cssCodeSplit: false, reportCompressedSize: false,
    lib: { entry: path(`${ui}/${entry}`), name, formats: ['iife'], fileName: () => file, cssFileName: 'style' },
    rolldownOptions: { output: { postBanner: banner('third-party-licenses.txt') } } },
});
await client('apps/editor/ui', 'dist/apps/editor/assets', 'main.tsx', 'app.js', 'IntentEditor');
copyFileSync(path('apps/editor/ui/index.html'), path('dist/apps/editor/assets/index.html'));
await client('apps/portal/ui', 'dist/apps/portal/assets', 'entry-client.tsx', 'reader.js', 'IntentPortal');
// The Portal's prerenderer runs at export time inside the installed package, so it
// carries its own copy of React rather than requiring it at runtime.
await build({
  ...shared,
  plugins: [react(), inventory('render-licenses.txt')],
  root: path('apps/portal/ui'),
  ssr: { noExternal: true, target: 'node' },
  build: { ssr: path('apps/portal/ui/entry-server.tsx'), outDir: path('dist/apps/portal'), emptyOutDir: false, minify: true, reportCompressedSize: false,
    rolldownOptions: { output: { entryFileNames: 'render.js', format: 'es', postBanner: banner('render-licenses.txt') } } },
});
for (const asset of ['dist/apps/editor/assets/index.html', 'dist/apps/editor/assets/app.js', 'dist/apps/editor/assets/style.css', 'dist/apps/portal/assets/reader.js', 'dist/apps/portal/assets/style.css', 'dist/apps/portal/render.js'])
  if (!existsSync(path(asset))) throw new Error(`The build did not produce ${asset}`);
