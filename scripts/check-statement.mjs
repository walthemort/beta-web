import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {executable} from '../lib/render-review.mjs';
process.env.NODE_ENV='test';const {server}=await import('../server.js');await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:executable(),args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({reducedMotion:'reduce'});await context.addInitScript(()=>localStorage.setItem('beta:analytics-consent','false'));const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const width of [360,390,768,1440])for(const language of ['','/en'])for(const path of ['/','/cases','/services','/studio','/start','/studio/arkiv']){
  await page.setViewportSize({width,height:900});await page.goto(base+language+(path==='/'?'':path));await page.evaluate(()=>document.fonts.ready);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${language}${path} overflows at ${width}`);
  assert(await page.evaluate(()=>document.fonts.check('800 16px "Beta Syne"')),'The local statement font must load');
  assert((await page.locator('h1').evaluate(el=>getComputedStyle(el).fontFamily)).includes('Beta Syne'));
  assert.equal(await page.locator('h1').count(),1);assert.equal(await page.locator('.site-header .brand img').getAttribute('src'),'/logos/beta-white.svg');
  assert.equal(await page.locator('.site-header').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(11, 11, 14)');
  assert.equal(await page.locator('.site-footer').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(11, 11, 14)');
  assert.equal(await page.locator('.site-footer .brand img').getAttribute('src'),'/logos/beta-white.svg');
  const clipped=await page.locator('h1 .statement-line>span').evaluateAll(nodes=>nodes.some(el=>el.scrollWidth>el.clientWidth+2));assert.equal(clipped,false,`${language}${path} clips a headline at ${width}`);
  assert.equal(await page.locator('h1').evaluate(el=>el.getAnimations({subtree:true}).length),0);
 }
 await page.goto(base+'/studio');await page.locator('.studio-material').scrollIntoViewIfNeeded();assert(await page.locator('.studio-material img').evaluate(async el=>{await el.decode();return el.naturalWidth>=768}));
 await page.setViewportSize({width:360,height:900});await page.goto(base);await page.locator('#menu-open').click();assert(await page.locator('#menu').evaluate(el=>el.scrollWidth<=el.clientWidth),'The minimal mobile menu must not overflow');await page.keyboard.press('Escape');
 // Pause a real heading reveal halfway, then enable reduced motion while it is running.
 await page.emulateMedia({reducedMotion:'no-preference'});await page.goto(base);await page.evaluate(()=>document.fonts.ready);
 await page.locator('#agency-title .statement-line>span').first().evaluate(el=>{const a=el.getAnimations()[0];if(a){a.pause();a.currentTime=150}});
 const animated=await page.locator('#agency-title .statement-line>span').first().evaluate(el=>{const a=el.getAnimations()[0];return a&&a.effect.getKeyframes().some(k=>k.transform==='translateY(106%)')});assert(animated,'Headline should rise through its line mask');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.querySelector('h1').getAnimations({subtree:true}).length===0);assert.equal(await page.locator('h1').isVisible(),true);
 assert.deepEqual(errors,[]);await context.close();
 const plain=await browser.newContext({javaScriptEnabled:false,viewport:{width:360,height:900}});const nojs=await plain.newPage();for(const path of ['/','/cases','/services','/studio']){await nojs.goto(base+path);assert(await nojs.locator('h1').isVisible());assert(await nojs.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))}await plain.close();
 console.log('Statement identity: 48 bilingual responsive views, local display font, readable headings, white-on-black shell, mobile menu, material image, live reduced-motion cancellation and no-JS pages passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
