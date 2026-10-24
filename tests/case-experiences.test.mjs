import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderPage} from '../pages.mjs';
import {decorateHTML} from '../lib/site.mjs';
import {hasCaseEdition,renderCaseFormats,renderCaseProcess,renderCaseDetails} from '../lib/case-experiences.mjs';
const concepts=JSON.parse(readFileSync(new URL('../content/cases.json',import.meta.url)));
test('concept editions expose every format in HTML and keep individual presentation',()=>{
 for(const concept of concepts){const html=renderPage('/cases/'+concept.slug).html;assert(html.includes('case-edition-'+concept.slug));assert.equal((html.match(/data-format-panel=/g)||[]).length,3);assert(html.includes('data-detail-explorer'));assert(html.includes('Tanken bag.'));assert(html.includes('KONCEPTVISUALISERINGER'));assert(!html.includes('<video'));}
 assert(renderPage('/cases/offscript').html.includes('OFF<wbr>SCRIPT'));
});
test('invented format studies never attach to published or unknown client projects',()=>{
 for(const c of [{...concepts[0],status:'published'},{...concepts[0],slug:'client-project'}]){assert.equal(hasCaseEdition(c),false);for(const render of [renderCaseFormats,renderCaseProcess,renderCaseDetails])assert.equal(render(c),'');}
 assert(!renderPage('/cases/rekom').html.includes('data-case-experience'));
});
test('case studies escape editable names and support missing gallery metadata',()=>{
 const c={...concepts[0],name:'<img src=x onerror=alert(1)>',gallery:[]};
 for(const render of [renderCaseFormats,renderCaseProcess,renderCaseDetails]){const html=render(c);assert(!html.includes(c.name));assert(html.includes('&lt;img'));}
});
test('the archive is readable, bilingual and delivered with route-specific assets',()=>{
 const html=decorateHTML(renderPage('/studio/arkiv').html,'/studio/arkiv',true);
 assert(html.includes('Always curious.'));assert.equal((html.match(/data-archive-kind=/g)||[]).length,6);assert(html.includes('/en/cases/forma#play'));assert(html.includes('/case-experiences.js'));assert(html.includes('/reel.js'));
 const client=decorateHTML(renderPage('/cases/rekom').html,'/cases/rekom');assert(!client.includes('/case-experiences.js'));
});
