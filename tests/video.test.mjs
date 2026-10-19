import {test} from 'node:test';import assert from 'node:assert/strict';
import {byteRange} from '../lib/video.mjs';import {readFile} from 'node:fs/promises';
process.env.NODE_ENV='test';const {server}=await import('../server.js');
test('single byte ranges support suffixes and clamp ends without accepting unsafe offsets',()=>{
 assert.equal(byteRange(undefined,100),null);assert.deepEqual(byteRange('bytes=0-9',100),{start:0,end:9});assert.deepEqual(byteRange('bytes=90-',100),{start:90,end:99});assert.deepEqual(byteRange('bytes=-12',100),{start:88,end:99});assert.deepEqual(byteRange('bytes=98-999',100),{start:98,end:99});assert.deepEqual(byteRange('bytes=-120',100),{start:0,end:99});
 for(const header of ['bytes=100-','bytes=9-3','bytes=-0','bytes=','bytes=0-2,5-8','items=0-9','bytes=9007199254740992-','bytes=-9007199254740992'])assert.equal(byteRange(header,100),false,header);
});
test('local video streams support seeking, HEAD and unsatisfiable ranges',async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  const bytes=await readFile(new URL('../public/work/hero-loop-mobile.mp4',import.meta.url));
  const head=await fetch(base+'/work/hero-loop-mobile.mp4',{method:'HEAD'});assert.equal(head.status,200);assert.equal(Number(head.headers.get('content-length')),bytes.length);assert.equal(head.headers.get('accept-ranges'),'bytes');assert.equal(head.headers.get('content-type'),'video/mp4');assert.equal((await head.arrayBuffer()).byteLength,0);
  for(const range of ['bytes=0-31','bytes=-16','bytes=100-199']){const response=await fetch(base+'/work/hero-loop-mobile.mp4',{headers:{Range:range}});const expected=byteRange(range,bytes.length);assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),`bytes ${expected.start}-${expected.end}/${bytes.length}`);assert.deepEqual(Buffer.from(await response.arrayBuffer()),bytes.subarray(expected.start,expected.end+1))}
  const denied=await fetch(base+'/work/hero-loop-mobile.mp4',{headers:{Range:`bytes=${bytes.length}-`}});assert.equal(denied.status,416);assert.equal(denied.headers.get('content-range'),`bytes */${bytes.length}`);assert.equal((await denied.arrayBuffer()).byteLength,0);
  const stale=await fetch(base+'/work/hero-loop-mobile.mp4',{method:'HEAD',headers:{Range:'bytes=0-31','If-Range':'Sat, 01 Jan 2000 00:00:00 GMT'}});assert.equal(stale.status,200);
  assert.equal((await fetch(base+'/work/not-a-film.mp4')).status,404);assert.equal((await fetch(base+'/work/..%2Fcontent%2Fbusiness.json')).status,404);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
});
