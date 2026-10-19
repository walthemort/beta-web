import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {executable} from '../lib/render-review.mjs';
process.env.NODE_ENV='test';const {server}=await import('../server.js');await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:executable(),args:['--no-sandbox','--disable-dev-shm-usage']});
async function settle(page,selector){await page.locator(selector).evaluate(async el=>{await Promise.allSettled(el.getAnimations({subtree:true}).map(a=>a.finished))})}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1050},reducedMotion:'reduce'});await context.addInitScript(()=>localStorage.setItem('beta:analytics-consent','false'));
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const dialog=page.locator('#project-preview'),cards=page.locator('.project-card'),more=page.locator('.project-more');
 await page.goto(base+'/');assert.equal(await cards.count(),9);assert.equal(await page.locator('.project-more').isVisible(),true);assert.equal(await cards.locator('a[href^="/cases/"]').count(),9);assert.equal(await page.locator('.project-card:visible').count(),6);
 assert.equal(await page.locator('[data-project="forma"] .project-kind').textContent(),'KONCEPTSTUDIE');assert.equal(await page.locator('[data-project="rekom"] .project-kind').textContent(),'CASE PÅ VEJ');
 await page.locator('#work').scrollIntoViewIfNeeded();await page.evaluate(()=>document.fonts.ready);await page.locator('#work').screenshot({path:'/tmp/beta-project-chapter-desktop.png'});
 await more.click();assert.equal(await page.locator('.project-card:visible').count(),9);assert.equal(await more.getAttribute('aria-expanded'),'true');
 await page.locator('[data-project-preview="forma"]').click();assert.equal(await dialog.getAttribute('open'),'');assert.equal(await dialog.locator('h2').textContent(),'FORMA');assert.equal(await dialog.locator('h2').evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('ArrowRight');assert.equal(await dialog.locator('h2').textContent(),'OFFSCRIPT');assert.equal(await dialog.locator('h2').evaluate(el=>el===document.activeElement),true);
 await page.keyboard.press('ArrowRight');assert.equal(await dialog.locator('h2').textContent(),'Rekom');assert.equal(await dialog.locator('.project-dialog-art>img').count(),0);assert((await dialog.locator('p').textContent()).includes('Godkendt projektmateriale'));assert.equal(await dialog.locator('.project-story-link').getAttribute('href'),'/cases/rekom');
 await page.screenshot({path:'/tmp/beta-project-client-preview.png'});await page.keyboard.press('Escape');assert.equal(await dialog.getAttribute('open'),null);assert.equal(await page.locator('[data-project-preview="forma"]').evaluate(el=>el===document.activeElement),true);assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 await more.click();assert.equal(await page.locator('.project-card:visible').count(),6);
 await page.goto(base+'/cases');assert.equal(await cards.count(),9);await page.locator('[data-project-filter="client"]').click();await page.waitForFunction(()=>[...document.querySelectorAll('.project-card')].filter(c=>!c.hidden).length===7);
 await page.locator('[data-project-filter="brand"]').click();await page.waitForFunction(()=>[...document.querySelectorAll('.project-card')].filter(c=>!c.hidden).length===1);assert.equal(await page.locator('.project-card:visible').getAttribute('data-project'),'forma');
 await page.locator('[data-project-filter="saved"]').click();await page.locator('#project-empty').waitFor({state:'visible'});await page.locator('[data-project-reset]').click();await page.locator('[data-studio-save="forma"]').click();await page.locator('[data-project-filter="saved"]').click();await page.waitForFunction(()=>[...document.querySelectorAll('.project-card')].filter(c=>!c.hidden).length===1);await page.locator('[data-studio-save="forma"]').click();await page.locator('#project-empty').waitFor({state:'visible'});
 for(const width of [360,390,768,1024,1440])for(const prefix of ['','/en']){
  await page.setViewportSize({width,height:1000});await page.goto(base+prefix+'/');await more.click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Home overflow at '+width+prefix);
  await page.locator('[data-project-preview="reformed-cleaning"]').click();assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth),true);assert.equal(await dialog.locator('.project-story-link').getAttribute('href'),prefix+'/cases/reformed-cleaning');await page.keyboard.press('Escape');
  if(width===390&&!prefix)await page.locator('#work').screenshot({path:'/tmp/beta-project-chapter-mobile.png'});
  await page.goto(base+prefix+'/cases');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Archive overflow at '+width+prefix);
 }
 await page.emulateMedia({reducedMotion:'no-preference'});await page.setViewportSize({width:1440,height:1050});await page.goto(base+'/');await more.click();await more.evaluate(el=>{el.click();el.click()});await settle(page,'#project-extra');assert.equal(await page.locator('#project-extra').isVisible(),true);assert.equal(await page.locator('#project-extra').evaluate(el=>el.style.height),'');
 await page.locator('[data-project-preview="forma"]').click();const wipe=await dialog.evaluate(el=>{const a=el.getAnimations().find(a=>a.effect.getKeyframes().some(k=>k.clipPath));if(!a)return null;a.pause();a.currentTime=220;const clip=getComputedStyle(el).clipPath;a.play();return clip});assert(wipe&&wipe!=='none'&&wipe!=='inset(0px round 18px)','Preview must expand from the selected card');await settle(page,'#project-preview');await page.screenshot({path:'/tmp/beta-project-preview-desktop.png'});await page.locator('[data-project-close]').click();await dialog.waitFor({state:'hidden'});
 await page.locator('[data-project-preview="offscript"]').click();await page.locator('[data-project-close]').click();await page.emulateMedia({reducedMotion:'reduce'});await dialog.waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
 assert.deepEqual(errors,[]);await context.close();
 const plain=await browser.newContext({javaScriptEnabled:false}),pp=await plain.newPage();await pp.goto(base+'/cases');assert.equal(await pp.locator('.project-link').count(),9);await pp.locator('[data-project-preview="rekom"]').click();await pp.waitForURL('**/cases/rekom');assert.equal(await pp.locator('.case-gallery').count(),0);await plain.close();
 console.log('Compact 9-project collection, expansion reversal, animated native previews, keyboard/focus return, honest client placeholders, filters/saved choices, bilingual/mobile layouts and direct no-JS links passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
