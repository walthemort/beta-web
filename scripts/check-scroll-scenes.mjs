import assert from 'node:assert/strict';
import {chromium} from 'playwright';import {executable} from '../lib/render-review.mjs';
process.env.NODE_ENV='test';const {server}=await import('../server.js');await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:executable(),args:['--no-sandbox','--disable-dev-shm-usage']});
const frames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});await context.addInitScript(()=>localStorage.setItem('beta:analytics-consent','false'));const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base);await page.locator('.about h2 .scroll-word').first().waitFor({state:'attached'});const original=await page.locator('.about h2').innerText();
 async function position(selector,ratio){await page.locator(selector).evaluate((el,ratio)=>scrollTo({top:el.getBoundingClientRect().top+scrollY-innerHeight*ratio,behavior:'instant'}),ratio);await frames(page)}
 const fill=()=>page.locator('.about h2 .scroll-word').evaluateAll(words=>words.map(word=>parseFloat(word.style.backgroundPosition)));
 await position('.about h2',.78);await page.waitForFunction(()=>document.querySelector('.about .scroll-word').style.backgroundPosition);const before=await fill();await position('.about h2',.25);const after=await fill();assert(after.reduce((n,v)=>n+v,0)<before.reduce((n,v)=>n+v,0),'Scroll should progressively fill the existing words');assert.equal(await page.locator('.about h2').innerText(),original);await page.locator('#about').screenshot({path:'/tmp/beta-scroll-ink.png'});
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('.has-scroll-ink'));assert.equal(await page.locator('.about .scroll-word').first().evaluate(el=>getComputedStyle(el).backgroundImage),'none');
 await page.emulateMedia({media:'print'});assert.notEqual(await page.locator('.about .scroll-word').first().evaluate(el=>getComputedStyle(el).color),'rgba(0, 0, 0, 0)');await page.emulateMedia({media:'screen',reducedMotion:'no-preference'});
 await page.setViewportSize({width:390,height:844});await position('.about h2',.3);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('.about h2').innerText(),original);
 for(const route of ['/en/studio','/cases/forma']){await page.goto(base+route);await page.locator('[data-scroll-ink]').first().waitFor({state:'attached'});assert((await page.locator('[data-scroll-ink]').first().textContent()).trim().length>0)}
 assert.deepEqual(errors,[]);await context.close();
 const quiet=await browser.newContext({reducedMotion:'reduce'}),qp=await quiet.newPage();await qp.goto(base);assert.equal(await qp.locator('.has-scroll-ink').count(),0);assert((await qp.locator('.about h2').textContent()).includes('Tæt på idéen.'));await quiet.close();
 console.log('Scroll-linked word fill, preserved text, runtime/initial reduced motion, readable print, mobile layout and public subpage headings passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
