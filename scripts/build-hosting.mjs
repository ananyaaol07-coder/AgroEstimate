import {cp, mkdir, readdir, rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'public');
// Rebuild generated output so removed source files cannot remain deployed.
await rm(output,{recursive:true,force:true});
await mkdir(output,{recursive:true});
for(const entry of await readdir(root,{withFileTypes:true})) {
  if(entry.isFile() && /\.(html|css|js)$/.test(entry.name)) {
    await cp(path.join(root,entry.name),path.join(output,entry.name));
  }
}
for(const name of ['assets','templates','vendor']) {
  await cp(path.join(root,name),path.join(output,name),{recursive:true});
}
await cp(path.join(root,'hosting-static','404.html'),path.join(output,'404.html'));
console.log('Prepared Firebase Hosting files in public/.');
