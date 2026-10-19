/** Native project links enhanced with a focused, expanding preview and a compact archive. */
export function mountProjects(t){
 const root=document.querySelector('[data-project-collection]');if(!root)return;
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),ease='cubic-bezier(.22,1,.36,1)';
 const cards=[...root.querySelectorAll('[data-project]')],dialog=root.querySelector('#project-preview'),body=root.querySelector('#project-preview-body');
 const templates=[...root.querySelectorAll('[data-project-template]')],more=root.querySelector('.project-more'),extra=root.querySelector('#project-extra');
 let index=0,source=null,oldOverflow='',closing=null,filter='all',filterGeneration=0,extraAnimation=null;
 if(more)more.hidden=false;root.querySelector('.project-filters')?.removeAttribute('hidden');
 const running=new Set();
 function animate(el,frames,options={}){if(reduce.matches)return null;const animation=el.animate(frames,{duration:500,easing:ease,...options});running.add(animation);animation.finished.catch(()=>{}).finally(()=>running.delete(animation));return animation}
 function originClip(){
  const box=dialog.getBoundingClientRect(),origin=source?.getBoundingClientRect();
  if(!origin||origin.bottom<0||origin.top>innerHeight)return 'inset(45% 15% 45% 15% round 18px)';
  const x=Math.max(5,Math.min(95,(origin.left+origin.width/2-box.left)/box.width*100)),y=Math.max(5,Math.min(95,(origin.top+origin.height/2-box.top)/box.height*100));
  return `inset(${Math.max(0,y-8)}% ${Math.max(0,100-x-12)}% ${Math.max(0,100-y-8)}% ${Math.max(0,x-12)}% round 18px)`;
 }
 function content(next,transition=false){
  const restoreFocus=body.contains(document.activeElement);index=(next+templates.length)%templates.length;
  body.replaceChildren(templates[index].content.cloneNode(true));
  body.querySelectorAll('img').forEach(img=>img.loading='eager');if(restoreFocus)body.querySelector('h2').focus({preventScroll:true});
  root.querySelector('#project-preview-count').textContent=String(index+1).padStart(2,'0')+' / '+String(templates.length).padStart(2,'0');
  if(transition)animate(body,[{opacity:.3,transform:'translateX(12px)'},{opacity:1,transform:'translateX(0)'}],{duration:260});
 }
 function open(link){
  if(closing)return;if(extraAnimation)settleExtra(more.getAttribute('aria-expanded')==='true');source=link;oldOverflow=document.body.style.overflow;
  content(templates.findIndex(template=>template.dataset.projectTemplate===link.dataset.projectPreview));
  dialog.showModal();document.body.style.overflow='hidden';body.scrollTop=0;
  animate(dialog,[{clipPath:originClip()},{clipPath:'inset(0 0 0 0 round 18px)'}],{duration:620});
  animate(body.querySelector('.project-dialog-copy'),[{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'}],{duration:500,delay:160});
  body.querySelector('h2').focus({preventScroll:true});
 }
 function finishClose(){dialog.close();closing=null;for(const animation of running)if(animation.effect?.target===dialog||dialog.contains(animation.effect?.target))animation.cancel();document.body.style.overflow=oldOverflow;source?.focus({preventScroll:true})}
 function close(){
  if(!dialog.open||closing)return;
  const animation=animate(dialog,[{clipPath:getComputedStyle(dialog).clipPath},{clipPath:originClip()}],{duration:300});
  if(!animation){finishClose();return}closing=animation;animation.finished.then(()=>{if(closing===animation)finishClose()}).catch(()=>{});
 }
 for(const link of root.querySelectorAll('[data-project-preview]'))link.addEventListener('click',event=>{if(event.button||event.metaKey||event.ctrlKey||event.altKey||event.shiftKey)return;event.preventDefault();open(link)});
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const box=dialog.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)close()}});
 root.querySelector('[data-project-close]').onclick=close;
 root.querySelector('[data-project-prev]').onclick=()=>content(index-1,true);
 root.querySelector('[data-project-next]').onclick=()=>content(index+1,true);
 dialog.addEventListener('keydown',event=>{if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();content(index+(event.key==='ArrowLeft'?-1:1),true)}});
 function settleExtra(open){extraAnimation?.cancel();extraAnimation=null;extra.hidden=!open;extra.inert=!open;extra.style.height='';extra.style.overflow=''}
 if(more)more.onclick=()=>{
  const open=more.getAttribute('aria-expanded')!=='true',from=extra.hidden?0:extra.getBoundingClientRect().height;
  extraAnimation?.cancel();extra.hidden=false;extra.inert=!open;extra.style.height='auto';
  more.setAttribute('aria-expanded',String(open));more.firstElementChild.textContent=t(open?'VIS FÆRRE PROJEKTER':'VIS ALLE PROJEKTER');
  const height=open?extra.scrollHeight:0;
  if(reduce.matches){settleExtra(open);return}
  extra.style.overflow='hidden';const animation=animate(extra,[{height:from+'px',opacity:open?0.4:1},{height:height+'px',opacity:open?1:0}],{duration:560});extraAnimation=animation;
  if(open)extra.querySelectorAll('.project-card').forEach((card,i)=>animate(card,[{opacity:0,transform:'translateY(20px)'},{opacity:1,transform:'translateY(0)'}],{duration:480,delay:80+i*65}));
  animation.finished.then(()=>{if(extraAnimation===animation)settleExtra(open)}).catch(()=>{});
 };
 async function applyFilter(value){
  filter=value;const generation=++filterGeneration;
  const saved=(()=>{try{const raw=JSON.parse(localStorage.getItem('beta:inspiration')||'[]');return Array.isArray(raw)?raw:[]}catch{return[]}})();
  const positions=new Map(cards.filter(card=>!card.hidden).map(card=>[card,card.getBoundingClientRect()]));
  root.querySelectorAll('[data-project-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.projectFilter===value)));
  const visible=cards.filter(card=>value==='all'||value===card.dataset.category||(value==='saved'&&saved.includes(card.dataset.project)));
  const exiting=cards.filter(card=>!card.hidden&&!visible.includes(card));
  await Promise.allSettled(exiting.map(card=>animate(card,[{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.97)'}],{duration:140})?.finished));
  if(generation!==filterGeneration)return;
  for(const card of cards){const show=visible.includes(card);card.hidden=!show;card.inert=!show}
  visible.forEach((card,i)=>{const from=positions.get(card),to=card.getBoundingClientRect();animate(card,from?[{transform:`translate(${from.x-to.x}px,${from.y-to.y}px)`},{transform:'translate(0,0)'}]:[{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'translateY(0)'}],{duration:420,delay:from?0:Math.min(i*35,100)})});
  root.querySelector('#project-empty').hidden=visible.length>0;
  root.querySelector('#project-filter-status').textContent=visible.length+' '+t('projekter');
 }
 root.querySelectorAll('[data-project-filter]').forEach(button=>button.onclick=()=>void applyFilter(button.dataset.projectFilter));
 root.querySelector('[data-project-reset]')?.addEventListener('click',()=>void applyFilter('all'));
 addEventListener('beta:inspiration-changed',()=>{if(filter==='saved')void applyFilter('saved')});
 addEventListener('storage',event=>{if(event.key==='beta:inspiration'&&filter==='saved')void applyFilter('saved')});
 if(!more&&new URLSearchParams(location.search).get('saved')==='1')void applyFilter('saved');
 reduce.addEventListener('change',()=>{if(!reduce.matches)return;if(closing)finishClose();if(extraAnimation)settleExtra(more.getAttribute('aria-expanded')==='true');for(const animation of running)animation.cancel()});
 addEventListener('resize',()=>{if(extraAnimation)settleExtra(more.getAttribute('aria-expanded')==='true')},{passive:true});
}
