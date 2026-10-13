import http from 'node:http';
import net,{isIP} from 'node:net';
import {lookup} from 'node:dns/promises';
import {existsSync} from 'node:fs';
import {chromium} from 'playwright';
import {checkedURL,publicAddress} from '../review.mjs';
export async function resolvePublic(hostname){const addresses=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('DNS timed out')),5000);lookup(hostname,{all:true}).then(resolve,reject).finally(()=>clearTimeout(timer))});if(!addresses.length||addresses.some(a=>!publicAddress(a.address)))throw Error('Private network destinations are blocked');return addresses.sort((a,b)=>a.family-b.family)[0].address}
// Chromium sends all remote traffic through a loopback proxy. DNS is checked and pinned
// at the actual connection, including HTTPS CONNECT and every redirected destination.
export async function startReviewProxy(){
 const sockets=new Set();let transferred=0;const remember=socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));socket.setTimeout(22000,()=>socket.destroy());socket.on('data',chunk=>{transferred+=chunk.length;if(transferred>16_000_000)for(const s of sockets)s.destroy()})};
 const server=http.createServer(async(req,res)=>{try{
  if(req.method!=='GET')throw Error('Read-only requests only');const url=checkedURL(req.url);if(url.protocol!=='http:')throw Error('Use HTTPS CONNECT');
  const address=await resolvePublic(url.hostname);const upstream=http.get(url,{lookup:(_host,_opts,callback)=>callback(null,address,isIP(address)),headers:{host:url.host,'user-agent':'BetaReview/2.0',accept:req.headers.accept||'*/*','accept-encoding':'identity'},timeout:8000},response=>{let bytes=0;response.on('data',chunk=>{bytes+=chunk.length;if(bytes>3_000_000){response.destroy();res.destroy()}});res.writeHead(response.statusCode||502,response.headers);response.pipe(res)});upstream.on('error',()=>{if(!res.headersSent)res.writeHead(502);res.end()});upstream.on('timeout',()=>upstream.destroy());
 }catch{res.writeHead(403);res.end('Destination blocked')}});
 server.on('connection',remember);
 server.on('connect',async(req,client,head)=>{try{
  if(!/^[A-Za-z0-9.-]+:443$/.test(req.url))throw Error('Destination blocked');const host=req.url.slice(0,-4);const address=await resolvePublic(host);
  const upstream=net.connect({host:address,port:443});remember(upstream);upstream.setTimeout(20000,()=>upstream.destroy());
  upstream.once('connect',()=>{if(client.destroyed){upstream.destroy();return}client.write('HTTP/1.1 200 Connection Established\r\n\r\n');if(head.length)upstream.write(head);upstream.pipe(client);client.pipe(upstream)});
  upstream.on('error',()=>client.destroy());client.on('error',()=>upstream.destroy());client.on('close',()=>upstream.destroy());
 }catch{client.end('HTTP/1.1 403 Forbidden\r\n\r\n')}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:`http://127.0.0.1:${server.address().port}`,close:async()=>{for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve))}};
}
export function executable(){return process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined)}
export async function collectRendered(page){const data=await page.evaluate(()=>{
 const toHex=value=>{const m=value.match(/^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)(?:[, /]+([\d.]+))?\)/);if(!m||m[4]==='0')return null;return '#'+m.slice(1,4).map(n=>Math.min(255,Number(n)).toString(16).padStart(2,'0')).join('').toUpperCase()};
 const palette=new Map(),fonts=new Map(),sizes=new Map();let count=0;
 for(const el of [...document.querySelectorAll('body *')].slice(0,1800)){const r=el.getBoundingClientRect();if(!r.width||!r.height)continue;count++;const style=getComputedStyle(el);for(const value of [style.color,style.backgroundColor,style.borderColor]){const hex=toHex(value);if(hex)palette.set(hex,(palette.get(hex)||0)+1)}if(el.textContent?.trim()&&el.childElementCount===0){const font=style.fontFamily.split(',')[0].replace(/["']/g,'').trim();if(font)fonts.set(font,(fonts.get(font)||0)+1);sizes.set(style.fontSize,(sizes.get(style.fontSize)||0)+1)}}
 const rank=map=>[...map].sort((a,b)=>b[1]-a[1]).map(([key])=>key);
 const logo=[...document.querySelectorAll('img')].find(img=>/logo|brand/i.test(img.alt+' '+img.currentSrc));
 return {title:document.title.slice(0,150),colors:rank(palette).slice(0,6),fonts:rank(fonts).slice(0,4),sizes:rank(sizes).slice(0,8),svg:!!document.querySelector('svg')||[...document.images].some(i=>/\.svg(?:[?#]|$)/i.test(i.currentSrc)),logoSvg:!!logo&&/\.svg(?:[?#]|$)/i.test(logo.currentSrc),renderedElements:count,fontsLoaded:document.fonts.status==='loaded'};
});
 const session=await page.context().newCDPSession(page);const fonts=new Map();
 try{await session.send('DOM.enable');await session.send('CSS.enable');const {root}=await session.send('DOM.getDocument');const {nodeIds}=await session.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'h1,h2,p,button,a'});for(const nodeId of nodeIds.slice(0,16)){const result=await session.send('CSS.getPlatformFontsForNode',{nodeId});for(const font of result.fonts)if(font.glyphCount>0)fonts.set(font.familyName,(fonts.get(font.familyName)||0)+font.glyphCount)}}catch{}finally{await session.detach().catch(()=>{})}
 return {...data,actualFonts:[...fonts].sort((a,b)=>b[1]-a[1]).map(([name])=>name).slice(0,4)};
}
export const reviewProfiles={desktop:{viewport:{width:1280,height:900}},mobile:{viewport:{width:390,height:844},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'}};
/** Each viewport gets an isolated anonymous session; failures are reported per view. */
export async function collectViews(browser,url,configure=async()=>{}){
 const views=Object.fromEntries(await Promise.all(Object.entries(reviewProfiles).map(async([key,profile])=>{
  const context=await browser.newContext({...profile,serviceWorkers:'block',acceptDownloads:false});const timer=setTimeout(()=>void context.close().catch(()=>{}),22000);
  try{await configure(context);const page=await context.newPage();const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:16000});if(!response||response.status()>=400)throw Error('Website could not be rendered');checkedURL(page.url());await page.waitForTimeout(800);await page.evaluate(()=>Promise.race([document.fonts.ready,new Promise(r=>setTimeout(r,1200))]));const data=await collectRendered(page);const screenshot=await page.screenshot({type:'jpeg',quality:60,timeout:3000});return [key,{...data,url:page.url(),view:key,viewport:profile.viewport,rendered:true,screenshot:'data:image/jpeg;base64,'+screenshot.toString('base64'),rating:data.colors.length&&data.fonts.length&&data.svg?'A promising foundation':'Room for improvement',note:`Anonymt renderet ${key}besøg (${profile.viewport.width} × ${profile.viewport.height}). Farver og størrelser fra denne visning. Et øjebliksbillede af siden, ikke en vurdering af hele sitet.`}];}
  catch{return [key,{view:key,viewport:profile.viewport,unavailable:true,note:'Denne visning kunne ikke renderes.'}];}
  finally{clearTimeout(timer);await context.close().catch(()=>{})}
 })));
 const primary=views.desktop.rendered?views.desktop:views.mobile.rendered?views.mobile:null;if(!primary)throw Error('Website could not be rendered');return {...primary,views};
}
let active=0;
export async function renderedReview(input){if(active>=2){const e=Error('Reviews are busy. Try again shortly.');e.status=429;throw e}active++;let proxy,browser;
 try{
  const url=checkedURL(input);proxy=await startReviewProxy();
  browser=await chromium.launch({executablePath:executable(),headless:true,chromiumSandbox:true,timeout:5000,proxy:{server:proxy.url,bypass:'<-loopback>'},args:['--proxy-bypass-list=<-loopback>','--disable-dev-shm-usage','--disable-background-networking','--force-webrtc-ip-handling-policy=disable_non_proxied_udp']});
  let requests=0,totalBytes=0;
  return await collectViews(browser,url.href,async context=>{
   await context.route('**/*',route=>{const request=route.request();if(++requests>140||request.method()!=='GET'||!/^https?:/.test(request.url()))return route.abort();try{checkedURL(request.url());return route.continue()}catch{return route.abort()}});
   await context.routeWebSocket('**/*',route=>route.close());
   context.on('response',response=>{const length=Number(response.headers()['content-length']||0);totalBytes+=length;if(length>3_000_000||totalBytes>12_000_000)void browser.close().catch(()=>{})});
  });
 }finally{await browser?.close().catch(()=>{});await proxy?.close().catch(()=>{});active--}
}
