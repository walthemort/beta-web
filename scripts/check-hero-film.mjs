import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {executable} from '../lib/render-review.mjs';
process.env.NODE_ENV='test';const {server}=await import('../server.js');await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:executable(),args:['--no-sandbox','--disable-dev-shm-usage']});
const running=page=>page.waitForFunction(()=>{const v=document.querySelector('#hero-film');return !v.paused&&v.currentTime>0});
const paused=page=>page.waitForFunction(()=>document.querySelector('#hero-film').paused);
try{
 for(const width of [390,1440]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'no-preference'});await context.addInitScript(()=>localStorage.setItem('beta:analytics-consent','false'));const page=await context.newPage(),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
  await page.goto(base+(width===390?'/en':''));await page.evaluate(()=>document.fonts.ready);await running(page);
  assert.equal(await page.locator('#hero-film').getAttribute('src'),width===390?'/work/hero-loop-mobile.mp4':'/work/hero-loop.mp4');
  assert(await page.locator('#hero-film').evaluate(el=>el.muted&&el.loop&&el.playsInline&&getComputedStyle(el).objectFit==='cover'));
  assert(!requests.some(url=>url.endsWith(width===390?'/hero-loop.mp4':'/hero-loop-mobile.mp4')),'Only one responsive film should download');
  const geometry=await page.evaluate(()=>{const s=document.querySelector('.hero-stage').getBoundingClientRect(),d=document.querySelector('.hero-dock').getBoundingClientRect(),button=document.querySelector('#review-submit').getBoundingClientRect();return{centreClear:d.top>=s.top+s.height*.65,actionVisible:button.bottom<=innerHeight,backgroundFills:document.querySelector('#hero-film').clientWidth===Math.round(s.width),proofVisible:!!document.querySelector('.review-proof').offsetHeight}});assert(geometry.centreClear&&geometry.actionVisible&&geometry.backgroundFills&&!geometry.proofVisible,JSON.stringify(geometry));
  await page.locator('#hero-film-toggle').click();await paused(page);assert.equal(await page.locator('#hero-film-toggle').getAttribute('aria-label'),width===390?'Play the background film':'Afspil baggrundsfilmen');
  await page.locator('#work').scrollIntoViewIfNeeded();await page.locator('.hero-stage').scrollIntoViewIfNeeded();await paused(page);await page.locator('#hero-film-toggle').click();await running(page);
  await page.locator('#work').scrollIntoViewIfNeeded();await paused(page);await page.locator('.hero-stage').scrollIntoViewIfNeeded();await running(page);
  await page.evaluate(()=>scrollTo({top:160,behavior:'instant'}));await page.locator('.floating-menu.is-visible').click();await paused(page);await page.keyboard.press('Escape');await page.locator('#menu').waitFor({state:'hidden'});await running(page);
  await page.emulateMedia({reducedMotion:'reduce'});await paused(page);await page.locator('#hero-film-toggle').click();await running(page);await page.emulateMedia({reducedMotion:'no-preference'});await page.evaluate(()=>new Promise(requestAnimationFrame));await page.emulateMedia({reducedMotion:'reduce'});await paused(page);
  assert.deepEqual(errors,[]);await context.close();
 }
 for(const mode of ['reduce','save-data']){
  const context=await browser.newContext({reducedMotion:mode==='reduce'?'reduce':'no-preference',viewport:{width:390,height:900}});await context.addInitScript(mode=>{localStorage.setItem('beta:analytics-consent','false');if(mode==='save-data')Object.defineProperty(navigator,'connection',{configurable:true,value:{saveData:true,addEventListener(){}}})},mode);const p=await context.newPage(),requests=[];p.on('request',r=>requests.push(r.url()));await p.goto(base);await p.locator('#hero-film-toggle').waitFor({state:'visible'});assert.equal(await p.locator('#hero-film').getAttribute('src'),null);assert(!requests.some(url=>url.includes('.mp4')));await p.locator('#hero-film-toggle').click();await running(p);await context.close();
 }
 const failure=await browser.newContext({viewport:{width:1440,height:900}});await failure.addInitScript(()=>localStorage.setItem('beta:analytics-consent','false'));await failure.route('**/work/hero-loop.mp4',r=>r.abort());const fp=await failure.newPage();await fp.goto(base);await fp.waitForFunction(()=>document.querySelector('#hero-film').error!==null);assert(await fp.locator('#hero-film-toggle').isHidden());assert(await fp.locator('#review-submit').isVisible());assert.equal(await fp.locator('#hero-film').getAttribute('poster'),'/work/hero-film-poster.webp');await failure.close();
 const plain=await browser.newContext({javaScriptEnabled:false});const p=await plain.newPage(),requests=[];p.on('request',r=>requests.push(r.url()));await p.goto(base);assert(await p.locator('h1').isVisible());assert(await p.locator('#hero-film-toggle').isHidden());assert(!requests.some(url=>url.includes('.mp4')));await plain.close();
 console.log('Hero film: real mobile/desktop playback, clear centre and bottom dock, one responsive source, manual pause, offscreen/menu resume, reduced motion, data saver, media failure and no-JS poster passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
