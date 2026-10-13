import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {gzipSync} from 'node:zlib';
import {renderPage} from './pages.mjs';
import {featurePage,decorateHTML,sitemap} from './lib/site.mjs';
import {reviewWebsite,checkedURL} from './review.mjs';
import {renderedReview} from './lib/render-review.mjs';
import {enrichReport,reportPDF,reportHTML} from './lib/report.mjs';
import {publicConfig,authConfig,readBody,root} from './lib/store.mjs';
import {adminAPI} from './lib/admin.mjs';
import {recordEvent} from './lib/analytics.mjs';
const port=Number(process.env.PORT||3000),windows=new Map();let reports=0,reviews=0;
function rate(req,kind,maximum){const key=kind+':'+req.socket.remoteAddress,now=Date.now(),entry=windows.get(key);if(!entry||entry.end<now)windows.set(key,{end:now+60000,count:1});else if(++entry.count>maximum){const e=Error('Please wait a minute and try again');e.status=429;throw e}if(windows.size>5000)for(const [k,v] of windows)if(v.end<now)windows.delete(k)}
export const server=http.createServer(async(req,res)=>{
 const send=(status,data,type='application/json',headers={})=>{let body=Buffer.isBuffer(data)?data:Buffer.from(typeof data==='string'?data:JSON.stringify(data));const base={'Content-Type':type,'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-store',...headers};if(/text|json|javascript|svg/.test(type)&&body.length>1000&&/\bgzip\b/.test(req.headers['accept-encoding']||'')){body=gzipSync(body);base['Content-Encoding']='gzip';base.Vary='Accept-Encoding'}res.writeHead(status,base);res.end(req.method==='HEAD'?undefined:body)};
 try{
  const rawPath=new URL(req.url,'http://beta.local').pathname,english=rawPath==='/en'||rawPath.startsWith('/en/'),pathname=english?(rawPath.slice(3)||'/'):rawPath;
  if(pathname.startsWith('/api/')){
   if(english)throw Error('Use the canonical API path');
   if(pathname==='/api/status'&&req.method==='GET')return send(200,{app:'beta-web',subpages:true,routes:['/cases','/services','/studio','/start','/inspiration','/privacy','/admin','/portal']});
   if(pathname==='/api/site-config'&&req.method==='GET')return send(200,publicConfig());
   if(pathname==='/api/auth-config'&&req.method==='GET')return send(200,authConfig());
   if(pathname==='/api/case-content'&&req.method==='GET'){const {readJSON}=await import('./lib/store.mjs');return send(200,readJSON('content/cases.json',[]).filter(c=>c.status!=='draft'))}
   if(pathname.startsWith('/api/admin/')){rate(req,'admin',60);return send(200,await adminAPI(req,pathname))}
   if(pathname==='/api/analytics'&&req.method==='POST'){rate(req,'events',60);await recordEvent(JSON.parse((await readBody(req,4000)).toString()));return send(204,'')}
   if(pathname==='/api/review'&&req.method==='POST'){
    rate(req,'review',4);if(reviews>=3){const e=Error('Reviews are busy. Try again shortly.');e.status=429;throw e}const input=JSON.parse((await readBody(req,4096)).toString()).url;checkedURL(input);
    reviews++;try{let result;if(process.env.RENDER_REVIEW!=='false')try{result=await renderedReview(input)}catch(e){if(e.status===429)throw e}
    if(!result)result={...await reviewWebsite(input),rendered:false};return send(200,enrichReport(result));}finally{reviews--}
   }
   if(['/api/report/pdf','/api/report/html'].includes(pathname)&&req.method==='POST'){
    rate(req,'report',6);const input=JSON.parse((await readBody(req,30000)).toString());if(pathname.endsWith('/html'))return send(200,await reportHTML(input),'text/html; charset=utf-8');
    if(reports>=2){const e=Error('Reports are busy. Try shortly');e.status=429;throw e}reports++;try{return send(200,await reportPDF(input),'application/pdf',{'Content-Disposition':'attachment; filename="beta-brandguide.pdf"'})}finally{reports--}
   }
   return send(404,{error:'Unknown API operation'});
  }
  if(!['GET','HEAD'].includes(req.method))return send(405,{error:'Method not allowed'},'application/json',{Allow:'GET, HEAD'});
  if(pathname==='/sitemap.xml')return send(200,sitemap(),'application/xml');
  if(pathname==='/robots.txt')return send(200,`User-agent: *\nDisallow: /admin\nDisallow: /portal\nDisallow: /app\nDisallow: /inspiration\n${publicConfig().siteURL?'Sitemap: '+new URL('/sitemap.xml',publicConfig().siteURL).href+'\n':''}`,'text/plain');
  const page=featurePage(pathname)||renderPage(pathname);if(page)return send(page.status,decorateHTML(page.html,pathname,english),'text/html; charset=utf-8');
  const portalRoute=pathname==='/portal'||pathname==='/app'||pathname.startsWith('/app/')||pathname.startsWith('/assets/')||pathname.startsWith('/brand/')||pathname.startsWith('/print/');
  if(portalRoute){
   if(pathname==='/portal'&&process.env.PORTAL_URL){const u=new URL(process.env.PORTAL_URL);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)throw Error('Invalid portal URL');return send(302,'','text/plain',{Location:u.href})}
   const folder=resolve(root,'public/portal-app'),asset=pathname.startsWith('/assets/')||pathname.startsWith('/brand/'),file=asset?resolve(folder,'.'+decodeURIComponent(pathname)):resolve(folder,'index.html');
   if(!file.startsWith(folder+'/'))return send(404,'Not found','text/plain');
   try{return send(200,await readFile(file),mime(file),{'Cache-Control':asset?'public, max-age=31536000, immutable':'no-store'})}catch{return send(503,'Portal build unavailable. Run npm run build:portal.','text/plain')}
  }
  if(/^\/(logos|clients|media|work)\//.test(pathname)){
   const match=pathname.match(/^\/(logos|clients|media|work)\/([A-Za-z0-9_.-]+\.(?:svg|png|webp|jpg))$/);if(!match)return send(404,'Not found','text/plain');try{return send(200,await readFile(resolve(root,'public',match[1],match[2])),mime(match[2]),{'Cache-Control':'public, max-age=3600'})}catch{return send(404,'Not found','text/plain')}
  }
  const files=['style.css','app.js','favicon.svg','clients.json','pages.css','pages.js','navigation.js','motion.js','features.css','features.js','admin.js','locale.js'];
  const name=pathname==='/'?'index.html':pathname.slice(1);if(name!=='index.html'&&!files.includes(name))return send(404,'Not found','text/plain');
  const data=await readFile(resolve(root,'public',name));return send(200,name==='index.html'?decorateHTML(data.toString(),pathname,english):data,mime(name));
 }catch(e){return send(e.status||400,{error:e.message||'Unable to complete this request.'})}
});
function mime(file){return {'.html':'text/html; charset=utf-8','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.json':'application/json'}[extname(file)]||'application/octet-stream'}
if(process.env.NODE_ENV!=='test')server.listen(port,'0.0.0.0',()=>console.log(`Beta website (beta-web) running on port ${port}\nProject folder: ${root}\nSubpages: /cases /services /studio /start`));
