/** Rebuild the optional 24-second reel from the existing concept studies and supplied film soundtrack. */
import {chromium} from 'playwright';
import {execFile as callbackExecFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm,copyFile,rename,chmod} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {executable} from '../lib/render-review.mjs';
const execFile=promisify(callbackExecFile),root=fileURLToPath(new URL('..',import.meta.url)),folder=await mkdtemp(join(tmpdir(),'beta-reel-'));
process.env.NODE_ENV='test';const {server}=await import('../server.js');await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({executablePath:executable(),args:['--no-sandbox','--disable-dev-shm-usage']});
const durations=[2,4,3,3,4,3,3,2],pending=resolve(root,`public/work/beta-studio-reel-build-${process.pid}.mp4`);
try{
 const page=await browser.newPage({viewport:{width:1280,height:720},reducedMotion:'reduce'});await page.addInitScript(()=>localStorage.setItem('beta:analytics-consent','false'));await page.goto(base);
 const frame=async(html,index)=>{
  await page.setContent(`<!doctype html><html><head><base href="${base}/"><link rel="stylesheet" href="/case-experiences.css"><style>@font-face{font-family:Inter;src:url('/fonts/inter-latin-variable.woff2')}*{box-sizing:border-box}html,body{margin:0;width:1280px;height:720px;overflow:hidden}body{--studio-font:Inter,Arial,sans-serif;--blue:#1B4DFF;--white:#F6F4EF;--black:#0B0B0E;font-family:Inter,Arial,sans-serif}.format-scene{width:1280px;height:720px!important}.reel-card{display:flex;flex-direction:column;justify-content:center;align-items:center;gap:60px;width:100%;height:100%;background:#1B4DFF;color:#F6F4EF}.reel-card.dark{background:#0B0B0E}.reel-card img{width:530px;height:auto}.reel-card strong{font-size:64px;letter-spacing:-.065em;font-style:italic;font-weight:600}.reel-card small{font-size:12px;letter-spacing:.12em}.full-frame{position:relative;width:100%;height:100%;background:#0B0B0E}.full-frame>img{width:100%;height:100%;object-fit:cover}.shot-caption{position:absolute;left:50px;bottom:40px;background:#F6F4EF;color:#0B0B0E;font-size:12px;padding:12px 16px}</style></head><body>${html}</body></html>`);
  await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})))});const path=join(folder,`shot-${index}.png`);await page.screenshot({path});
 };
 await frame('<div class="reel-card"><img src="/logos/beta-white.svg" alt="Beta"><strong>Ideas in motion.</strong><small>FORMA + OFFSCRIPT / CONCEPT STUDIES</small></div>',0);
 await frame('<div class="full-frame"><img src="/work/forma-cover.webp" alt="Forma"><span class="shot-caption">FORMA / MATERIAL + FEELING</span></div>',1);
 for(const [index,slug,format]of [[2,'forma','campaign'],[3,'forma','web'],[5,'offscript','campaign'],[6,'offscript','web']]){
  await page.goto(base+'/cases/'+slug);const html=await page.locator(`[data-format-panel=${format}] .format-scene`).evaluate(el=>el.outerHTML);await frame(html,index);
 }
 await frame('<div class="full-frame"><img src="/work/offscript-cover.webp" alt="Offscript"><span class="shot-caption">OFFSCRIPT / SCALE + CONTRAST</span></div>',4);
 await frame('<div class="reel-card dark"><img src="/logos/beta-white.svg" alt="Beta"><strong>Always in beta.</strong><small>VISUAL CONCEPT STUDIES / BETA STUDIO</small></div>',7);
 // Reorder the screenshots after their generation; the timeline is fixed and deterministic.
 const inputs=durations.flatMap((duration,index)=>['-loop','1','-framerate','24','-t',String(duration+.25),'-i',join(folder,`shot-${index}.png`)]);
 const graph=[];for(let i=0;i<8;i++){const zoom=[1,4].includes(i)?`1.02+0.025*on/${Math.ceil(durations[i]*24)}`:'1';graph.push(`[${i}:v]zoompan=z='${zoom}':d=1:s=1280x720:fps=24,setsar=1,fps=24,trim=duration=${durations[i]},setpts=PTS-STARTPTS,fade=t=in:d=0.12,fade=t=out:st=${durations[i]-.12}:d=0.12,format=yuv420p[v${i}]`)}
 graph.push(Array.from({length:8},(_,i)=>`[v${i}]`).join('')+'concat=n=8:v=1:a=0[film]');
 graph.push('[8:a]atrim=duration=24,afade=t=in:d=0.4,afade=t=out:st=22.5:d=1.5,volume=0.7[audio]');
 await execFile('ffmpeg',['-y','-hide_banner','-loglevel','error',...inputs,'-stream_loop','-1','-i',resolve(root,'public/work/beta-brand-film.mp4'),'-filter_complex_threads','1','-filter_complex',graph.join(';'),'-map','[film]','-map','[audio]','-t','24','-r','24','-fps_mode','cfr','-c:v','libx264','-preset','medium','-crf','24','-profile:v','main','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','-threads','2',join(folder,'studio-reel.mp4')],{maxBuffer:2*1024*1024});
 await copyFile(join(folder,'studio-reel.mp4'),pending);await chmod(pending,0o644);await rename(pending,resolve(root,'public/work/beta-studio-reel.mp4'));
 console.log('Created public/work/beta-studio-reel.mp4 / 24 seconds / 1280×720.');
}finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));await rm(folder,{recursive:true,force:true});await rm(pending,{force:true})}
