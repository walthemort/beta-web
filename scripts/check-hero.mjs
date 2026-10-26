import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {executable} from '../lib/render-review.mjs';
import {enrichReport} from '../lib/report.mjs';
process.env.NODE_ENV='test';const {server}=await import('../server.js');await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:executable(),args:['--no-sandbox','--disable-dev-shm-usage']});
const desktop={url:'https://brand.example',colors:['#153366','#F3F0E8'],fonts:['Desktop Sans'],sizes:['40px'],svg:true,logoSvg:true,rendered:true,view:'desktop',viewport:{width:1280,height:900},note:'Desktop fixture'},mobile={...desktop,view:'mobile',colors:['#E03422','#FFFFFF'],fonts:['Mobile Sans'],viewport:{width:390,height:844}};
try{
 const context=await browser.newContext({reducedMotion:'reduce',viewport:{width:1440,height:1000}});await context.addInitScript(()=>localStorage.setItem('beta:analytics-consent','false'));
 const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
 await context.route('**/api/review',r=>r.fulfill({json:enrichReport({...desktop,views:{desktop,mobile}})}));
 for(const width of [360,390,768,1440])for(const prefix of ['','/en']){
  await page.setViewportSize({width,height:900});await page.goto(base+prefix+'/');await page.evaluate(()=>document.fonts.ready);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Home overflow '+width+prefix);
  assert.equal(await page.locator('h1').textContent(),prefix?'Your brand.A new view.':'Dit brand.Et nyt blik.');
  assert.equal(await page.locator('[data-selected-case]').count(),7);assert.equal(await page.locator('.editorial-hero,[data-portfolio],[data-open-reel],canvas').count(),0);
  assert.equal(await page.locator('#hero-film').count(),1);assert.equal(await page.locator('#hero-film').getAttribute('src'),null,'Reduced motion leaves the poster without downloading a film');assert.equal(await page.locator('.review-proof').isVisible(),false);
  assert(await page.locator('#review').evaluate(el=>el.compareDocumentPosition(document.querySelector('#work'))&Node.DOCUMENT_POSITION_FOLLOWING));
  assert.equal(await page.locator('#proof-label').textContent(),prefix?'EXAMPLE / BETA’S OWN IDENTITY':'EKSEMPEL / BETAS EGET UDTRYK');
  assert.equal(await page.locator('#review-submit').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),true,'The Review action belongs on the first screen');
  const rootStyles=await page.locator('link[rel=stylesheet]').evaluateAll(nodes=>nodes.map(n=>new URL(n.href).pathname));assert.deepEqual(rootStyles,['/selected-work.css','/review-home.css']);
  await page.locator('#url').fill('brand.example');await page.locator('#url').press('Enter');await page.locator('[data-review-view=mobile]').waitFor();await page.waitForFunction(()=>document.querySelector('.review-proof').dataset.liveProof==='true');
  assert.equal(await page.locator('#proof-palette>span').first().textContent(),'#153366');assert((await page.locator('#proof-font').textContent()).includes('Desktop Sans'));
  await page.locator('[data-review-view=mobile]').click();assert.equal(await page.locator('#proof-palette>span').first().textContent(),'#E03422');assert((await page.locator('#proof-font').textContent()).includes('Mobile Sans'));
  await page.locator('#review-reset').click();assert.equal(await page.locator('#review-submit').getAttribute('aria-expanded'),'false');assert.equal(await page.locator('#proof-palette>span').count(),3);assert.equal(await page.locator('.review-proof').getAttribute('data-live-proof'),null);
 }
 for(const prefix of ['','/en']){await page.setViewportSize({width:1440,height:800});await page.goto(base+prefix+'/');await page.evaluate(()=>document.fonts.ready);assert(await page.locator('#review-submit').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'Review action stays visible on a shorter desktop display');}
 await page.setViewportSize({width:1440,height:1000});await page.goto(base);await page.unroute('**/api/review');await context.unroute('**/api/review');
 await context.route('**/api/review',r=>r.fulfill({status:400,json:{error:'Invalid URL'}}));await page.locator('#url').fill('bad address');await page.locator('#url').press('Enter');await page.locator('.review-error').waitFor();assert.equal(await page.locator('#review-form').getAttribute('aria-busy'),null);assert.equal(await page.locator('.review-proof').getAttribute('data-live-proof'),null);await page.locator('#review-reset').click();assert.equal(await page.locator('#url').evaluate(el=>el===document.activeElement),true);
 assert(!requests.some(url=>url.endsWith('.mp4')));assert.deepEqual(errors,[]);await context.close();
 const plain=await browser.newContext({javaScriptEnabled:false}),nojs=await plain.newPage();await nojs.goto(base);assert.equal(await nojs.locator('h1').isVisible(),true);assert.equal(await nojs.locator('[data-selected-case]:visible').count(),7);assert.equal(await nojs.locator('.no-script-note').isVisible(),true);await nojs.locator('[data-selected-case=rekom]').click();assert(nojs.url().endsWith('/cases/rekom'));await plain.close();
 console.log('Review-first homepage: eight bilingual responsive views, action above the fold, independent CSS, real selected clients, Enter-to-review, live palette/font proof, desktop/mobile updates, close/error focus, reduced-motion poster and native no-JS links passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
