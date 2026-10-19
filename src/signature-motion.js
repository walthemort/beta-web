/** Draw once; pointer movement is bounded, event-driven and purely decorative. */
export function mountSignatureMotion(){
 const art=[...document.querySelectorAll('.signature-art')];if(!art.length)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)'),running=new Set();
 const hero=document.querySelector('.editorial-hero'),gesture=hero?.querySelector('.hero-signature');let frame=0,pending=null;
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){
  observer.unobserve(entry.target);if(reduce.matches||!Element.prototype.animate)continue;
  for(const [selector,frames,delay]of [
   ['.signature-blade',[{clipPath:'inset(0 0 100% 0)'},{clipPath:'inset(0)'}],160],
   ['.signature-trace',[{strokeDashoffset:1},{strokeDashoffset:0}],0]
  ]){
   const animation=entry.target.querySelector(selector).animate(frames,{duration:1200,delay,easing:'cubic-bezier(.22,1,.36,1)'});
   running.add(animation);animation.finished.catch(()=>{}).finally(()=>running.delete(animation));
  }
 }},{threshold:.15});art.forEach(el=>observer.observe(el));
 function reset(){cancelAnimationFrame(frame);frame=0;pending=null;gesture?.style.removeProperty('translate');gesture?.style.removeProperty('rotate')}
 function flush(){frame=0;if(!pending||reduce.matches||!fine.matches)return;gesture.style.translate=pending.x+'px '+pending.y+'px';gesture.style.rotate=pending.x*.12+'deg';pending=null}
 hero?.addEventListener('pointermove',event=>{
  if(!gesture||reduce.matches||!fine.matches||event.pointerType==='touch'||event.buttons)return;
  const box=hero.getBoundingClientRect();pending={x:Math.max(-9,Math.min(9,(event.clientX-box.left-box.width/2)*.018)),y:Math.max(-7,Math.min(7,(event.clientY-box.top-box.height/2)*.018))};
  if(!frame)frame=requestAnimationFrame(flush);
 },{passive:true});
 for(const type of ['pointerleave','pointercancel','focusin'])hero?.addEventListener(type,reset);
 function settle(){reset();for(const animation of running)animation.cancel();running.clear()}
 reduce.addEventListener('change',()=>{if(reduce.matches)settle()});fine.addEventListener('change',reset);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)settle()});addEventListener('pagehide',()=>{settle();observer.disconnect()});
}
