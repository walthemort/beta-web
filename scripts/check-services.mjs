import assert from 'node:assert/strict';import {chromium} from 'playwright';import {executable} from '../lib/render-review.mjs';
process.env.NODE_ENV='test';const {server}=await import('../server.js');await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:executable(),args:['--no-sandbox','--disable-dev-shm-usage']});
try{
 const context=await browser.newContext({reducedMotion:'reduce'});await context.addInitScript(()=>localStorage.setItem('beta:analytics-consent','false'));const page=await context.newPage(),names=['Brandidentitet','Website','Content & kampagner','Løbende samarbejde'];
 for(const prefix of ['','/en'])for(const width of [390,768,1440])for(let i=0;i<4;i++){
  await page.setViewportSize({width,height:1000});await page.goto(base+prefix+'/');await page.evaluate(()=>{localStorage.removeItem('beta:services');localStorage.removeItem('beta:project-draft')});await page.locator('.studio-services>a').nth(i).click();await page.waitForURL('**/start?service=*');await page.waitForFunction(()=>document.querySelector('[data-planner-service][aria-pressed=true]'));
  assert.equal(await page.locator(`[data-planner-service="${names[i]}"]`).getAttribute('aria-pressed'),'true');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 }
 await page.goto(base+'/services');await page.locator('[data-process="0"]').focus();await page.keyboard.press('End');assert.equal(await page.locator('[data-process="3"]').getAttribute('aria-selected'),'true');await context.close();
 console.log('All four homepage service links preselect the correct brief in two languages and three widths; the complete service/process page remains available.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
