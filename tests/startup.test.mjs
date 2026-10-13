import {test} from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadOptionalEnv} from '../lib/env.mjs';
import {insideDirectory} from '../lib/paths.mjs';

test('optional environment loading tolerates a missing file and preserves injected values',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'beta-env-'));
 try{assert.equal(loadOptionalEnv(path.join(folder,'missing.env')),false);const file=path.join(folder,'local.env');await writeFile(file,'BETA_ENV_TEST_EXISTING=file-value\nBETA_ENV_TEST_NEW=new-value\n');process.env.BETA_ENV_TEST_EXISTING='injected-value';assert.equal(loadOptionalEnv(file),true);assert.equal(process.env.BETA_ENV_TEST_EXISTING,'injected-value');assert.equal(process.env.BETA_ENV_TEST_NEW,'new-value');assert.throws(()=>loadOptionalEnv(folder));}
 finally{delete process.env.BETA_ENV_TEST_EXISTING;delete process.env.BETA_ENV_TEST_NEW;await rm(folder,{recursive:true,force:true})}
});
test('portal containment accepts Windows and POSIX assets but blocks traversal, siblings and other drives',()=>{
 for(const paths of [path.win32,path.posix]){const folder=paths.resolve(paths===path.win32?'E:\\beta-web\\public\\portal-app':'/beta-web/public/portal-app');assert(insideDirectory(folder,paths.resolve(folder,'index.html'),paths));assert(insideDirectory(folder,paths.resolve(folder,'assets','index.js'),paths));for(const file of [folder,paths.resolve(folder,'..','business.json'),paths.resolve(folder+'-other','secret.txt')])assert(!insideDirectory(folder,file,paths));}
 assert(!insideDirectory('E:\\beta-web\\public\\portal-app','C:\\private\\secret.env',path.win32));
});
test('the real server starts without a local env file even from another working directory',async()=>{
 const folder=await mkdtemp(path.join(tmpdir(),'beta-start-'));
 const child=spawn(process.execPath,[fileURLToPath(new URL('../server.js',import.meta.url))],{cwd:folder,env:{...process.env,NODE_ENV:'development',PORT:'0'},stdio:['ignore','pipe','pipe']});let output='';const timer=setTimeout(()=>child.kill(),10000);
 try{await new Promise((resolve,reject)=>{child.stdout.on('data',chunk=>{output+=chunk;if(output.includes('Beta website (beta-web) running'))resolve()});child.stderr.on('data',chunk=>{output+=chunk});child.on('error',reject);child.on('exit',code=>reject(Error(`Startup exited ${code}: ${output}`)))});assert(output.includes('Subpages: /cases /services /studio /start'));}
 finally{clearTimeout(timer);if(child.pid&&child.exitCode===null&&child.signalCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited}await rm(folder,{recursive:true,force:true})}
});
