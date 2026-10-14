/** Demand-driven image drift: no renderer and no animation loop while idle/offscreen. */
export function mountHeroParallax(){
 const hero=document.querySelector('.agency-hero'),art=hero?.querySelector('.hero-artwork'),frame=hero?.querySelector('.agency-visual');
 if(!art||!frame||!('IntersectionObserver'in window)||!CSS.supports('translate','0px 1px'))return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),pointer=matchMedia('(hover: hover) and (pointer: fine) and (min-width: 601px)');
 const current={x:0,y:0},target={x:0,y:0},mouse={x:0,y:0};
 let raf=0,previous=0,visible=true,suspended=false,dirty=true,enabled=!reduce.matches;
 const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
 function paint(){art.style.setProperty('--art-x',current.x.toFixed(2)+'px');art.style.setProperty('--art-y',current.y.toFixed(2)+'px')}
 function pause(){cancelAnimationFrame(raf);raf=0;previous=0;hero.classList.remove('parallax-active')}
 function measure(){
  const rect=hero.getBoundingClientRect(),height=frame.clientHeight,mobile=innerWidth<=600;
  visible=rect.bottom>0&&rect.top<innerHeight;
  const progress=clamp(-rect.top/rect.height,0,1),range=Math.min(mobile?20:48,height*(mobile?.04:.06));
  target.x=pointer.matches?mouse.x*8:0;target.y=progress*range+(pointer.matches?mouse.y*5:0);dirty=false;
 }
 function draw(now){
  raf=0;if(!enabled||suspended||document.hidden){pause();return}
  if(dirty)measure();if(!visible){pause();return}
  const blend=1-Math.exp(-Math.min(previous?now-previous:16,50)/105);previous=now;
  current.x+=(target.x-current.x)*blend;current.y+=(target.y-current.y)*blend;paint();
  if(Math.abs(target.x-current.x)+Math.abs(target.y-current.y)>.02)raf=requestAnimationFrame(draw);
  else{current.x=target.x;current.y=target.y;paint();pause()}
 }
 function request(){dirty=true;if(!enabled||!visible||suspended||document.hidden||raf)return;hero.classList.add('parallax-active');raf=requestAnimationFrame(draw)}
 function move(event){if(!pointer.matches||event.pointerType==='touch')return;const rect=hero.getBoundingClientRect();mouse.x=clamp((event.clientX-rect.left)/rect.width*2-1,-1,1);mouse.y=clamp((event.clientY-rect.top)/rect.height*2-1,-1,1);request()}
 function leave(){mouse.x=mouse.y=0;request()}
 function preference(){
  enabled=!reduce.matches;hero.classList.toggle('has-parallax',enabled);
  if(!enabled){pause();current.x=current.y=target.x=target.y=mouse.x=mouse.y=0;paint()}
  else request();
 }
 function visibility(){if(document.hidden)pause();else request()}
 function hide(){suspended=true;pause()}
 function show(){suspended=false;preference()}
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible)request();else pause()});observer.observe(hero);
 addEventListener('scroll',request,{passive:true});addEventListener('resize',request,{passive:true});addEventListener('pagehide',hide);addEventListener('pageshow',show);
 hero.addEventListener('pointermove',move,{passive:true});hero.addEventListener('pointerleave',leave);document.addEventListener('visibilitychange',visibility);
 reduce.addEventListener('change',preference);pointer.addEventListener('change',leave);preference();
 return ()=>{pause();observer.disconnect();removeEventListener('scroll',request);removeEventListener('resize',request);removeEventListener('pagehide',hide);removeEventListener('pageshow',show);hero.removeEventListener('pointermove',move);hero.removeEventListener('pointerleave',leave);document.removeEventListener('visibilitychange',visibility);reduce.removeEventListener('change',preference);pointer.removeEventListener('change',leave);hero.classList.remove('has-parallax');art.style.removeProperty('--art-x');art.style.removeProperty('--art-y')};
}
