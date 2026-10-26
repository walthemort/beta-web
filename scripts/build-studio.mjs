import {build} from 'esbuild';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('public/fonts',{recursive:true});
await copyFile('node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2','public/fonts/inter-latin-variable.woff2');
await copyFile('node_modules/@fontsource-variable/inter/LICENSE','public/fonts/LICENSE-Inter.txt');
await build({entryPoints:['src/studio.js','src/case-experiences.js','src/reel.js','src/review-home.js'],outdir:'public',bundle:true,format:'esm',minify:true,target:'es2022',external:['./locale.js','./motion.js']});
// Keep the shared locale module at its public path, not a second copy inside the bundle.
