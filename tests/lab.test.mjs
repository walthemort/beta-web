import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanDirection,completeDirection,directionChoices,cleanLogoTest,contextText} from '../public/lab-data.js';
import {featurePage,decorateHTML} from '../lib/site.mjs';
test('visual directions contain only selected catalog choices, and partial choices are not a result',()=>{
 const partial=cleanDirection({version:1,choices:{energy:'bold',material:'invented',rhythm:{id:'open'}},note:'x'.repeat(900)});assert.deepEqual(partial.choices,{energy:'bold'});assert.equal(partial.note.length,500);assert.equal(completeDirection(partial),false);assert.equal(contextText('direction',partial),'');
 const valid={version:1,choices:{energy:'bold',material:'precise',rhythm:'open'},note:'A sharper expression.'};assert.equal(completeDirection(valid),true);assert.deepEqual(directionChoices(valid).map(c=>c.id),['bold','precise','open']);assert(contextText('direction',valid,'en').includes('Bold / Precise / Spacious'));assert.equal(cleanDirection({version:2,choices:valid.choices}),null);
});
test('logo brief context is bounded metadata and never carries the uploaded file',()=>{
 const value=cleanLogoTest({version:1,name:'logo.svg',kind:'svg',width:240,height:80,transparent:true,note:'Sharper at small sizes.',data:'data:image/svg+xml,secret',file:'private-file'});assert(value);assert.equal('data'in value,false);assert.equal('file'in value,false);assert(contextText('logo',value,'en').includes('Transparent background'));for(const raw of [{...value,width:Infinity},{...value,height:-1},{...value,kind:'html'},{...value,width:100001}])assert.equal(cleanLogoTest(raw),null);
});
test('studio tools have real bilingual public routes and page-specific metadata',()=>{
 for(const path of ['/logo-test','/retning']){const page=featurePage(path);assert.equal(page.status,200);assert(page.html.includes('<h1>'));assert(!page.html.includes('Et uafhængigt kreativt studio.'));const html=decorateHTML(page.html,path,true);assert(html.includes('/lab.js'));assert(html.includes('/lab.css'));assert(html.includes('<html lang="en"'));assert(html.includes(path==='/logo-test'?'Does your logo hold up':'Your taste.'));}
});
