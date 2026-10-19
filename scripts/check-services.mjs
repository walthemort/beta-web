import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {executable} from '../lib/render-review.mjs';
process.env.NODE_ENV='test';const {server}=await import('../server.js');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:executable(),args:['--no-sandbox','--disable-dev-shm-usage']});
async function settle(page){await page.locator('#services').evaluate(async root=>{await Promise.allSettled(root.getAnimations({subtree:true}).map(a=>a.finished))})}
try{
 const context=await browser.newContext({viewport:{width:1440,height:1080}});await context.addInitScript(()=>localStorage.setItem('beta:analytics-consent','false'));
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/');await page.locator('#services').scrollIntoViewIfNeeded();await settle(page);
 const rows=page.locator('#services .service'),toggle=i=>rows.nth(i).locator('.service-toggle'),panel=i=>rows.nth(i).locator('.service-body'),select=i=>rows.nth(i).locator('.service-add');
 await page.locator('#services').screenshot({path:'/tmp/beta-services-closed.png'});
 await toggle(0).click();
 const opening=await panel(0).evaluate(el=>{const a=el.getAnimations().find(a=>a.effect.getKeyframes().some(k=>k.height));if(!a)return null;a.pause();a.currentTime=160;const frame={height:el.getBoundingClientRect().height,total:el.firstElementChild.getBoundingClientRect().height,duration:a.effect.getTiming().duration};a.play();return frame});
 assert(opening&&opening.height>0&&opening.height<opening.total,'Opening must expand through intermediate heights');assert(opening.duration>=400);
 await settle(page);assert.equal(await toggle(0).getAttribute('aria-expanded'),'true');assert.equal(await panel(0).evaluate(el=>el.inert),false);
 await page.locator('#services').screenshot({path:'/tmp/beta-services-open.png'});
 // Switching stories and reversing a close must settle to the latest intent.
 await toggle(1).click();await settle(page);assert.equal(await panel(0).isVisible(),false);assert.equal(await panel(1).isVisible(),true);
 await toggle(1).evaluate(el=>{el.click();el.click();el.click();el.click()});await settle(page);assert.equal(await toggle(1).getAttribute('aria-expanded'),'true');assert.equal(await panel(1).isVisible(),true);assert.equal(await panel(1).evaluate(el=>el.style.height),'');
 await page.waitForFunction(()=>document.querySelector('#service-study-number').textContent==='02',{},{timeout:5000}).catch(async error=>{console.log(await page.evaluate(()=>({number:document.querySelector('#service-study-number').textContent,open:[...document.querySelectorAll('.service.is-open')].map(el=>el.dataset.service),images:[...document.querySelectorAll('.service-study-frame img')].map(img=>({src:img.src,complete:img.complete,width:img.naturalWidth}))})));throw error});
 // Selections never toggle the story; chips retain focus and feed the existing planner.
 await select(0).click();await select(2).click();await settle(page);assert.equal(await toggle(1).getAttribute('aria-expanded'),'true');assert.equal(await select(0).getAttribute('aria-pressed'),'true');assert.equal(await page.locator('[data-service-chip]').count(),2);
 await page.locator('#services').screenshot({path:'/tmp/beta-services-selected.png'});
 await page.locator('[data-remove="Brandidentitet"]').focus();await page.keyboard.press('Enter');assert.equal(await select(0).evaluate(el=>el===document.activeElement),true);assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('beta:services'))),['Content & kampagner']);
 await page.reload();assert.equal(await select(2).getAttribute('aria-pressed'),'true');await page.locator('#brief-open').click();await page.waitForURL('**/start');assert.equal(await page.locator('[data-planner-service="Content & kampagner"]').getAttribute('aria-pressed'),'true');
 for(const width of [360,390,768,1024,1440]){
  await page.setViewportSize({width,height:1080});await page.goto(base+'/');await toggle(2).click();await settle(page);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Overflow at '+width);
  assert.equal(await panel(2).evaluate(el=>el.getBoundingClientRect().height>=el.firstElementChild.getBoundingClientRect().height-1),true);
  for(const row of await rows.evaluateAll(rows=>rows.map(el=>{const title=el.querySelector('b').getBoundingClientRect(),icon=el.querySelector('.toggle-icon').getBoundingClientRect(),add=el.querySelector('.service-add').getBoundingClientRect();return{title:title.right,icon:icon.left,end:icon.right,add:add.left}}))){assert(row.title<=row.icon-7,'Title crowds expand control at '+width);assert(row.end<row.add)}
  if(width===390)await page.locator('#services').screenshot({path:'/tmp/beta-services-mobile.png'});
 }
 // Resize mid-opening, then change motion preference mid-closing.
 await toggle(0).click();await page.setViewportSize({width:390,height:900});await settle(page);assert.equal(await panel(0).evaluate(el=>el.getBoundingClientRect().height>=el.firstElementChild.getBoundingClientRect().height-1),true);
 await toggle(0).click();await page.emulateMedia({reducedMotion:'reduce'});await panel(0).waitFor({state:'hidden',timeout:1000});assert.equal(await panel(0).isVisible(),false);
 await toggle(3).focus();await page.keyboard.press('Enter');assert.equal(await panel(3).isVisible(),true);assert.equal(await panel(3).evaluate(el=>el.getAnimations().length),0);
 await page.goto(base+'/en');await select(1).click();assert.equal((await select(1).textContent()).trim(),'SELECTED');assert.equal(await page.locator('#selection-list').textContent().then(s=>s.includes('Digital experiences')),true);await page.locator('#brief-open').click();await page.waitForURL('**/en/start');
 assert.deepEqual(errors,[]);await context.close();
 const blocked=await browser.newContext({reducedMotion:'reduce'});await blocked.addInitScript(()=>{localStorage.setItem('beta:analytics-consent','false');Storage.prototype.setItem=()=>{throw Error('denied')}});const bp=await blocked.newPage();await bp.goto(base+'/');await bp.locator('.service-add').first().click();assert((await bp.locator('#service-selection-status').textContent()).includes('kunne ikke gemmes'));await blocked.close();
 console.log('Service animation reversal, single-open stories, study switching, selection persistence/planner continuity, keyboard focus, DA/EN, five responsive widths, live reduced motion, resizing and blocked storage passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
