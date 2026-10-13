import http from 'node:http';
import https from 'node:https';
import {lookup} from 'node:dns';
import {isIP} from 'node:net';
export function publicAddress(address){
 if(isIP(address)===6)return /^2[0-9a-f]{3}:/i.test(address)&&!/^2002:|^2001:(?:0:|db8:|1[0-9a-f]:|2[0-9a-f]:)/i.test(address);
 if(isIP(address)!==4)return false;
 return !/^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.|192\.88\.99\.|198\.(18|19)\.|22[4-9]\.|2[3-5]\d\.)/.test(address);
}
export function checkedURL(input){
 if(typeof input!=='string'||!input.trim()||input.length>2048)throw Error('Invalid website URL');
 const value=input.trim(),url=new URL(value.includes('://')?value:`https://${value}`);
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.port)throw Error('Please enter a public website URL without credentials or a port.');
 const host=url.hostname.replace(/^\[|\]$/g,'');
 if((isIP(host)&&!publicAddress(host))||host==='localhost'||host.endsWith('.localhost')||host.endsWith('.local'))throw Error('This tool can only review public websites.');
 url.hash='';return url;
}
function safeLookup(hostname,options,callback){
 lookup(hostname,{all:true},(error,addresses)=>{
  if(error)return callback(error);
  if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))return callback(Error('This tool can only review public websites.'));
  addresses.sort((a,b)=>a.family-b.family);
  if(options.all)return callback(null,addresses);
  callback(null,addresses[0].address,addresses[0].family);
 });
}
function get(url,limit,timeout){return new Promise((resolve,reject)=>{
 const request=(url.protocol==='https:'?https:http).get(url,{lookup:safeLookup,headers:{'User-Agent':'BetaReview/1.0','Accept':'text/html,text/css','Accept-Encoding':'identity'}},response=>{
  const chunks=[];let size=0;
  response.on('data',chunk=>{size+=chunk.length;if(size>limit){response.destroy(Error('Website response too large'));return}chunks.push(chunk)});
  response.on('end',()=>resolve({status:response.statusCode,headers:response.headers,body:Buffer.concat(chunks).toString('utf8'),url}));
  response.on('error',reject);
 });
 const timer=setTimeout(()=>request.destroy(Error('Website did not answer in time')),timeout);request.on('error',reject);request.on('close',()=>clearTimeout(timer));
})}
async function fetchPage(start,limit,deadline){let url=start;
 for(let i=0;i<5;i++){
  const remaining=deadline-Date.now();if(remaining<=0)throw Error('Website did not answer in time');
  const result=await get(url,limit,Math.min(9000,remaining));
  if(result.status>=300&&result.status<400&&result.headers.location){url=checkedURL(new URL(result.headers.location,url).href);continue}
  if(result.status<200||result.status>=300)throw Error('The website could not be read. It may block automated reviews.');
  return result;
 }
 throw Error('Too many website redirects');
}
const attribute=(tag,name)=>tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,'i'))?.slice(1).find(v=>v!==undefined)||'';
export function extractGuide(html,stylesheets=[],url='https://example.com'){
 const clean=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<!--[\s\S]*?-->/g,'');
 const embedded=[...clean.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(m=>m[1]);
 const inline=[...clean.matchAll(/\bstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)].map(m=>m[1]||m[2]);
 let css=[...embedded,...inline,...stylesheets].join('\n').replace(/\/\*[\s\S]*?\*\//g,'');
 const variables=new Map([...css.matchAll(/(--[\w-]+)\s*:\s*([^;}]+)/g)].map(m=>[m[1],m[2].trim()]));
 for(let i=0;i<4;i++)css=css.replace(/var\(\s*(--[\w-]+)(?:\s*,\s*([^)]*))?\s*\)/g,(all,key,fallback)=>variables.get(key)||fallback||all);
 const colors=[...new Set((css.match(/#[\da-f]{6}\b|#[\da-f]{3}\b/gi)||[]).map(c=>c.length===4?'#'+[...c.slice(1)].map(x=>x+x).join('').toUpperCase():c.toUpperCase()))].slice(0,6);
 const fonts=[...new Set([...css.matchAll(/font-family\s*:\s*([^;}]+)/gi)].map(m=>m[1].split(',')[0].replace(/["']/g,'').trim()).filter(f=>f&&!/var\(|inherit|initial|unset/i.test(f)))].slice(0,4);
 const sizes=[...new Set([...css.matchAll(/font-size\s*:\s*((?:\d*\.)?\d+(?:px|rem|em|vw|%))/gi)].map(m=>m[1]))].slice(0,8);
 const svg=/<svg\b|\.svg(?:["'?\s])/i.test(clean);
 const logoSvg=[...clean.matchAll(/<img\b[^>]*>/gi)].some(m=>/logo|brand/i.test(attribute(m[0],'alt')+' '+attribute(m[0],'src'))&&/\.svg(?:[?#]|$)/i.test(attribute(m[0],'src')));
 const title=clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().slice(0,150)||new URL(url).hostname;
 return {url,title,colors,fonts,sizes,svg,logoSvg,rating:colors.length&&fonts.length&&svg?'A promising foundation':'Room for improvement',note:'Et første kig på HTML og læsbare stylesheets. Skriftstørrelser er kildekodedefinitioner, ikke beregnede størrelser. JavaScript-genereret indhold, faktisk logoidentitet og visuel kvalitet er ikke vurderet.'};
}
export async function reviewWebsite(input){
 const deadline=Date.now()+17000,page=await fetchPage(checkedURL(input),2_000_000,deadline);
 if(!/text\/html/i.test(page.headers['content-type']||''))throw Error('Please enter a website page, rather than a file.');
 const urls=[];
 for(const match of page.body.matchAll(/<link\b[^>]*>/gi)){
  if(!attribute(match[0],'rel').split(/\s/).includes('stylesheet'))continue;
  try{const url=checkedURL(new URL(attribute(match[0],'href'),page.url).href);if(url.origin===page.url.origin&&!urls.some(u=>u.href===url.href))urls.push(url)}catch{}
 }
 const css=await Promise.all(urls.slice(0,3).map(async url=>{try{const r=await fetchPage(url,300_000,deadline);return /text\/css/i.test(r.headers['content-type']||'')?r.body:''}catch{return ''}}));
 return {...extractGuide(page.body,css,page.url.href),stylesheetsRead:css.filter(Boolean).length};
}
