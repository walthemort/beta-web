/** Static line masks and one observer. No scroll-time text splitting or paint effects. */
export function mountReveals(){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),running=new Map();
 const headings=[...document.querySelectorAll('#agency-title,.selected-heading h2,.studio-statement h2,.review-questions h2,.next-conversation h2,.page-intro h1,.studio-manifesto h2,.client-case-story h2,.case-chapter h2,.page-cta h2,.section-heading h2')].filter(el=>!el.closest('dialog,template,[hidden]'));
 for(const heading of headings){
  if(!heading.querySelector('.statement-line')){
   const nodes=[...heading.childNodes];let line,inner;
   const next=()=>{line=document.createElement('span');line.className='statement-line';inner=document.createElement('span');line.append(inner);heading.append(line)};
   next();for(const node of nodes){if(node.nodeName==='BR'){node.remove();next()}else inner.append(node)}
  }
 }
 const elements=[...headings,...document.querySelectorAll('.selected-case,.studio-services>a,.line-link,.offering-start,.gallery-grid>button,.page-cta>a>span,.contact-arrow')];
 for(const el of elements)for(let parent=el;parent&&parent!==document.body;parent=parent.parentElement)if(parent.classList.contains('reveal')){parent.classList.remove('reveal');parent.classList.add('is-visible')}
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){
  const el=entry.target;observer.unobserve(el);if(reduce.matches)return;
  const lines=[...el.querySelectorAll(':scope>.statement-line>span')];
  for(const [index,target]of(lines.length?lines:[el]).entries()){
   const animation=target.animate(lines.length?[{transform:'translateY(106%)'},{transform:'translateY(0)'}]:[{opacity:.25,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:lines.length?700:450,delay:lines.length?index*70:0,easing:'cubic-bezier(.22,1,.36,1)',fill:'backwards'});
   running.set(target,animation);animation.finished.catch(()=>{}).finally(()=>{if(running.get(target)===animation)running.delete(target)});
  }
 }},{threshold:.08});
 if(!reduce.matches)for(const el of elements)observer.observe(el);
 function settle(){for(const animation of running.values())animation.cancel();running.clear();observer.disconnect()}
 document.addEventListener('focusin',event=>{for(const [el,animation]of running)if(el===event.target||el.contains(event.target))animation.cancel()});
 reduce.addEventListener('change',()=>{if(reduce.matches)settle()});addEventListener('pagehide',settle);
}
