import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanDirection,completeDirection,directionChoices,directionText} from '../public/lab-data.js';
import {featurePage,decorateHTML} from '../lib/site.mjs';
test('visual directions contain only selected catalog choices, and partial choices are not a result',()=>{
 const partial=cleanDirection({version:1,choices:{energy:'bold',material:'invented',rhythm:{id:'open'}},note:'x'.repeat(900)});assert.deepEqual(partial.choices,{energy:'bold'});assert.equal(partial.note.length,500);assert.equal(completeDirection(partial),false);assert.equal(directionText(partial),'');
 const valid={version:1,choices:{energy:'bold',material:'precise',rhythm:'open'},note:'A sharper expression.'};assert.equal(completeDirection(valid),true);assert.deepEqual(directionChoices(valid).map(c=>c.id),['bold','precise','open']);assert(directionText(valid,'en').includes('Bold / Precise / Spacious'));assert.equal(cleanDirection({version:2,choices:valid.choices}),null);
});
test('visual direction retains its bilingual route and the logo tester is removed',()=>{
 assert.equal(featurePage('/logo-test'),null);for(const path of ['/retning']){const page=featurePage(path);assert.equal(page.status,200);assert(page.html.includes('<h1>'));assert(!page.html.includes('Et uafhængigt kreativt studio.'));const html=decorateHTML(page.html,path,true);assert(html.includes('/lab.js'));assert(html.includes('/lab.css'));assert(html.includes('<html lang="en"'));assert(html.includes('Your taste.'));}
});
