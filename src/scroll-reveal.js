/** One-shot editorial reveals. Text stays selectable, semantic and visible without JS. */
export function mountReveals(){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),pending=new Set(),running=new Map();
 const headingSelector='.agency-hero h1,.section-heading h2,.about h2,.contact-main>span:first-child,.page-intro h1,.studio-manifesto h2,.client-case-story h2,.case-chapter h2,.review-intro h2,.portal-strip h2,.page-cta h2';
 const fadeSelector='.agency-kicker,.agency-intro,.about p,.page-intro>p,.intro-bottom>p';
 const actionSelector='.agency-actions>a,.button-blue,.outline-button,.portal-button,.text-link,.service-add,[data-studio-save]';
 const elements=[...document.querySelectorAll(`${headingSelector},${fadeSelector},${actionSelector}`)].filter(el=>!el.closest('dialog,[hidden]'));
 const ease='cubic-bezier(.22,1,.36,1)';
 function finish(el){
  pending.delete(el);observer?.unobserve(el);el.classList.remove('motion-pending');
  for(const ink of el.querySelectorAll('.motion-ink'))ink.style.backgroundPosition='0% 0%';
  for(const animation of running.get(el)||[])animation.cancel();running.delete(el);
 }
 function reveal(el){
  if(!pending.has(el))return;if(reduce.matches){finish(el);return}
  pending.delete(el);observer?.unobserve(el);
  const hero=el.closest('.agency-hero'),delay=hero?Math.min(elements.filter(item=>item.closest('.agency-hero')).indexOf(el)*100,400):Math.min([...el.parentElement.children].indexOf(el)*65,130);
  const animations=[el.animate([{opacity:.08,translate:'0 18px'},{opacity:1,translate:'0 0'}],{duration:850,delay,easing:ease,fill:'both'})];
  el.querySelectorAll('.motion-ink').forEach((ink,index)=>animations.push(ink.animate([{backgroundPosition:'100% 0%'},{backgroundPosition:'0% 0%'}],{duration:1100,delay:delay+index*75,easing:ease,fill:'both'})));
  running.set(el,animations);Promise.allSettled(animations.map(animation=>animation.finished)).then(()=>{if(running.get(el)===animations)finish(el)});
 }
 const observer='IntersectionObserver'in window?new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)reveal(entry.target)},{threshold:.08,rootMargin:'0px 0px -5% 0px'}):null;
 if(!reduce.matches&&observer&&Element.prototype.animate){
  for(const el of elements){
   // Hand over legacy section reveals to this sequence, avoiding two simultaneous entrances.
   for(let parent=el;parent&&parent!==document.body;parent=parent.parentElement)if(parent.classList.contains('reveal')){parent.classList.remove('reveal');parent.classList.add('is-visible')}
   if(el.matches(headingSelector)&&CSS.supports('background-clip','text')){
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[];let node;
    while(node=walker.nextNode())if(node.textContent.trim()&&!node.parentElement.closest('svg'))nodes.push(node);
    for(const text of nodes){const ink=document.createElement('span');ink.className='motion-ink';ink.style.setProperty('--ink-color',getComputedStyle(text.parentElement).color);ink.textContent=text.textContent;text.replaceWith(ink)}
   }
   el.classList.add('motion-pending');pending.add(el);observer.observe(el);
  }
 }
 function settle(){for(const el of new Set([...pending,...running.keys()]))finish(el)}
 function preference(){if(reduce.matches)settle()}
 function focus(event){for(const el of new Set([...pending,...running.keys()]))if(el===event.target||el.contains(event.target))finish(el)}
 reduce.addEventListener('change',preference);document.addEventListener('focusin',focus);addEventListener('pagehide',settle);
 return ()=>{settle();observer?.disconnect();reduce.removeEventListener('change',preference);document.removeEventListener('focusin',focus);removeEventListener('pagehide',settle)};
}
