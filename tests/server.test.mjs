import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
process.env.NODE_ENV='test';const {server}=await import('../server.js');let base;
before(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port});after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r))});
test('public pages, private editing boundary and SEO responses are served on the same origin',async()=>{
 for(const path of ['/','/cases','/cases/forma','/cases/rekom','/start','/en','/en/services','/privacy','/inspiration','/admin','/portal']){const r=await fetch(base+path);assert.equal(r.status,200,path);assert.match(r.headers.get('content-type'),/text\/html/)}
 const denied=await fetch(base+'/api/admin/content');assert.equal(denied.status,401);assert.match((await denied.json()).error,/Sign in/);
 const write=await fetch(base+'/api/admin/business',{method:'PUT',headers:{'Content-Type':'application/json'},body:'{"bookingURL":"https://example.com"}'});assert.equal(write.status,401);
 assert.equal((await fetch(base+'/sitemap.xml')).status,200);const robots=await fetch(base+'/robots.txt').then(r=>r.text());assert(robots.includes('Disallow: /admin'));
 const content=await fetch(base+'/api/case-content').then(r=>r.json());assert(content.every(c=>c.status!=='draft'));
});
test('server rejects unsafe review destinations before fetching and enforces methods',async()=>{
 const r=await fetch(base+'/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:'http://127.0.0.1'})});assert.equal(r.status,400);assert.match((await r.json()).error,/public websites/);
 assert.equal((await fetch(base+'/',{method:'POST'})).status,405);assert.equal((await fetch(base+'/media/..%2Fcontent%2Fbusiness.json')).status,404);
 const noConsent=await fetch(base+'/api/analytics',{method:'POST',body:'{"event":"page_view","path":"/","consent":false}'});assert.equal(noConsent.status,400);
});
