import {cp,readFile,writeFile,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
const destination=process.argv[2];
if(!destination)throw new Error('Provide the app Resources directory.');
const site=path.join(destination,'site');
await mkdir(site,{recursive:true});
await cp('site',site,{recursive:true});
// Notes are not part of the desktop app. Remove assets from reused build output too.
await rm(path.join(site,'notes'),{recursive:true,force:true});
await rm(path.join(site,'notes-native.js'),{force:true});
const index=await readFile(path.join(site,'index.html'),'utf8');
await writeFile(path.join(site,'index.html'),index
  .replace('    <link rel="stylesheet" href="notes/style.css" />\n','')
  .replace('    <script type="module" src="notes/app.js"></script>\n',''));
