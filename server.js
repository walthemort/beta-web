import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
const port=Number(process.env.PORT||3000);
async function safeURL(input){
 const u=new URL(input.includes('://')?input:`https://${input}`);
 if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.port) throw Error('Please enter a public website URL without credentials or a port.');
 const addresses=await lookup(u.hostname,{all:true});
 if(!addresses.length||addresses.some(({address:a})=> isIP(a)!==4 || /^(0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|192\.0\.|198\.(18|19)\.|22[4-9]\.|2[3-5]\d\.)/.test(a))) throw Error('This tool can only review public websites.');
 return u;
}
async function review(input){
 let u=await safeURL(input),response;
 for(let i=0;i<4;i++){
  response=await fetch(u,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'User-Agent':'BetaReview/1.0'}});
  if(response.status>=300&&response.status<400){await response.body?.cancel();u=await safeURL(new URL(response.headers.get('location'),u).href);continue;}break;
 }
 if(!response.ok)throw Error('The website could not be read. It may block automated reviews.');
 if(!response.headers.get('content-type')?.includes('text/html'))throw Error('Please enter a website page, rather than a file.');
 const reader=response.body.getReader();let html='',bytes=0;
 while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.length;if(bytes>2000000){await reader.cancel();break;}html+=new TextDecoder().decode(value);}
 const colors=[...new Set(html.match(/#[\da-f]{6}\b|#[\da-f]{3}\b/gi)||[])].slice(0,6);
 const fonts=[...new Set([...html.matchAll(/font-family\s*:\s*([^;}<]+)/gi)].map(m=>m[1].replace(/["']/g,'').trim()))].slice(0,3);
 const svg=/<svg\b|\.svg(?:["'?\s])/i.test(html);
 const title=html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim()||u.hostname;
 return {url:u.href,title,colors,fonts,svg,rating:colors.length&&fonts.length&&svg?'A promising foundation':'Room for improvement',note:'An initial review of the page HTML. External stylesheets, rendered content, and visual suitability need a designer’s review. SVG detection does not confirm a logo.'};
}
const server=http.createServer(async(req,res)=>{
 try{
  if(req.url==='/api/review'&&req.method==='POST'){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error('Request too large.');}
   const result=await review(JSON.parse(body).url);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;
  }
  const pathname=new URL(req.url,'http://beta.local').pathname;
  if(pathname==='/api/site-config'){
   res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});
   res.end(JSON.stringify({bookingURL:process.env.BOOKING_URL||null,contactEmail:process.env.CONTACT_EMAIL||null}));return;
  }
  const portalRoute=pathname==='/portal'||pathname==='/app'||pathname.startsWith('/app/')||pathname.startsWith('/assets/')||pathname.startsWith('/brand/')||pathname.startsWith('/print/');
  if(portalRoute && !(pathname==='/portal' && process.env.PORTAL_URL)){
   const root=resolve('public/portal-app');
   const isPortalAsset=pathname.startsWith('/assets/')||pathname.startsWith('/brand/');
   const file=isPortalAsset?resolve(root,'.'+decodeURIComponent(pathname)):resolve(root,'index.html');
   if(!file.startsWith(root+'/')){res.writeHead(404);res.end('Not found');return;}
   try{
    const data=await readFile(file);
    const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg'}[extname(file)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':mime,'X-Content-Type-Options':'nosniff','Cache-Control':isPortalAsset?'public, max-age=31536000, immutable':'no-store'});res.end(data);return;
   }catch{if(pathname!=='/portal'){res.writeHead(404);res.end('Portal build unavailable. Run npm run build:portal.');return;}}
  }
  if(pathname==='/portal'){
   if(process.env.PORTAL_URL){const destination=new URL(process.env.PORTAL_URL);if(!['https:','http:'].includes(destination.protocol)||destination.username||destination.password)throw Error('Invalid portal configuration.');res.writeHead(302,{Location:destination.href});res.end();return;}
   res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Beta — Client portal</title><link rel="stylesheet" href="/style.css"></head><body><header><a class="logo" href="/">beta<span>®</span></a><span>CLIENT PORTAL</span></header><main style="padding:80px 5%;max-width:850px"><h1>Every project.<br>One <em>place.</em></h1><p>We’re connecting your Beta workspace. Please contact Beta for project access.</p><a class="dark-button" href="/">Back to Beta ↗</a></main></body></html>');return;
  }
  const files={'/':'index.html','/style.css':'style.css','/app.js':'app.js','/favicon.svg':'favicon.svg'};
  const file=files[req.url?.split('?')[0]];if(!file){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':'text/html'});res.end(await readFile(new URL(`./public/${file}`,import.meta.url)));
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message||'Unable to review this website.'}));}
});
server.listen(port,'0.0.0.0',()=>console.log(`Beta running on port ${port}`));
