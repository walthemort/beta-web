/** One observer and short compositor-only entrances. Text is never split or repainted on scroll. */
export function mountReveals(){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),running=new Map(),pending=new Set();
 const selector='.portfolio-heading h2,.about h2,.contact-main>span:first-child,.page-intro h1,.studio-manifesto h2,.client-case-story h2,.case-chapter h2,.review-intro h2,.page-cta h2,.section-heading h2,.agency-actions>a,.offerings>article,.gallery-grid>button';
 const elements=[...document.querySelectorAll(selector)].filter(el=>!el.closest('dialog,template,[hidden]'));
 for(const el of elements)for(let parent=el;parent&&parent!==document.body;parent=parent.parentElement)if(parent.classList.contains('reveal')){parent.classList.remove('reveal');parent.classList.add('is-visible')}
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){
  const el=entry.target;observer.unobserve(el);pending.delete(el);if(reduce.matches)return;
  const animation=el.animate([{opacity:.35,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:320,easing:'cubic-bezier(.22,1,.36,1)'});
  running.set(el,animation);animation.finished.catch(()=>{}).finally(()=>{if(running.get(el)===animation)running.delete(el)});
 }},{threshold:.08});
 if(!reduce.matches)for(const el of elements){pending.add(el);observer.observe(el)}
 function settle(){for(const animation of running.values())animation.cancel();running.clear();observer.disconnect();pending.clear()}
 document.addEventListener('focusin',event=>{for(const [el,animation]of running)if(el.contains(event.target))animation.cancel()});
 reduce.addEventListener('change',()=>{if(reduce.matches)settle()});addEventListener('pagehide',settle);
}
