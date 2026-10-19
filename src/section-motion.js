/** A shared arrival rhythm for imagery and editorial blocks across public pages. */
export function mountSectionMotion(){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const selectors='.project-grid>.project-card,.studio-editorial,.about-layout>.reveal,.offerings>article,.process-map,.gallery-grid>button,.case-chapter,.studio-values,.studio-principles>article,.client-case-story,.privacy-copy>article,.inspiration-card,.portal-strip';
 const items=[...document.querySelectorAll(selectors)].filter(el=>!el.closest('template,[hidden],dialog'));
 const animations=new Map(),pending=new Set(items),ease='cubic-bezier(.22,1,.36,1)';
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){
  const el=entry.target;observer.unobserve(el);pending.delete(el);if(reduce.matches)return;
  const order=el.matches('.project-card')?[...el.parentElement.children].indexOf(el)%3:0;
  el.classList.remove('reveal');el.classList.add('is-visible');
  const animation=el.animate([{opacity:0,transform:'translateY(22px)',clipPath:el.matches('.studio-editorial')?'inset(12% 0 0 0 round 14px)':'inset(0 0 0 0)'},{opacity:1,transform:'translateY(0)',clipPath:'inset(0 0 0 0 round 0px)'}],{duration:800,delay:order*65,easing:ease});
  animations.set(el,animation);animation.finished.catch(()=>{}).finally(()=>animations.delete(el));
 }},{threshold:.08,rootMargin:'0px 0px -24px 0px'});
 for(const el of items)observer.observe(el);
 const settle=()=>{for(const animation of animations.values())animation.cancel();animations.clear()};
 document.addEventListener('focusin',event=>{for(const [el,animation]of animations)if(el.contains(event.target))animation.cancel()});
 reduce.addEventListener('change',()=>{if(reduce.matches)settle()});addEventListener('pagehide',settle);
}
