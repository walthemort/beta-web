/** A replaceable background film; navigation never waits for media. */
export function mountHeroFilm(t){
 const hero=document.querySelector('.agency-hero'),video=hero?.querySelector('#hero-film');if(!video)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),connection=navigator.connection;
 const controls=hero.querySelector('.hero-film-controls'),toggle=hero.querySelector('#hero-film-toggle'),open=hero.querySelector('#hero-film-open');
 const dialog=document.querySelector('#brand-film-dialog'),full=dialog.querySelector('#brand-film-full'),close=dialog.querySelector('#brand-film-close');
 let visible=true,userPaused=false,manual=false,failed=false,generation=0,oldOverflow='',closing=null,suspended=false;
 video.muted=true;video.defaultMuted=true;hero.classList.add('has-hero-film');controls.hidden=false;
 function label(){const playing=!video.paused;toggle.dataset.state=playing?'playing':'paused';toggle.setAttribute('aria-label',t(playing?'Sæt hero-filmen på pause':'Afspil hero-filmen'));toggle.title=toggle.getAttribute('aria-label')}
 function shouldPlay(){return visible&&!document.hidden&&!suspended&&!dialog.open&&!userPaused&&!failed&&((!reduce.matches&&!connection?.saveData)||manual)}
 function sync(){
  const current=++generation;if(!shouldPlay()){video.pause();label();return}
  if(!video.getAttribute('src'))video.src=innerWidth<=600?video.dataset.mobileSrc:video.dataset.desktopSrc;
  video.play().catch(()=>{if(current===generation&&!video.error){userPaused=true;label()}});
 }
 video.addEventListener('playing',()=>{hero.classList.add('has-hero-frame');label()});video.addEventListener('pause',label);
 video.addEventListener('error',()=>{failed=true;hero.classList.remove('has-hero-frame');toggle.hidden=true;video.pause()});
 toggle.onclick=()=>{if(video.paused){manual=true;userPaused=false}else userPaused=true;sync()};
 function finishClose(){closing?.cancel();closing=null;dialog.close();document.body.style.overflow=oldOverflow;open.focus({preventScroll:true});sync()}
 function closeFilm(){
  if(!dialog.open||closing)return;full.pause();
  if(reduce.matches){finishClose();return}
  closing=dialog.animate([{opacity:1,transform:'translateY(0) scale(1)'},{opacity:0,transform:'translateY(12px) scale(.985)'}],{duration:180,easing:'ease-out',fill:'forwards'});
  const animation=closing;animation.finished.then(()=>{if(closing===animation)finishClose()}).catch(()=>{});
 }
 open.onclick=()=>{
  if(dialog.open)return;oldOverflow=document.body.style.overflow;dialog.showModal();document.body.style.overflow='hidden';sync();
  if(!full.getAttribute('src'))full.src=full.dataset.src;
  full.play().catch(()=>{});close.focus({preventScroll:true});
  if(!reduce.matches)dialog.animate([{opacity:1,clipPath:'inset(45% 12% round 16px)'},{opacity:1,clipPath:'inset(0% 0% round 16px)'}],{duration:480,easing:'cubic-bezier(.22,1,.36,1)'});
 };
 close.onclick=closeFilm;dialog.addEventListener('cancel',event=>{event.preventDefault();closeFilm()});
 dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)closeFilm()});
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;sync()},{threshold:.05});observer.observe(hero);
 function preference(){manual=false;if(reduce.matches){if(closing)finishClose();for(const animation of dialog.getAnimations())animation.cancel()}sync()}
 reduce.addEventListener('change',preference);connection?.addEventListener('change',preference);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)full.pause();sync()});
 addEventListener('pagehide',()=>{suspended=true;video.pause();full.pause()});addEventListener('pageshow',()=>{suspended=false;sync()});
 label();sync();
}
