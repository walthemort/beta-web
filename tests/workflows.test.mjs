import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requireOwner,cleanCase} from '../lib/admin.mjs';
import {contrast,enrichReport,reportHTML,reportPDF} from '../lib/report.mjs';
import {extractGuide,publicAddress} from '../review.mjs';
import {collectRendered,startReviewProxy,executable} from '../lib/render-review.mjs';
import {decorateHTML,featurePage} from '../lib/site.mjs';
import {renderPage} from '../pages.mjs';
import {chromium} from 'playwright';
import http from 'node:http';
const fixture={url:'https://example.com',title:'Example',colors:['#FFFFFF','#000000'],fonts:['Studio Sans'],sizes:['16px'],svg:true,logoSvg:true,rating:'A promising foundation',note:'Source fixture'};
test('owner editing verifies identity and database role instead of accepting a chosen UI role',async()=>{
 await assert.rejects(requireOwner({headers:{}},()=>{throw Error('must not contact auth')}),e=>e.status===401);
 const responses=[{id:'verified-user'},[{role:'member'}]];await assert.rejects(requireOwner({headers:{authorization:'Bearer token'}},async()=>({ok:true,json:async()=>responses.shift()})),e=>e.status===403);
 let calls=[];const ownerResponses=[{id:'verified-owner'},[{role:'owner'}]];assert.equal((await requireOwner({headers:{authorization:'Bearer signed-token'}},async(url,options)=>{calls.push({url:String(url),options});return {ok:true,json:async()=>ownerResponses.shift()}})).id,'verified-owner');assert(calls[1].url.includes('user_id=eq.verified-owner'));assert(calls[1].url.includes('studio_id=eq.'));assert.equal(calls[0].options.headers.authorization,'Bearer signed-token');
 await assert.rejects(requireOwner({headers:{authorization:'Bearer expired'}},async()=>({ok:false})),e=>e.status===401)
});
test('case editor validates every rendered structure and excludes arbitrary properties',()=>{
 const c={slug:'studio',name:'Name',headline:'Headline',intro:'Intro',challenge:'Challenge',direction:'Direction',number:'02',category:'brand',categoryLabel:'Brand',palette:['#1B4DFF'],principles:[['01','Title','Text']],services:['Website'],deliverables:[],next:'forma',status:'draft',gallery:[],script:'evil'};assert.equal(cleanCase(c).script,undefined);assert.throws(()=>cleanCase({...c,slug:'\" onmouseover=\"evil'}));assert.throws(()=>cleanCase({...c,principles:[['one']]}));assert.throws(()=>cleanCase({...c,gallery:[{src:'https://elsewhere/track.png',alt:'external'}]}));assert.throws(()=>cleanCase({...c,palette:['red; color:black']}));
});
test('source guide resolves custom property fonts and sizes',()=>{const r=extractGuide('<style>:root{--brand:#1B4DFF;--font:"Studio Sans";--size:18px}body{color:var(--brand);font-family:var(--font);font-size:var(--size)}</style>');assert.deepEqual(r.fonts,['Studio Sans']);assert.deepEqual(r.sizes,['18px']);assert.deepEqual(r.colors,['#1B4DFF'])});
test('contrast findings distinguish a palette calculation from actual text use',()=>{assert.equal(contrast('#FFFFFF','#000000'),21);assert.equal(contrast('#FFFFFF','#FFFFFF'),1);assert.equal(contrast('bad','#FFFFFF'),null);const r=enrichReport({...fixture,colors:['#FFFFFF','#F6F4EF']});assert.equal(r.contrast[0].normalText,false);assert(r.recommendations[0].reason.includes('Vi ved ikke'));assert.equal(r.provenance,'source HTML/CSS')});
test('report escapes user data and produces an actual PDF',async()=>{const html=await reportHTML({...fixture,title:'<script>alert(1)</script>',fonts:['<script>alert(1)</script>'],lang:'en'});assert(!html.includes('<script>alert'));assert(html.includes('YOUR BRAND.'));const pdf=await reportPDF(fixture);assert.equal(pdf.subarray(0,5).toString(),'%PDF-');assert(pdf.length>10000)});
test('computed collection inspects real styles, visible typography and asset evidence',async()=>{
 const browser=await chromium.launch({executablePath:executable(),args:['--no-sandbox']});try{const page=await browser.newPage();await page.setContent('<style>:root{--brand:#1B4DFF}p{color:var(--brand);font-family:Arial;font-size:23px}.hidden{display:none;color:#FF0000}</style><p>Brand type</p><div class="hidden">Hidden</div><svg width="20" height="20"></svg>');const r=await collectRendered(page);assert(r.colors.includes('#1B4DFF'));assert(!r.colors.includes('#FF0000'));assert(r.fonts.includes('Arial'));assert(r.sizes.includes('23px'));assert.equal(r.svg,true);assert.equal(r.logoSvg,false)}finally{await browser.close()}
});
test('rendering proxy blocks loopback HTTP and CONNECT requests at the network boundary',async()=>{
 const proxy=await startReviewProxy();try{const base=new URL(proxy.url);const get=(method,path)=>new Promise((resolve,reject)=>{const req=http.request({hostname:base.hostname,port:base.port,method,path},res=>{res.resume();resolve(res.statusCode)});req.on('connect',(res,socket)=>{socket.destroy();resolve(res.statusCode)});req.on('error',reject);req.end()});assert.equal(await get('GET','http://127.0.0.1/secret'),403);assert.equal(await get('CONNECT','127.0.0.1:443'),403)}finally{await proxy.close()}
});
test('global IPv6 is permitted while loopback, local and tunnel addresses stay blocked',()=>{assert.equal(publicAddress('2606:4700:4700::1111'),true);for(const ip of ['::1','fc00::1','fe80::1','2001:db8::1','2002:7f00:1::1'])assert.equal(publicAddress(ip),false)});
test('language switch preserves route and translates server-rendered copy',()=>{const html=decorateHTML(renderPage('/start').html,'/start',true);assert(html.includes('<html lang="en"'));assert(html.includes('A good start.'));assert(html.includes('class="language-toggle" href="/start"'));assert(html.includes('href="/en/cases"'));assert(featurePage('/admin').html.includes('id="admin-root"'))});
