import {validateQuestions} from '../public/brief-schema.js';
import {fetch,EnvHttpProxyAgent} from 'undici';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {authConfig,readJSON,writeJSON,validateBusiness,readBody,root} from './store.mjs';
const dispatcher=new EnvHttpProxyAgent();
export async function requireOwner(req,request=fetch){
 const token=req.headers.authorization;if(!token||!/^Bearer [A-Za-z0-9._-]+$/.test(token)){const e=Error('Sign in as the studio owner');e.status=401;throw e}
 const config=authConfig();if(!config.url||!config.key||!config.studio){const e=Error('Workspace is not configured');e.status=503;throw e}
 const base=new URL(config.url);if(base.protocol!=='https:')throw Error('Invalid auth configuration');
 const headers={apikey:config.key,authorization:token};
 const response=await request(new URL('/auth/v1/user',base),{headers,dispatcher,signal:AbortSignal.timeout(8000)});
 if(!response.ok){const e=Error('Session expired');e.status=401;throw e}const user=await response.json();if(!user.id){const e=Error('Invalid session');e.status=401;throw e}
 const url=new URL('/rest/v1/studio_members',base);url.search=new URLSearchParams({studio_id:`eq.${config.studio}`,user_id:`eq.${user.id}`,select:'role'}).toString();
 const membership=await request(url,{headers,dispatcher,signal:AbortSignal.timeout(8000)});if(!membership.ok){const e=Error('Unable to check access');e.status=403;throw e}const rows=await membership.json();if(!rows.some(r=>r.role==='owner')){const e=Error('Studio owner access required');e.status=403;throw e}return user;
}
export function cleanCase(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('Invalid case');
 const text=(key,max=4000)=>{if(typeof input[key]!=='string'||!input[key].trim()||input[key].length>max)throw Error('Invalid case '+key);return input[key]};
 const slug=text('slug',60);if(!/^[a-z0-9-]{1,60}$/.test(slug))throw Error('Invalid slug');
 const list=(key,max=20)=>{if(!Array.isArray(input[key])||input[key].length>max||input[key].some(v=>typeof v!=='string'||v.length>200))throw Error('Invalid '+key);return input[key]};
 const palette=list('palette',6);if(palette.some(c=>!/^#[\da-f]{6}$/i.test(c)))throw Error('Invalid palette');
 const gallery=input.gallery||[];if(!Array.isArray(gallery)||gallery.length>20||gallery.some(im=>!im||!/^\/media\/[a-zA-Z0-9_.-]+\.(png|jpg|webp)$/.test(im.src)||typeof im.alt!=='string'||im.alt.length>300))throw Error('Invalid gallery');
 if(!Array.isArray(input.principles)||input.principles.length>6||input.principles.some(p=>!Array.isArray(p)||p.length!==3||p.some(v=>typeof v!=='string'||v.length>1000)))throw Error('Invalid principles');
 if(!['brand','digital'].includes(input.category))throw Error('Invalid category');
 const status=['published','placeholder','draft'].includes(input.status)?input.status:'placeholder';
 return {slug,name:text('name',150),headline:text('headline',200),intro:text('intro'),challenge:text('challenge'),direction:text('direction'),number:/^\d{1,3}$/.test(input.number)?input.number:'01',category:input.category,categoryLabel:text('categoryLabel',150),type:status==='published'?'Kundecase':'Konceptprojekt',status,palette,gallery,principles:input.principles,services:list('services'),deliverables:list('deliverables'),next:/^[a-z0-9-]{1,60}$/.test(input.next)?input.next:slug};
}
export async function adminAPI(req,pathname){await requireOwner(req);if(req.method==='GET'){return {cases:readJSON('content/cases.json',[]),questions:readJSON('content/brief-questions.json',[]),services:readJSON('content/services.json',[]),clients:readJSON('public/clients.json',[]),business:readJSON('content/business.json',{}),analytics:readJSON('data/analytics.json',{})}}if(req.method==='PUT'&&pathname==='/api/admin/questions'){const data=validateQuestions(JSON.parse((await readBody(req)).toString()));await writeJSON('content/brief-questions.json',data);return {saved:true}}if(req.method==='PUT'&&pathname==='/api/admin/business'){const data=validateBusiness(JSON.parse((await readBody(req)).toString()));await writeJSON('content/business.json',data);return {saved:true}}if(req.method==='PUT'&&pathname==='/api/admin/services'){const data=JSON.parse((await readBody(req)).toString());if(!Array.isArray(data)||data.length!==4)throw Error('Keep the four service IDs');const ids=['Brandidentitet','Website','Content & kampagner','Løbende samarbejde'];for(const [i,s] of data.entries()){if(s.id!==ids[i]||!/^0[1-4]$/.test(s.number)||!/^BETA_[A-Z]+$/.test(s.title)||typeof s.summary!=='string'||s.summary.length>500||typeof s.note!=='string'||s.note.length>2000||!Array.isArray(s.tags)||s.tags.length>10||s.tags.some(t=>typeof t!=='string'||t.length>100))throw Error('Invalid service')}await writeJSON('content/services.json',data);return {saved:true}}if(req.method==='PUT'&&pathname==='/api/admin/cases'){const data=JSON.parse((await readBody(req)).toString());if(!Array.isArray(data)||data.length>100)throw Error('Invalid case collection');const cases=data.map(cleanCase);if(new Set(cases.map(c=>c.slug)).size!==cases.length)throw Error('Duplicate slug');await writeJSON('content/cases.json',cases);return {saved:true}}if(req.method==='POST'&&pathname==='/api/admin/media'){
 const body=await readBody(req,6_000_000);const request=new Request('http://beta.local/upload',{method:'POST',headers:req.headers,body});const form=await request.formData(),file=form.get('file');if(!file||typeof file.arrayBuffer!=='function'||file.size>5_000_000)throw Error('Choose an image below 5 MB');const buffer=Buffer.from(await file.arrayBuffer());let extension;if(buffer.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))extension='png';else if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255)extension='jpg';else if(buffer.subarray(0,4).toString()==='RIFF'&&buffer.subarray(8,12).toString()==='WEBP')extension='webp';else throw Error('PNG, JPEG and WebP images only');const name=randomUUID()+'.'+extension;await mkdir(resolve(root,'public/media'),{recursive:true});await writeFile(resolve(root,'public/media',name),buffer);return {src:'/media/'+name,name:file.name};
 }const e=Error('Unknown admin operation');e.status=404;throw e}
