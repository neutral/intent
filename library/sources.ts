import { constants } from "node:fs";
import { lstat, open, readdir, realpath } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { compareText, digest, digestJson, IntentError, normalizedPath } from "./foundation.js";
import type { Json, SourceEntry, SourceReader } from "./types.js";

export class MemorySource implements SourceReader {
  readonly immutable=true;
  readonly identity:string;
  private readonly files:Map<string,Uint8Array>;
  constructor(files:Record<string,string|Uint8Array>) {
    this.files=new Map(Object.entries(files).map(([path,bytes])=>[normalizedPath(path),typeof bytes==="string"?Buffer.from(bytes):Uint8Array.from(bytes)]));
    this.identity=`memory:${digestJson([...this.files].sort(([a],[b])=>compareText(a,b)).map(([path,bytes])=>({path,digest:digest(bytes)})) as Json)}`;
  }
  async list(prefix:string):Promise<SourceEntry[]> {
    normalizedPath(prefix,true);
    const entries=new Map<string,SourceEntry>();
    for(const [path,bytes] of this.files) {
      const parts=path.split("/");
      for(let i=1;i<parts.length;i++) {
        const directory=parts.slice(0,i).join("/");
        if(prefix==="." || directory===prefix || directory.startsWith(`${prefix}/`)) entries.set(directory,{path:directory,kind:"directory",size:0});
      }
      if(prefix==="." || path===prefix || path.startsWith(`${prefix}/`)) entries.set(path,{path,kind:"file",size:bytes.length});
    }
    return [...entries.values()].sort((a,b)=>compareText(a.path,b.path));
  }
  async read(path:string,maximumBytes:number):Promise<Uint8Array> {
    normalizedPath(path);
    const value=this.files.get(path);
    if(!value) throw new IntentError("intent.source.missing",`Missing source ${path}`);
    if(value.length>maximumBytes) throw new IntentError("intent.limit.source-bytes",`${path} exceeds ${maximumBytes} bytes`);
    return Uint8Array.from(value);
  }
}
export class FileSystemSource implements SourceReader {
  readonly immutable=false;
  readonly identity:string;
  private constructor(readonly root:string, private readonly maxEntries:number) { this.identity=`worktree:${root}`; }
  static async open(root:string,options:{maxEntries?:number}={}):Promise<FileSystemSource> {
    const actual=await realpath(resolve(root));
    if(!(await lstat(actual)).isDirectory()) throw new IntentError("intent.source.root","Repository root must be a directory");
    return new FileSystemSource(actual,options.maxEntries??262144);
  }
  private async confined(path:string,allowRoot=false):Promise<string> {
    normalizedPath(path,allowRoot);
    if(path === ".") return this.root;
    let current=this.root;
    for(const part of path.split("/")) {
      const names=await readdir(current).catch(error=>{throw this.translate(error,path);});
      if(names.length>this.maxEntries)throw new IntentError("intent.limit.source-entries","Path parent exceeds the source-entry limit");
      if(!names.includes(part))throw new IntentError("intent.source.missing",`Missing exact source path ${path}; spelling and case must match`);
      current=join(current,part);
      const entry=await lstat(current).catch(error=>{throw this.translate(error,path);});
      if(entry.isSymbolicLink()) throw new IntentError("intent.source.symlink",`Symlink traversal is unsupported: ${path}`);
    }
    const canonical=await realpath(current);
    if(canonical!==this.root && !canonical.startsWith(`${this.root}${sep}`)) throw new IntentError("intent.source.outside-root",`Source escaped selected root: ${path}`);
    return current;
  }
  private translate(error:unknown,path:string):IntentError {
    const code=(error as NodeJS.ErrnoException).code;
    return new IntentError(code==="ENOENT"?"intent.source.missing":"intent.source.unreadable",`${path}: ${code??String(error)}`);
  }
  async list(prefix:string):Promise<SourceEntry[]> {
    const initial=await this.confined(prefix,true).catch(error=>{if(error instanceof IntentError&&error.code==="intent.source.missing") return null;throw error;});
    if(!initial) return [];
    const result:SourceEntry[]=[];
    const pending=[initial];
    while(pending.length) {
      const absolute=pending.pop()!;
      const path=relative(this.root,absolute).split(sep).join("/")||".";
      const stat=await lstat(absolute).catch(error=>{throw this.translate(error,path);});
      if(result.length>=this.maxEntries) throw new IntentError("intent.limit.source-entries",`Source exceeds ${this.maxEntries} entries`);
      if(stat.isSymbolicLink()) {result.push({path,kind:"symlink",size:stat.size});continue;}
      if(stat.isDirectory()) {
        const children=await readdir(absolute).catch(error=>{throw this.translate(error,path);});
        if(path!=="." && children.includes(".git")) {result.push({path,kind:"other",size:0});continue;}
        if(path!==".") result.push({path,kind:"directory",size:0});
        for(const child of children.sort().reverse()) if(child!==".git") pending.push(join(absolute,child));
      } else result.push({path,kind:stat.isFile()?"file":"other",size:stat.size});
    }
    return result.sort((a,b)=>compareText(a.path,b.path));
  }
  async read(path:string,maximumBytes:number):Promise<Uint8Array> {
    const absolute=await this.confined(path);
    const handle=await open(absolute,constants.O_RDONLY|constants.O_NOFOLLOW).catch(error=>{throw this.translate(error,path);});
    try {
      const before=await handle.stat();
      if(!before.isFile()) throw new IntentError("intent.source.unsupported",`Expected a regular file: ${path}`);
      if(before.size>maximumBytes) throw new IntentError("intent.limit.source-bytes",`${path} exceeds ${maximumBytes} bytes`);
      const buffer=Buffer.alloc(Math.min(before.size+1,maximumBytes+1));
      let count=0;
      while(count<buffer.length) {const read=await handle.read(buffer,count,buffer.length-count,null);if(read.bytesRead===0)break;count+=read.bytesRead;}
      const after=await handle.stat();
      await this.confined(path);
      const named=await lstat(absolute);
      if(before.ino!==named.ino || before.dev!==named.dev || before.size!==after.size || before.mtimeMs!==after.mtimeMs || before.ctimeMs!==after.ctimeMs || count!==before.size) throw new IntentError("intent.source.changed",`Source changed while reading: ${path}`);
      return Uint8Array.from(buffer.subarray(0,count));
    } finally {await handle.close();}
  }
}
