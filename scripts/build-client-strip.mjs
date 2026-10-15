import {readFile,writeFile,access} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const clients=JSON.parse(await readFile(resolve(root,'public/clients.json'),'utf8'));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const entries=await Promise.all(clients.map(async client=>{
 if(client.logo&&!/^\/clients\/[a-zA-Z0-9_.-]+\.(svg|png|webp|jpg)$/i.test(client.logo))throw Error('Invalid client logo path');
 const source=client.logo||null;if(source)await access(resolve(root,'public'+source));
 const href=/^\/cases\/[a-z0-9-]+$/.test(client.case||'')?client.case:'/cases';
 return `<a class="client-logo${source?'':' client-name'}" href="${escape(href)}" aria-label="Se ${escape(client.name)} case">${source?`<img src="${escape(source)}" alt="${escape(client.name)}" width="130" height="42" decoding="async">`:escape(client.name)}</a>`;
}));
const html=await readFile(resolve(root,'public/index.html'),'utf8');
const replacement=`<section class="client-strip" id="client-strip" aria-label="Et udvalg af vores kunder"><div class="client-marquee"><div class="client-track" id="client-track"><div class="client-group">${entries.join('')}</div></div></div></section>`;
const updated=html.replace(/<section class="client-strip"[\s\S]*?<\/section>/,replacement);
if(updated===html&&!html.includes(replacement))throw Error('Client strip section not found');
await writeFile(resolve(root,'public/index.html'),updated);
console.log(`${entries.length} client marks rendered into the homepage; cacheable image paths, with no runtime manifest request.`);
