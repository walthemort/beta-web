import {t} from './locale.js';
/** One native video. No animation loop or scroll-linked rendering. */
export function mountHeroFilm(){
 const video=document.querySelector('#hero-film'),stage=document.querySelector('.hero-stage'),button=document.querySelector('#hero-film-toggle');
 if(!video||!stage||!button)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),connection=navigator.connection,menu=document.querySelector('#menu');
 let visible=false,manualPause=false,explicitPlay=false,blocked=false,failed=false,active=true,pending=false;
 video.muted=true;button.hidden=false;
 const allowed=()=>active&&visible&&!document.hidden&&!menu?.open&&!manualPause&&!blocked&&!failed&&(explicitPlay||(!reduce.matches&&!connection?.saveData));
 function controls(){const playing=!video.paused&&!video.ended;button.setAttribute('aria-label',t(playing?'Sæt baggrundsfilmen på pause':'Afspil baggrundsfilmen'));button.querySelector('[data-hero-play]').hidden=playing;button.querySelector('[data-hero-pause]').hidden=!playing}
 function load(){if(video.hasAttribute('src'))return;video.src=matchMedia('(max-width:700px)').matches?'/work/hero-loop-mobile.mp4':'/work/hero-loop.mp4';video.load()}
 function sync(){
  if(!allowed()){video.pause();controls();return}
  if(!video.paused||pending)return;
  load();pending=true;
  video.play().catch(error=>{if(error.name!=='AbortError')blocked=true}).finally(()=>{pending=false;if(!allowed())video.pause();controls();if(allowed()&&video.paused)sync()});
 }
 button.addEventListener('click',()=>{
  if(!video.paused||pending){manualPause=true;explicitPlay=false;sync()}
  else{manualPause=false;explicitPlay=true;blocked=false;sync()}
 });
 video.addEventListener('playing',()=>{if(!allowed())video.pause();controls()});video.addEventListener('pause',controls);
 video.addEventListener('error',()=>{failed=true;video.pause();button.hidden=true});
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting&&entries[0].intersectionRatio>.1;sync()},{threshold:.1});observer.observe(stage);
 document.addEventListener('visibilitychange',sync);
 reduce.addEventListener('change',()=>{explicitPlay=false;sync()});connection?.addEventListener?.('change',()=>{explicitPlay=false;sync()});
 if(menu)new MutationObserver(sync).observe(menu,{attributes:true,attributeFilter:['open']});
 addEventListener('pagehide',()=>{active=false;sync()});addEventListener('pageshow',()=>{active=true;sync()});
 controls();sync();
}
