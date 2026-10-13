import {build} from 'esbuild';
await build({entryPoints:['src/comparison.ts','src/comparison.css'],outdir:'public',bundle:true,format:'esm',minify:true,target:'es2022'});
