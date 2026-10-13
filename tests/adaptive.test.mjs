import {test} from 'node:test';
import assert from 'node:assert/strict';
import {briefQuestions} from '../lib/brief.mjs';
import {validateQuestions,activeQuestions,cleanAnswers,answeredQuestions} from '../public/brief-schema.js';
import {collectViews,executable} from '../lib/render-review.mjs';
import {enrichReport,validateReport,reportHTML} from '../lib/report.mjs';
import {chromium} from 'playwright';

test('service-specific answers persist but exports include only relevant answers',()=>{
 const questions=briefQuestions(),raw={audience:'Founders',brand_character:'Calm',website_action:'booking',unknown:'Discard'},answers=cleanAnswers(questions,raw);
 assert(!('unknown' in answers));assert(activeQuestions(questions,['Website']).some(q=>q.id==='website_action'));assert(!activeQuestions(questions,['Website']).some(q=>q.id==='brand_character'));
 assert.equal(answers.brand_character,'Calm');const rows=answeredQuestions(questions,['Website'],answers,'en');assert(rows.some(r=>r.answer==='Bookings or signups'));assert(!rows.some(r=>r.answer==='Calm'));
 assert.throws(()=>validateQuestions([...questions,questions[0]]));assert.throws(()=>validateQuestions([{...questions[0],services:['random']}]))
 assert(!('website_action' in cleanAnswers(questions,{website_action:'invalid'})));assert.equal(cleanAnswers(questions,{brand_character:'x'.repeat(3000)}).brand_character.length,300);
});
test('mobile and desktop are separately rendered with responsive styles and isolated sessions',async()=>{
 const browser=await chromium.launch({executablePath:executable(),args:['--no-sandbox','--disable-dev-shm-usage']});
 try{const contexts=[];const result=await collectViews(browser,'https://example.test',async context=>{assert.equal((await context.cookies()).length,0);contexts.push(context);await context.addCookies([{name:'fixture',value:String(contexts.length),domain:'example.test',path:'/'}]);await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><style>p{color:#1B4DFF;font-size:32px}@media(max-width:600px){p{color:#FF3322;font-size:18px}}</style><p>Responsive brand</p><svg width="20" height="20"></svg>'}))});assert.equal(contexts.length,2);assert.notEqual(contexts[0],contexts[1]);assert(result.views.desktop.colors.includes('#1B4DFF'));assert(!result.views.desktop.colors.includes('#FF3322'));assert(result.views.mobile.colors.includes('#FF3322'));assert(result.views.desktop.sizes.includes('32px'));assert(result.views.mobile.sizes.includes('18px'));assert.equal(result.views.mobile.viewport.width,390);assert.match(result.views.mobile.screenshot,/^data:image\/jpeg;base64,/);const report=enrichReport(result);assert.equal(report.views.mobile.provenance,'rendered mobile');}
 finally{await browser.close()}
});
test('an unavailable viewport stays explicit and nested reports stay bounded',async()=>{
 const input={url:'https://example.test',colors:['#1B4DFF'],fonts:['Arial'],sizes:['32px'],rendered:true,views:{desktop:{colors:['#1B4DFF'],fonts:['Arial'],sizes:['32px'],rendered:true,views:{mobile:{}}},mobile:{unavailable:true,screenshot:'untrusted'}}};
 const report=validateReport(input);assert.equal(report.views.mobile.unavailable,true);assert(!report.views.desktop.views);assert(!report.views.mobile.screenshot);const html=await reportHTML(input);assert(html.includes('Visningen kunne ikke renderes.'));assert(html.includes('DESKTOP / 1280'));assert(html.includes('MOBILE / 390'));
});
