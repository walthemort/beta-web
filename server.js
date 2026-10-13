import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {reviewWebsite} from './review.mjs';
const port=Number(process.env.PORT||3000);
const server=http.createServer(async(req,res)=>{
 try{
  if(req.url==='/api/review'&&req.method==='POST'){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>4096)throw Error('Request too large.');}
   const result=await reviewWebsite(JSON.parse(body).url);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;
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
  if(pathname.startsWith('/logos/')){
   const name=pathname.slice('/logos/'.length);
   if(!['beta-blue.svg','beta-white.svg','beta-black.svg','beta-outline.svg'].includes(name)){res.writeHead(404);res.end('Not found');return;}
   res.writeHead(200,{'Content-Type':'image/svg+xml','X-Content-Type-Options':'nosniff'});res.end(await readFile(new URL(`./public/logos/${name}`,import.meta.url)));return;
  }
  if(pathname.startsWith('/clients/')){
   const filename=pathname.slice(9);
   if(!/^[a-zA-Z0-9_.-]+\.(svg|png|webp|jpg)$/i.test(filename)){res.writeHead(404);res.end('Not found');return;}
   try{const data=await readFile(new URL(`./public/clients/${filename}`,import.meta.url));res.writeHead(200,{'Content-Type':{'.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg'}[extname(filename).toLowerCase()],'X-Content-Type-Options':'nosniff'});res.end(data)}catch{res.writeHead(404);res.end('Not found')}return;
  }
  const files={'/':'index.html','/style.css':'style.css','/app.js':'app.js','/favicon.svg':'favicon.svg','/clients.json':'clients.json'};
  const file=files[req.url?.split('?')[0]];if(!file){res.writeHead(404);res.end('Not found');return;}
  res.writeHead(200,{'Content-Type':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.json')?'application/json':'text/html'});res.end(await readFile(new URL(`./public/${file}`,import.meta.url)));
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message||'Unable to review this website.'}));}
});
server.listen(port,'0.0.0.0',()=>console.log(`Beta running on port ${port}`));
