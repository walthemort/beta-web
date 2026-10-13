import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {executable} from '../lib/render-review.mjs';
process.env.NODE_ENV='test';const {server}=await import('../server.js');
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:executable(),args:['--no-sandbox','--disable-dev-shm-usage','--enable-unsafe-swiftshader']});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[],requests=[];
 await context.addInitScript(()=>localStorage.setItem('beta:analytics-consent','false'));
 page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text())});page.on('request',request=>requests.push(request.url()));
 await page.goto(base+'/');await page.evaluate(()=>document.fonts.ready);await page.locator('.mark-ready canvas').waitFor({state:'attached',timeout:15000});await page.waitForTimeout(800);
 assert.equal(await page.locator('[data-mark-source]').getAttribute('data-mark-source'),'/logos/b-blue.svg');assert(requests.some(url=>url.endsWith('/logos/b-blue.svg')));assert(!requests.some(url=>url.endsWith('/beta-sculpture.webp')));
 assert.equal(await page.locator('.mark-canvas').evaluate(canvas=>{const gl=canvas.getContext('webgl2');return !!gl&&!gl.isContextLost()}),true);assert.equal(await page.locator('.mark-fallback').evaluate(el=>Number(getComputedStyle(el).opacity)),0);
 const navStyle=await page.locator('.desktop-nav a').first().evaluate(el=>({family:getComputedStyle(el).fontFamily,size:parseFloat(getComputedStyle(el).fontSize)}));assert(navStyle.family.includes('Inter Variable'));assert(navStyle.size>=14);
 await page.screenshot({path:'/tmp/beta-correct-mark-desktop.png'});
 await page.locator('#work').scrollIntoViewIfNeeded();const card=page.locator('.home-case').first();await card.locator('a.case').hover();await page.waitForTimeout(500);assert.equal(await card.locator('.case-preview-secondary').evaluate(el=>Number(getComputedStyle(el).opacity)),1);
 await card.locator('[data-studio-save]').click();assert.equal(await card.locator('[data-studio-save]').getAttribute('aria-pressed'),'true');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('beta:inspiration')).includes('forma')),true);
 await page.goto(base+'/inspiration');await page.getByRole('heading',{name:'FORMA',exact:false}).waitFor();await page.goto(base+'/start');await page.locator('#planner-inspiration').waitFor({state:'visible'});assert((await page.locator('#planner-inspiration').textContent()).includes('FORMA'));
 await page.setViewportSize({width:390,height:844});await page.goto(base+'/');await page.locator('.mark-ready canvas').waitFor({state:'attached'});await page.waitForTimeout(800);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'/tmp/beta-correct-mark-mobile.png'});
 await page.locator('#menu-open').click();assert.equal(await page.locator('#menu').getAttribute('open'),'');assert.deepEqual(await page.locator('#menu nav a').allTextContents(),['01Hjem','02Arbejde','03Services','04Studio','05Kundeportal']);assert.equal(await page.locator('#menu').evaluate(el=>el.scrollWidth<=el.clientWidth),true);await page.waitForTimeout(700);await page.screenshot({path:'/tmp/beta-clean-menu-mobile.png'});await page.keyboard.press('Escape');await page.waitForTimeout(300);assert.equal(await page.locator('#menu').getAttribute('open'),null);
 await page.locator('.mark-canvas').evaluate(canvas=>canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());await page.locator('.mark-canvas').waitFor({state:'detached'});await page.waitForTimeout(600);assert.equal(await page.locator('.mark-fallback').evaluate(el=>Number(getComputedStyle(el).opacity)),.96);
 assert.deepEqual(errors,[]);await context.close();
 const quiet=await browser.newContext({reducedMotion:'reduce',viewport:{width:390,height:844}}),quietPage=await quiet.newPage(),quietRequests=[];quietPage.on('request',request=>quietRequests.push(request.url()));await quietPage.goto(base+'/');await quietPage.waitForTimeout(1800);assert.equal(await quietPage.locator('.mark-canvas').count(),0);assert(!quietRequests.some(url=>url.endsWith('/mark-scene.js')));assert((await quietPage.locator('.mark-fallback').evaluate(el=>getComputedStyle(el).maskImage)).includes('b-white.svg'));await quiet.close();
 const staticContext=await browser.newContext({javaScriptEnabled:false}),staticPage=await staticContext.newPage();await staticPage.goto(base+'/');assert.equal(await staticPage.locator('.mark-fallback').isVisible(),true);assert.equal(await staticPage.locator('a.case').count(),2);await staticContext.close();
 console.log('Actual SVG-backed 3D mark, context-loss and motion/static fallbacks, local font, responsive menu, case previews and inspiration-to-brief flow passed.');
}finally{await browser.close();server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
