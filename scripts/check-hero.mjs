import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {executable} from '../lib/render-review.mjs';
process.env.NODE_ENV='test';
const {server}=await import('../server.js');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:executable(),args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(()=>localStorage.setItem('beta:analytics-consent','false'));
 const page=await context.newPage(),errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const active=slug=>page.waitForFunction(slug=>document.querySelector('.editorial-hero').dataset.heroDirection===slug,slug);
 await page.goto(base);await page.evaluate(()=>document.fonts.ready);
 await page.locator('.hero-directions').waitFor({state:'visible'});
 await page.locator('[data-hero-panel=offscript] img').evaluate(img=>img.decode());
 const box=await page.locator('#hero-gallery').boundingBox();
 await page.locator('[data-hero-choice=forma]').click();await active('forma');
 assert.equal(await page.locator('[data-hero-panel=offscript]').isVisible(),false);
 assert.equal(await page.locator('[data-hero-panel=forma]').getAttribute('href'),'/cases/forma');
 assert.equal(await page.locator('[data-hero-choice=forma]').getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('#hero-direction-status').textContent(),'Viser perspektiv: Ro');
 const switched=await page.locator('#hero-gallery').boundingBox();
 assert(Math.abs(box.height-switched.height)<1&&Math.abs(box.y-switched.y)<1,'Changing perspective cannot move the page');
 await page.locator('[data-hero-choice=forma]').focus();await page.keyboard.press('ArrowLeft');await active('offscript');
 assert.equal(await page.locator('[data-hero-choice=offscript]').evaluate(el=>el===document.activeElement),true);
 // A decoded earlier request must never replace the latest chosen perspective.
 await page.evaluate(()=>{
  const img=document.querySelector('[data-hero-panel=forma] img');
  window.heroOriginalDecode=img.decode.bind(img);
  img.decode=()=>new Promise(resolve=>window.releaseHeroDecode=resolve);
 });
 await page.locator('[data-hero-choice=forma]').click();
 assert.equal(await page.locator('#hero-gallery').getAttribute('aria-busy'),'true');
 await page.locator('[data-hero-choice=offscript]').click();
 await page.evaluate(()=>window.releaseHeroDecode());
 await page.waitForFunction(()=>document.querySelector('#hero-gallery').getAttribute('aria-busy')==='false');
 assert.equal(await page.locator('.editorial-hero').getAttribute('data-hero-direction'),'offscript');
 // Failed images leave the current case usable, announce the issue, and permit a retry.
 await page.evaluate(()=>document.querySelector('[data-hero-panel=forma] img').decode=()=>Promise.reject(Error('Unavailable image')));
 await page.locator('[data-hero-choice=forma]').click();
 await page.waitForFunction(()=>document.querySelector('#hero-direction-status').textContent.includes('kunne ikke'));
 assert.equal(await page.locator('[data-hero-panel=offscript]').isVisible(),true);
 assert.equal(await page.locator('#hero-gallery').getAttribute('aria-busy'),'false');
 await page.evaluate(()=>document.querySelector('[data-hero-panel=forma] img').decode=window.heroOriginalDecode);
 await page.locator('[data-hero-choice=forma]').click();await active('forma');
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.editorial-hero').evaluate(el=>el.getAnimations({subtree:true}).length),0);
 for(const width of [360,768,1440])for(const language of ['','/en']){
  await page.setViewportSize({width,height:1000});await page.goto(base+language+'/');
  await page.evaluate(()=>document.fonts.ready);await page.locator('.hero-directions').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('h1').textContent(),language?'Made to stand apart.':'Skabt til at skille sig ud.');
  await page.locator('[data-hero-choice=forma]').click();await active('forma');
  assert.equal(await page.locator('[data-hero-panel=forma]').getAttribute('href'),language+'/cases/forma');
  assert.equal(await page.locator('[data-hero-panel]:visible').count(),1);
  assert.equal(await page.locator('#hero-direction-status').textContent(),language?'Showing perspective: Calm':'Viser perspektiv: Ro');
 }
 await page.setViewportSize({width:1440,height:800});await page.goto(base);await page.evaluate(()=>document.fonts.ready);await page.locator('.hero-directions').waitFor({state:'visible'});
 assert(await page.locator('.editorial-hero .agency-button').evaluate(el=>el.getBoundingClientRect().bottom<=innerHeight),'The main action must remain visible on a shorter desktop display');
 assert.deepEqual(errors,[]);await context.close();
 const plain=await browser.newContext({javaScriptEnabled:false}),nojs=await plain.newPage();
 await nojs.goto(base);assert.equal(await nojs.locator('h1').isVisible(),true);
 assert.equal(await nojs.locator('[data-hero-panel=offscript]').getAttribute('href'),'/cases/offscript');
 assert.equal(await nojs.locator('.hero-directions').isVisible(),false);
 await plain.close();
 console.log('Hero perspectives: decoded transitions, stable page geometry, latest-selection wins, failure/retry, keyboard focus, live reduced motion, DA/EN at three widths and native no-JS links passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
