/** Scroll-linked type and chapter curves, with no idle render loop or page pinning. */
export function mountScrollScenes(){
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),targets=[],chapter=document.querySelector('[data-curved-chapter]');
 const clamp=value=>Math.max(0,Math.min(1,value));let frame=0;
 if(CSS.supports('background-clip','text')&&CSS.supports('color','color-mix(in srgb, black 18%, transparent)'))for(const heading of document.querySelectorAll('.about h2,.studio-manifesto h2,.case-story h2')){
  const walker=document.createTreeWalker(heading,NodeFilter.SHOW_TEXT),nodes=[];let node;while(node=walker.nextNode())if(node.textContent.trim())nodes.push(node);
  const words=[];
  for(const text of nodes){const ink=getComputedStyle(text.parentElement).color,fragment=document.createDocumentFragment();for(const part of text.textContent.split(/(\s+)/)){if(!part.trim()){fragment.append(document.createTextNode(part));continue}const word=document.createElement('span');word.className='scroll-word';word.style.setProperty('--word-ink',ink);word.textContent=part;fragment.append(word);words.push(word)}text.replaceWith(fragment)}
  heading.dataset.scrollInk='';targets.push({heading,words});
 }
 const active=new Set(),observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)active.add(entry.target);else active.delete(entry.target)}schedule()});
 for(const {heading}of targets)observer.observe(heading);if(chapter)observer.observe(chapter);
 function paint(){
  frame=0;if(reduce.matches||document.hidden)return;
  for(const {heading,words}of targets){if(!active.has(heading))continue;const box=heading.getBoundingClientRect(),progress=clamp((innerHeight*.8-box.top)/(Math.min(innerHeight*.5,box.height+innerHeight*.22)));
   words.forEach((word,index)=>{const fill=clamp((progress*(words.length+1)-index)/2);word.style.backgroundPosition=((1-fill)*100).toFixed(2)+'% 0%'});
  }
  if(chapter&&active.has(chapter)){const box=chapter.getBoundingClientRect(),progress=clamp((innerHeight-box.top)/(innerHeight+box.height)),range=innerWidth<=639?30:80;chapter.style.setProperty('--chapter-curve',(range*(1-clamp((progress-.25)/.65))).toFixed(2)+'px')}
 }
 function schedule(){if(!frame&&!reduce.matches&&!document.hidden)frame=requestAnimationFrame(paint)}
 function preference(){cancelAnimationFrame(frame);frame=0;for(const {heading}of targets)heading.classList.toggle('has-scroll-ink',!reduce.matches);if(reduce.matches)chapter?.style.removeProperty('--chapter-curve');else schedule()}
 function hide(){cancelAnimationFrame(frame);frame=0}
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});addEventListener('pagehide',hide);addEventListener('pageshow',schedule);document.addEventListener('visibilitychange',()=>{if(document.hidden)hide();else schedule()});reduce.addEventListener('change',preference);preference();
}
