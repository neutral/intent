import { createReadStream, createWriteStream } from 'node:fs';
import { lstat, readdir } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';

// USTAR with fixed ownership, times and modes gives repeatable archive bytes.
// The bundle contains only directories and ordinary files; symbolic links fail.
export async function archiveBundle(folder,destination) {
  async function* entries(relative='') {
    const source=join(folder,relative),state=await lstat(source);
    if(!state.isDirectory()&&!state.isFile())throw new Error(`Unsupported bundle file: ${relative}`);
    const directory=state.isDirectory(),name=basename(folder)+(relative?'/'+relative:'')+(directory?'/':'');
    const header=Buffer.alloc(512),split=name.length<=100?-1:name.lastIndexOf('/',name.length-2);
    const leaf=split<0?name:name.slice(split+1),prefix=split<0?'':name.slice(0,split);
    if(Buffer.byteLength(leaf)>100||Buffer.byteLength(prefix)>155)throw new Error(`Archive path exceeds USTAR limits: ${name}`);
    const field=(offset,size,value)=>header.write(value,offset,size,'utf8');
    const octal=(offset,size,value)=>field(offset,size,value.toString(8).padStart(size-1,'0')+'\0');
    field(0,100,leaf);octal(100,8,directory||state.mode&0o111?0o755:0o644);
    octal(108,8,0);octal(116,8,0);octal(124,12,directory?0:state.size);octal(136,12,0);
    field(148,8,'        ');field(156,1,directory?'5':'0');field(257,6,'ustar\0');field(263,2,'00');field(345,155,prefix);
    field(148,8,[...header].reduce((sum,value)=>sum+value,0).toString(8).padStart(6,'0')+'\0 ');
    yield header;
    if(directory)for(const child of (await readdir(source)).sort())yield* entries(relative?relative+'/'+child:child);
    else {yield* createReadStream(source);const padding=(512-state.size%512)%512;if(padding)yield Buffer.alloc(padding);}
  }
  async function* tar(){yield* entries();yield Buffer.alloc(1024);}
  await pipeline(Readable.from(tar()),createGzip({level:9}),createWriteStream(destination,{flags:'wx'}));
}
