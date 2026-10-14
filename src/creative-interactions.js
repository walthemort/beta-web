/** Small, input-driven gestures. Native links, text, focus and touch targets stay intact. */
export function mountCreativeInteractions(){
 const pointer=matchMedia('(hover: hover) and (pointer: fine)'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const buttons=[...document.querySelectorAll('.agency-button,.nav-project,.portal-button')],previews=[...document.querySelectorAll('.case-preview')];
 const pending=new Map();let raf=0;
 const enabled=()=>pointer.matches&&!reduce.matches;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function flush(){raf=0;for(const [el,values] of pending)for(const [key,value] of Object.entries(values))el.style.setProperty(key,value);pending.clear()}
 function write(el,values){pending.set(el,values);if(!raf)raf=requestAnimationFrame(flush)}
 function resetButton(el){pending.delete(el);el.style.setProperty('--magnet-x','0px');el.style.setProperty('--magnet-y','0px')}
 function resetPreview(el){pending.delete(el);el.classList.remove('is-previewing');for(const key of ['--case-x','--case-y','--case-pan-x','--case-pan-y'])el.style.removeProperty(key)}
 for(const button of buttons){
  button.classList.add('has-magnet');
  button.addEventListener('pointermove',event=>{if(!enabled()||event.pointerType==='touch'||button.classList.contains('motion-pending'))return;const rect=button.getBoundingClientRect();write(button,{'--magnet-x':clamp((event.clientX-rect.left-rect.width/2)*.06,-5,5)+'px','--magnet-y':clamp((event.clientY-rect.top-rect.height/2)*.10,-3,3)+'px'})},{passive:true});
  button.addEventListener('pointerleave',()=>resetButton(button));button.addEventListener('blur',()=>resetButton(button));
 }
 for(const preview of previews){
  preview.addEventListener('pointermove',event=>{if(!enabled()||event.pointerType==='touch')return;const rect=preview.getBoundingClientRect(),x=event.clientX-rect.left,y=event.clientY-rect.top;preview.classList.add('is-previewing');write(preview,{'--case-x':clamp(x,30,rect.width-30)+'px','--case-y':clamp(y,30,rect.height-30)+'px','--case-pan-x':((x/rect.width-.5)*-6)+'px','--case-pan-y':((y/rect.height-.5)*-6)+'px'})},{passive:true});
  preview.addEventListener('pointerleave',()=>resetPreview(preview));
 }
 function reset(){cancelAnimationFrame(raf);raf=0;pending.clear();buttons.forEach(resetButton);previews.forEach(resetPreview)}
 pointer.addEventListener('change',reset);reduce.addEventListener('change',reset);addEventListener('pagehide',reset);document.addEventListener('visibilitychange',()=>{if(document.hidden)reset()});
}
