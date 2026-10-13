import {fileURLToPath} from 'node:url';

if(Number(process.versions.node.split('.')[0])<22)throw Error('Beta requires Node.js 22 or later. Install Node.js 24 LTS, then reopen your terminal.');

export function loadOptionalEnv(file=fileURLToPath(new URL('../.env.local',import.meta.url))){
 try{process.loadEnvFile(file);return true}
 catch(error){if(error.code==='ENOENT')return false;throw error}
}
loadOptionalEnv();
