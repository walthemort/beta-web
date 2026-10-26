import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decorateHTML} from '../lib/site.mjs';
import {renderPage} from '../pages.mjs';
import {selectedClients,renderSelectedWork} from '../lib/selected-work.mjs';
const index=readFileSync(new URL('../public/index.html',import.meta.url),'utf8');
test('Review is the first experience and uses a standalone homepage foundation',()=>{
 const html=decorateHTML(index,'/');assert(html.indexOf('id="review"')<html.indexOf('id="work"'));assert(html.includes('/review-home.css'));assert(html.includes('/selected-work.css'));
 for(const css of ['style.css','agency.css','editorial.css','atelier.css','features.css'])assert(!html.includes(`href="/${css}"`),css+' cannot style the new homepage');
 assert.equal((html.match(/data-selected-case=/g)||[]).length,7);assert(!html.includes('data-hero-choice'));assert(!html.includes('data-portfolio'));assert(!html.includes('data-open-reel'));assert(html.includes('EKSEMPEL / BETAS EGET UDTRYK'));
});
test('Selected collaborations are real curated clients, with concepts kept in the studio directory',()=>{
 const html=decorateHTML(renderPage('/cases').html,'/cases');assert.equal((html.match(/data-selected-case=/g)||[]).length,7);
 assert(!html.includes('data-selected-case="forma"'));assert(!html.includes('data-selected-case="offscript"'));assert(html.includes('/studio/arkiv'));assert(html.includes('/cases/forma'));assert(html.includes('CASE PÅ VEJ'));
});
test('Curated clients use only published matching case stories',()=>{
 const clients=[{name:'A < B',case:'/cases/client',logo:'/clients/bat.svg'}];
 const list=selectedClients({clients,cases:[{slug:'client',status:'draft',gallery:[{src:'/media/draft.webp'}]},{slug:'forma',status:'published'}]});assert.equal(list[0].story,undefined);
 const published=selectedClients({clients,cases:[{slug:'client',status:'published',gallery:[{src:'/media/approved.webp',alt:'Approved < work'}]}]});assert.equal(published[0].story.gallery[0].src,'/media/approved.webp');
 const html=renderSelectedWork({clients:published});assert(html.includes('A &lt; B'));assert(html.includes('Approved &lt; work'));assert(!html.includes('/media/draft.webp'));
});
test('Review-first copy and primary navigation remain bilingual',()=>{
 const html=decorateHTML(index,'/',true);assert(html.includes('A fresh perspective.'));assert(html.includes('/en#review'));assert(html.includes('/en/cases/rekom'));assert(html.includes('SEE MY REVIEW'));assert(!html.includes('Dine fundne styles'));
});
