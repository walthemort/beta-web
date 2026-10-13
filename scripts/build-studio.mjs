import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public/fonts',{recursive:true});
await copyFile('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2','public/fonts/inter-latin-variable.woff2');
await copyFile('node_modules/@fontsource-variable/inter/LICENSE','public/fonts/LICENSE-Inter.txt');
await copyFile('node_modules/three/LICENSE','public/mark-scene.LICENSE.txt');
await build({entryPoints:['src/studio.js'],outdir:'public',bundle:true,format:'esm',minify:true,target:'es2022',external:['./mark-scene.js','./locale.js']});
// Keep the shared locale module at its public path, not a second copy inside the bundle.
await build({entryPoints:['src/mark-scene.js'],outdir:'public',bundle:true,format:'esm',minify:true,target:'es2022',legalComments:'linked'});
