/** Homepage service exploration. One open story; independent, persistent project choices. */
export function mountHomeServices(t){
 const root=document.querySelector('#services');if(!root)return;
 const rows=[...root.querySelectorAll('[data-service]')],names=rows.map(row=>row.dataset.service);
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),ease='cubic-bezier(.22,1,.36,1)';
 const list=root.querySelector('#selection-list'),card=root.querySelector('.selection-card');
 const status=root.querySelector('#service-selection-status'),images=[...root.querySelectorAll('.service-study-frame img')];
 let selected=new Set(),preview=0,previewRequest=0;
 try{const saved=JSON.parse(localStorage.getItem('beta:services')||'[]');if(Array.isArray(saved))selected=new Set(saved.filter(name=>names.includes(name)))}catch{}
 const panels=new Map(),visuals=new Set(),chipAnimations=new Set(),entrances=new Map();
 function animate(el,frames,options={}){
  if(reduce.matches)return null;
  const animation=el.animate(frames,{duration:420,easing:ease,...options});visuals.add(animation);
  animation.finished.catch(()=>{}).finally(()=>visuals.delete(animation));return animation;
 }
 async function showStudy(index){
  const request=++previewRequest;if(index===preview)return;
  images[index].loading='eager';try{await images[index].decode()}catch{return}
  if(request!==previewRequest)return;
  images.forEach((img,i)=>img.classList.toggle('is-active',i===index));preview=index;
  root.querySelector('#service-study-number').textContent=String(index+1).padStart(2,'0');
 }
 function settlePanel(panel,state){
  if(panels.get(panel)!==state)return;
  panels.delete(panel);panel.hidden=!state.open;panel.style.height='';panel.style.overflow='';
  state.animations.forEach(animation=>animation.cancel());
 }
 function disclose(row,open){
  const panel=row.querySelector('.service-body'),inner=panel.firstElementChild;
  const from=panel.hidden?0:panel.getBoundingClientRect().height,old=panels.get(panel);
  const content=[...inner.children],starts=content.map(el=>({opacity:getComputedStyle(el).opacity,transform:getComputedStyle(el).transform}));
  old?.animations.forEach(animation=>animation.cancel());
  panel.hidden=false;panel.inert=!open;panel.style.height='auto';panel.style.overflow='hidden';
  row.classList.toggle('is-open',open);row.querySelector('.service-toggle').setAttribute('aria-expanded',String(open));
  const state={open,targetHeight:inner.getBoundingClientRect().height,animations:[]};panels.set(panel,state);
  if(reduce.matches){settlePanel(panel,state);return}
  const height=panel.animate([{height:from+'px'},{height:(open?inner.getBoundingClientRect().height:0)+'px'}],{duration:open?560:360,easing:ease,fill:'both'});
  state.animations.push(height);
  content.forEach((el,i)=>{
   const start=from?starts[i]:{opacity:0,transform:'translateY(12px)'};
   state.animations.push(el.animate([start,{opacity:open?1:0,transform:open?'translateY(0)':'translateY(-6px)'}],{duration:open?420:180,delay:open?70+i*60:0,easing:ease,fill:'both'}));
  });
  Promise.allSettled(state.animations.map(animation=>animation.finished)).then(()=>settlePanel(panel,state));
 }
 function setOpen(row,open){
  if(open){for(const other of rows)if(other!==row&&other.classList.contains('is-open'))disclose(other,false);void showStudy(rows.indexOf(row))}
  disclose(row,open);
 }
 function selectionButton(row){
  const button=row.querySelector('.service-add');
  button.innerHTML='<span class="service-add-label"></span><span class="service-add-symbol" aria-hidden="true"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path class="service-add-plus" d="M10 4v12M4 10h12"/><path class="service-add-check" d="m4 10 4 4 8-8"/></svg></span>';
 }
 function save(){try{localStorage.setItem('beta:services',JSON.stringify([...selected]));return true}catch{return false}}
 function updateSelection(changed=null){
  // Keep keyed chips and their focused remove controls; animate their actual positions.
  for(const animation of chipAnimations)animation.cancel();chipAnimations.clear();
  const before=new Map([...list.querySelectorAll('[data-service-chip]')].map(el=>[el,el.getBoundingClientRect()]));
  const oldHeight=card.getBoundingClientRect().height;
  for(const row of rows){
   const active=selected.has(row.dataset.service),button=row.querySelector('.service-add');
   row.classList.toggle('is-selected',active);button.setAttribute('aria-pressed',String(active));
   button.setAttribute('aria-label',t(active?'Fjern':'Tilføj')+' '+t(row.dataset.service));
   button.querySelector('.service-add-label').textContent=t(active?'VALGT':'VÆLG');
  }
  for(const chip of list.querySelectorAll('[data-service-chip]'))if(!selected.has(chip.dataset.serviceChip))chip.remove();
  list.querySelector('.selection-empty')?.remove();
  for(const name of selected){
   let chip=[...list.children].find(el=>el.dataset.serviceChip===name);
   if(!chip){
    chip=document.createElement('li');chip.dataset.serviceChip=name;
    const label=document.createElement('span');label.textContent=t(rows.find(row=>row.dataset.service===name).querySelector('b').textContent);
    const remove=document.createElement('button');remove.type='button';remove.dataset.remove=name;remove.setAttribute('aria-label',t('Fjern')+' '+t(name));remove.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m6 6 8 8m0-8-8 8"/></svg>';
    remove.onclick=()=>{const fallback=rows.find(row=>row.dataset.service===name).querySelector('.service-add');fallback.focus({preventScroll:true});selected.delete(name);updateSelection(name)};
    chip.append(label,remove);list.append(chip);
   }
  }
  if(!selected.size){const empty=document.createElement('li');empty.className='selection-empty';empty.hidden=true;list.append(empty)}
  card.classList.toggle('has-selection',selected.size>0);root.querySelector('#selection-count').textContent=String(selected.size).padStart(2,'0');
  if(changed){
   const saved=save();status.textContent=saved?t(selected.has(changed)?'Service tilføjet.':'Service fjernet.')+' '+t(changed):t('Dit valg kunne ikke gemmes i denne browser.');
   for(const chip of list.children){const from=before.get(chip),to=chip.getBoundingClientRect();
    const animation=animate(chip,from?[{transform:`translate(${from.x-to.x}px,${from.y-to.y}px)`},{transform:'translate(0,0)'}]:[{opacity:0,transform:'translateY(8px) scale(.96)'},{opacity:1,transform:'translateY(0) scale(1)'}]);if(animation)chipAnimations.add(animation);
   }
   const newHeight=card.getBoundingClientRect().height;
   if(Math.abs(oldHeight-newHeight)>1){const a=animate(card,[{height:oldHeight+'px'},{height:newHeight+'px'}]);if(a)chipAnimations.add(a)}
  }
 }
 rows.forEach((row,index)=>{
  selectionButton(row);
  row.querySelector('.service-toggle').onclick=()=>setOpen(row,!row.classList.contains('is-open'));
  row.querySelector('.service-add').onclick=()=>{selected.has(row.dataset.service)?selected.delete(row.dataset.service):selected.add(row.dataset.service);updateSelection(row.dataset.service)};
  row.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&!rows.some(other=>other!==row&&other.classList.contains('is-open')))void showStudy(index)});
  row.addEventListener('focusin',()=>{entrances.get(row)?.cancel();if(!rows.some(other=>other!==row&&other.classList.contains('is-open')))void showStudy(index)});
 });
 root.querySelector('.service-list').addEventListener('pointerleave',()=>{const open=rows.findIndex(row=>row.classList.contains('is-open'));void showStudy(open<0?0:open)});
 updateSelection();
 // Entrance reveals happen once; hovering never starts an endless animation.
 const observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){
  rows.forEach((row,i)=>{const a=animate(row,[{opacity:0,transform:'translateY(16px)',clipPath:'inset(0 0 100% 0)'},{opacity:1,transform:'translateY(0)',clipPath:'inset(0 0 0% 0)'}],{duration:700,delay:i*65});if(a){entrances.set(row,a);a.finished.catch(()=>{}).finally(()=>entrances.delete(row))}});observer.disconnect();
 }},{threshold:.15});observer.observe(root.querySelector('.service-list'));
 reduce.addEventListener('change',()=>{if(reduce.matches){for(const [panel,state]of panels)settlePanel(panel,state);for(const animation of visuals)animation.cancel()}});
 // End a height tween before a responsive reflow so content cannot stay clipped.
 const resize=new ResizeObserver(()=>{for(const [panel,state]of panels){if(state.open&&Math.abs(panel.firstElementChild.getBoundingClientRect().height-Number(state.targetHeight))>1&&state.targetHeight!==undefined)settlePanel(panel,state)}});
 for(const row of rows)resize.observe(row.querySelector('.service-body-inner'));
}
