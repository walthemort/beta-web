/** A short typeset entrance. The document is readable before JS and without motion. */
export function mountEditorialHero(){
 const hero=document.querySelector('.editorial-hero');if(!hero)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),animations=new Set();
 const settle=()=>{for(const animation of animations)animation.cancel();animations.clear()};
 if(!reduce.matches&&Element.prototype.animate){
  for(const [index,line]of [...hero.querySelectorAll('.hero-line>span,.hero-line>em')].entries()){
   const animation=line.animate([
    {transform:'translateY(115%) rotate(2deg)'},
    {transform:'translateY(0) rotate(0deg)'}
   ],{duration:720,delay:40+index*90,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'});
   animations.add(animation);animation.finished.catch(()=>{}).finally(()=>{animation.cancel();animations.delete(animation)});
  }
 }
 reduce.addEventListener('change',()=>{if(reduce.matches)settle()});
 hero.addEventListener('focusin',settle);addEventListener('pagehide',settle);
}
