/** Small, input-driven gestures. Native links, text, focus and touch targets stay intact. */
export function mountCreativeInteractions(){
 const pointer=matchMedia('(hover: hover) and (pointer: fine)'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const buttons=[...document.querySelectorAll('.agency-button,.nav-project,.portal-button')],previews=[...document.querySelectorAll('.case-preview')];
 const listeners=new AbortController();
 const pending=new Map();let raf=0;
 const enabled=()=>pointer.matches&&!reduce.matches;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function flush(){raf=0;for(const [el,values] of pending)for(const [key,value] of Object.entries(values))el.style.setProperty(key,value);pending.clear()}
 function write(el,values){pending.set(el,values);if(!raf)raf=requestAnimationFrame(flush)}
 function resetButton(el){pending.delete(el);el.style.setProperty('--magnet-x','0px');el.style.setProperty('--magnet-y','0px')}
 function resetPreview(el){pending.delete(el);el.classList.remove('is-previewing');for(const key of ['--case-x','--case-y','--case-pan-x','--case-pan-y'])el.style.removeProperty(key)}
 function listen(el,type,callback,options={}){el.addEventListener(type,callback,{...options,signal:listeners.signal})}
 for(const button of buttons){
  listen(button,'pointermove',event=>{if(!enabled()||event.pointerType==='touch'||event.buttons||button.classList.contains('motion-pending'))return;const rect=button.getBoundingClientRect();if(!rect.width||!rect.height)return;write(button,{'--magnet-x':clamp((event.clientX-rect.left-rect.width/2)*.05,-4,4)+'px','--magnet-y':clamp((event.clientY-rect.top-rect.height/2)*.08,-2,2)+'px'})},{passive:true});
  for(const type of ['pointerleave','pointercancel','pointerdown','blur'])listen(button,type,()=>resetButton(button));
 }
 for(const preview of previews){
  listen(preview,'pointermove',event=>{if(!enabled()||event.pointerType==='touch'||event.buttons)return;const rect=preview.getBoundingClientRect();if(!rect.width||!rect.height)return;const x=event.clientX-rect.left,y=event.clientY-rect.top;preview.classList.add('is-previewing');write(preview,{'--case-x':clamp(x,30,rect.width-30)+'px','--case-y':clamp(y,30,rect.height-30)+'px','--case-pan-x':((x/rect.width-.5)*-4)+'px','--case-pan-y':((y/rect.height-.5)*-4)+'px'})},{passive:true});
  for(const type of ['pointerleave','pointercancel','pointerdown'])listen(preview,type,()=>resetPreview(preview));
 }
 function reset(){cancelAnimationFrame(raf);raf=0;pending.clear();buttons.forEach(resetButton);previews.forEach(resetPreview)}
 function preference(){reset();buttons.forEach(button=>button.classList.toggle('has-magnet',enabled()))}
 listen(pointer,'change',preference);listen(reduce,'change',preference);listen(window,'pagehide',reset);listen(window,'blur',reset);
 // A cursor badge must not remain floating over a card after the page moves.
 listen(window,'scroll',()=>{if(pending.size||previews.some(preview=>preview.classList.contains('is-previewing'))||buttons.some(button=>parseFloat(button.style.getPropertyValue('--magnet-x'))))reset()},{passive:true});
 listen(document,'visibilitychange',()=>{if(document.hidden)reset()});preference();
 return ()=>{reset();listeners.abort();buttons.forEach(button=>button.classList.remove('has-magnet'))};
}
