import { readFile, readdir, lstat } from 'node:fs/promises';
import { resolve, dirname, relative, join, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser } from 'commonmark';
const root=fileURLToPath(new URL('../',import.meta.url));
const excluded=new Set();
for(let i=2;i<process.argv.length;i++) {
 if(process.argv[i]!=='--exclude'||!process.argv[i+1])throw new Error('Usage: check-docs.mjs [--exclude RELATIVE_DIRECTORY]');
 const value=process.argv[++i];
 if(isAbsolute(value)||value.split('/').some(part=>!part||part==='.'||part==='..'))throw new Error('Choose a repository-relative excluded directory');
 excluded.add(value);
}
const ignored=new Set(['.git','node_modules','dist','tmp','.tmp','.cache','coverage','__pycache__']);
let checked=0;
async function visit(folder) {
 for(const entry of await readdir(folder,{withFileTypes:true})) {
  if(ignored.has(entry.name))continue;
  const path=join(folder,entry.name),local=relative(root,path);
  if(excluded.has(local))continue;
  if(entry.isDirectory())await visit(path);
  else if(entry.isFile()&&entry.name.endsWith('.md')) {
   const walker=new Parser().parse(await readFile(path,'utf8')).walker();let event;
   while((event=walker.next()))if(event.entering&&['link','image'].includes(event.node.type)) {
    const target=event.node.destination;
    if(/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(target))continue;
    const destination=resolve(dirname(path),decodeURIComponent(target.split(/[?#]/)[0]||'.')),localTarget=relative(root,destination);
    if(isAbsolute(localTarget)||localTarget==='..'||localTarget.startsWith('../'))throw new Error(`Link leaves repository: ${local} -> ${target}`);
    try{await lstat(destination);}catch{throw new Error(`Missing documentation link: ${local} -> ${target}`);}
    checked++;
   }
  }
 }
}
await visit(root);console.log(`Checked ${checked} local Markdown file targets; remote URLs and heading fragments are outside this check.`);
