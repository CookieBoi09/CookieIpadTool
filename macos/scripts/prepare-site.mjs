import {build} from 'esbuild';
import {cp,readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const destination=process.argv[2];
if(!destination)throw new Error('Provide the app Resources directory.');
const site=path.join(destination,'site');await mkdir(site,{recursive:true});await cp('site',site,{recursive:true});
// Classic bundled script avoids file:// ES-module fetch restrictions in WKWebView.
await build({entryPoints:['site/notes/app.js'],bundle:true,format:'iife',target:'safari16',outfile:path.join(site,'notes-native.js')});
const index=await readFile(path.join(site,'index.html'),'utf8');
await writeFile(path.join(site,'index.html'),index.replace('<script type="module" src="notes/app.js"></script>','<script src="notes-native.js"></script>'));
