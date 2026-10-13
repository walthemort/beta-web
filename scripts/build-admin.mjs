import {build} from 'esbuild';
await build({entryPoints:['src/admin.js'],outfile:'public/admin.js',bundle:true,format:'esm',minify:true,target:'es2022'});
