/** A change of art direction, with native case links and no continuous rendering. */
export function mountEditorialHero(t){
 const hero=document.querySelector('.editorial-hero');if(!hero)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),animations=new Set();
 const gallery=hero.querySelector('#hero-gallery'),panels=[...hero.querySelectorAll('[data-hero-panel]')],buttons=[...hero.querySelectorAll('[data-hero-choice]')],status=hero.querySelector('#hero-direction-status');
 let current=hero.dataset.heroDirection,request=0,leaving=false;
 function settle(){for(const animation of animations)animation.cancel();animations.clear()}
 function play(el,frames,options){if(reduce.matches||!Element.prototype.animate)return;const animation=el.animate(frames,{easing:'cubic-bezier(.22,1,.36,1)',fill:'both',...options});animations.add(animation);animation.finished.catch(()=>{}).finally(()=>{animation.cancel();animations.delete(animation)})}
 if(!reduce.matches){
  for(const [index,line]of [...hero.querySelectorAll('.hero-line>span,.hero-line>em')].entries())play(line,[{transform:'translateY(110%) rotate(3deg)'},{transform:'translateY(0) rotate(0deg)'}],{duration:760,delay:40+index*90});
  const picture=hero.querySelector('[data-hero-panel]:not([hidden]) .hero-image-cut');if(picture)play(picture,[{opacity:.5,transform:'translateX(32px)'},{opacity:1,transform:'translateX(0)'}],{duration:760,delay:140});
 }
 hero.querySelector('.hero-directions')?.removeAttribute('hidden');
 async function choose(button){
  const direction=button.dataset.heroChoice,panel=panels.find(el=>el.dataset.heroPanel===direction);if(!panel)return;
  const token=++request;if(direction===current){gallery.setAttribute('aria-busy','false');return}
  gallery.setAttribute('aria-busy','true');status.textContent='';const img=panel.querySelector('img');img.loading='eager';
  try{await img.decode()}catch{if(token!==request||leaving)return;gallery.setAttribute('aria-busy','false');status.textContent=t('Billedet kunne ikke indlæses. Prøv igen.');return}
  if(token!==request||leaving)return;
  // A focused case link must never disappear under a keyboard user during decoding.
  const previous=panels.find(el=>!el.hidden);if(previous?.contains(document.activeElement))button.focus({preventScroll:true});
  settle();current=direction;hero.dataset.heroDirection=direction;
  for(const el of panels)el.hidden=el!==panel;
  for(const el of buttons)el.setAttribute('aria-pressed',String(el===button));
  gallery.setAttribute('aria-busy','false');status.textContent=t('Viser perspektiv:')+' '+t(direction==='offscript'?'Kant':'Ro');
  play(panel.querySelector('.hero-image-cut'),[{opacity:.4,transform:'translateX(26px)'},{opacity:1,transform:'translateX(0)'}],{duration:520});
  play(panel.querySelector('.hero-art-caption'),[{opacity:0,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,delay:100});
 }
 for(const button of buttons)button.addEventListener('click',()=>void choose(button));
 hero.querySelector('.hero-directions')?.addEventListener('keydown',event=>{
  const button=event.target.closest('[data-hero-choice]');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const next=event.key==='Home'?buttons[0]:event.key==='End'?buttons.at(-1):buttons[(buttons.indexOf(button)+1)%buttons.length];next.focus({preventScroll:true});void choose(next);
 });
 reduce.addEventListener('change',()=>{if(reduce.matches)settle()});
 hero.addEventListener('focusin',settle);addEventListener('pagehide',()=>{leaving=true;request++;settle()});
 addEventListener('pageshow',()=>{leaving=false;gallery.setAttribute('aria-busy','false')});
}
