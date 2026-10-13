import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderPage} from '../pages.mjs';
test('deep links resolve with page-specific metadata and readable HTML',()=>{
 for(const path of ['/cases','/cases/forma','/cases/offscript','/services','/studio','/start']){const page=renderPage(path);assert.equal(page.status,200);assert(page.html.includes('<h1>'));assert(page.html.includes('<meta name="description"'));assert(page.html.includes('/pages.js'));}
 assert.equal(renderPage('/cases/forma/').status,200);
 assert.equal(renderPage('/cases/missing').status,404);
 assert.equal(renderPage('/not-a-site-page'),null);
});
test('client logos lead to truthful case placeholders, not fabricated project details',()=>{
 for(const slug of ['rekom','bat','reformed-cleaning','red-bull','selfmade-records','freshpoint','ild-pizza']){const page=renderPage('/cases/'+slug);assert.equal(page.status,200);assert(page.html.includes('CASE KOMMER SNART'));assert(!page.html.includes('data-case-slug'));}
});
