/** One project stage, native case links, and an index that never animates page height. */
export function mountProjects(t){
 const root=document.querySelector('[data-portfolio]');if(!root)return;
 const stage=root.querySelector('#portfolio-stage'),rows=[...root.querySelectorAll('[data-project]')],choices=rows.map(row=>row.querySelector('[data-project-choice]'));
 const templates=new Map([...root.querySelectorAll('[data-project-template]')].map(el=>[el.dataset.projectTemplate,el]));
 const cache=new Map(),reduce=matchMedia('(prefers-reduced-motion: reduce)'),empty=root.querySelector('#project-empty');
 let selected=stage.firstElementChild?.dataset.stageProject,request=0,filter='all',filterRequest=0,animation=null;
 if(selected)cache.set(selected,stage.firstElementChild);
 root.classList.add('is-enhanced');root.querySelector('.portfolio-filters')?.removeAttribute('hidden');
 for(const row of rows){row.querySelector('.portfolio-fallback').hidden=true;row.querySelector('.portfolio-choice').hidden=false;row.classList.toggle('is-selected',row.dataset.project===selected)}
 function paintChoice(){for(const row of rows){const active=row.dataset.project===selected;row.classList.toggle('is-selected',active);row.querySelector('.portfolio-choice').setAttribute('aria-pressed',String(active))}}
 async function choose(slug,{announce=true}={}){
  if(!templates.has(slug))return;const token=++request;if(slug===selected&&stage.firstElementChild?.dataset.stageProject===slug){stage.setAttribute('aria-busy','false');return}stage.setAttribute('aria-busy','true');
  let article=cache.get(slug);if(!article){article=templates.get(slug).content.firstElementChild.cloneNode(true);cache.set(slug,article)}
  const pictures=[...article.querySelectorAll('img')];pictures.forEach(img=>img.loading='eager');
  await Promise.allSettled(pictures.map(img=>img.decode()));if(token!==request)return;
  animation?.cancel();selected=slug;stage.hidden=false;stage.replaceChildren(article);paintChoice();stage.setAttribute('aria-busy','false');
  if(!reduce.matches)animation=article.animate([{opacity:.35,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'ease-out'});
  if(announce)root.querySelector('#project-filter-status').textContent=t('Viser')+' '+rows.find(row=>row.dataset.project===slug).querySelector('.portfolio-choice>span').textContent;
  dispatchEvent(new CustomEvent('beta:portfolio-changed'));
 }
 choices.forEach(button=>button.addEventListener('click',()=>void choose(button.dataset.projectChoice)));
 root.querySelector('.portfolio-rows').addEventListener('keydown',event=>{
  const button=event.target.closest('[data-project-choice]');if(!button||!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  const visible=rows.filter(row=>!row.hidden).map(row=>row.querySelector('.portfolio-choice')),index=visible.indexOf(button);let next;
  if(event.key==='Home')next=visible[0];else if(event.key==='End')next=visible.at(-1);else next=visible[(index+(['ArrowDown','ArrowRight'].includes(event.key)?1:-1)+visible.length)%visible.length];
  event.preventDefault();next.focus({preventScroll:true});next.scrollIntoView({block:'nearest',inline:'nearest',behavior:'instant'});void choose(next.dataset.projectChoice);
 });
 const saved=()=>{try{const value=JSON.parse(localStorage.getItem('beta:inspiration')||'[]');return Array.isArray(value)?value:[]}catch{return[]}};
 async function applyFilter(value){
  const generation=++filterRequest;request++;stage.setAttribute('aria-busy','false');filter=value;const keep=saved(),visible=rows.filter(row=>value==='all'||row.dataset.category===value||(value==='saved'&&keep.includes(row.dataset.project)));
  const removedFocus=rows.some(row=>row.contains(document.activeElement)&&!visible.includes(row))||stage.contains(document.activeElement)&&!visible.some(row=>row.dataset.project===selected);
  root.querySelectorAll('[data-project-filter]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.projectFilter===value)));
  for(const row of rows){row.hidden=!visible.includes(row);row.inert=row.hidden}
  empty.hidden=visible.length>0;root.querySelector('.portfolio-layout').hidden=visible.length===0;
  if(!visible.length){request++;stage.setAttribute('aria-busy','false');if(removedFocus)empty.querySelector('button').focus({preventScroll:true})}
  else if(!visible.some(row=>row.dataset.project===selected)){await choose(visible[0].dataset.project,{announce:false});if(generation!==filterRequest)return;if(removedFocus)visible[0].querySelector('.portfolio-choice').focus({preventScroll:true})}
  root.querySelector('#project-filter-status').textContent=visible.length+' '+t('projekter');
 }
 root.querySelectorAll('[data-project-filter]').forEach(button=>button.addEventListener('click',()=>void applyFilter(button.dataset.projectFilter)));
 root.querySelector('[data-project-reset]')?.addEventListener('click',()=>void applyFilter('all'));
 addEventListener('beta:inspiration-changed',()=>{if(filter==='saved')void applyFilter('saved')});
 addEventListener('storage',event=>{if(event.key==='beta:inspiration'&&filter==='saved')void applyFilter('saved')});
 if(new URLSearchParams(location.search).get('saved')==='1'&&root.querySelector('.portfolio-filters'))void applyFilter('saved');
 reduce.addEventListener('change',()=>{if(reduce.matches)animation?.cancel()});addEventListener('pagehide',()=>{request++;animation?.cancel()});
}
