import assert from 'node:assert/strict';import {chromium} from 'playwright';import {executable} from '../lib/render-review.mjs';
process.env.NODE_ENV='test';const {server}=await import('../server.js');await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:executable(),args:['--no-sandbox','--disable-dev-shm-usage']});
const expected=['rekom','bat','reformed-cleaning','red-bull','selfmade-records','freshpoint','ild-pizza'];
try{
 const context=await browser.newContext({reducedMotion:'reduce'});await context.addInitScript(()=>localStorage.setItem('beta:analytics-consent','false'));const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [360,390,768,1024,1440])for(const prefix of ['','/en'])for(const route of ['/','/cases']){
  await page.setViewportSize({width,height:1000});await page.goto(base+prefix+route);await page.evaluate(()=>document.fonts.ready);
  assert.deepEqual(await page.locator('[data-selected-case]').evaluateAll(nodes=>nodes.map(n=>n.dataset.selectedCase)),expected);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,route+prefix+' / '+width);
  assert.equal(await page.locator('.selected-photo').count(),0,'Pending stories use the approved marks, not invented project photography');
  assert.equal(await page.locator('.selected-mark').count(),6);assert.equal(await page.locator('.selected-red-bull .selected-name').textContent(),'Red Bull');
  assert.equal(await page.locator('[data-selected-case=rekom]').getAttribute('href'),prefix+'/cases/rekom');
 }
 for(const slug of expected){await page.goto(base+'/cases');await page.locator(`[data-selected-case="${slug}"]`).click();await page.waitForURL('**/cases/'+slug);assert.equal(await page.locator('.client-case-status').count(),1);assert.equal(await page.locator('[data-case-experience]').count(),0)}
 await page.goto(base+'/cases');await page.locator('.concept-directory a[href="/cases/offscript"]').click();await page.waitForURL('**/cases/offscript');await page.locator('[data-save-case]').click();await page.goto(base+'/inspiration');await page.getByRole('heading',{name:'OFFSCRIPT',exact:false}).waitFor();await page.goto(base+'/start');assert((await page.locator('#planner-inspiration').textContent()).includes('OFFSCRIPT'));assert.deepEqual(errors,[]);await context.close();
 const plain=await browser.newContext({javaScriptEnabled:false}),nojs=await plain.newPage();await nojs.goto(base+'/cases');assert.equal(await nojs.locator('[data-selected-case]:visible').count(),7);await nojs.locator('[data-selected-case=bat]').click();assert(nojs.url().endsWith('/cases/bat'));await plain.close();
 console.log('Twenty responsive selected-work views, original seven clients, approved-logo placeholders, native client navigation, concept archive links and inspiration-to-brief continuity passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
