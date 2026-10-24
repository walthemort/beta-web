import {t} from './locale.js';
import {disclose} from './motion.js';
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),animations=new Set(),disclosures=[];
function enter(el){if(reduce.matches)return;const animation=el.animate([{opacity:.35,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:260,easing:'cubic-bezier(.22,1,.36,1)'});animations.add(animation);animation.finished.catch(()=>{}).finally(()=>{animation.cancel();animations.delete(animation)})}
for(const root of document.querySelectorAll('[data-format-explorer]')){
 const tabs=[...root.querySelectorAll('[data-format]')],panels=[...root.querySelectorAll('[data-format-panel]')],stage=root.querySelector('.format-stage'),status=root.querySelector('[data-format-status]');let current='print',request=0;
 root.classList.add('is-format-enhanced');root.querySelector('.format-tabs').hidden=false;
 for(const panel of panels){panel.hidden=panel.dataset.formatPanel!==current;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby','format-tab-'+panel.dataset.formatPanel);panel.tabIndex=0}
 async function choose(button){
  const value=button.dataset.format,panel=panels.find(p=>p.dataset.formatPanel===value),token=++request;
  if(value===current){stage.setAttribute('aria-busy','false');return}
  stage.setAttribute('aria-busy','true');const images=[...panel.querySelectorAll('img')];images.forEach(img=>img.loading='eager');
  const result=await Promise.allSettled(images.map(img=>img.decode()));if(token!==request)return;
  if(result.some(item=>item.status==='rejected')){stage.setAttribute('aria-busy','false');status.textContent=t('Formatet kunne ikke indlæses. Prøv igen.');return}
  const previous=panels.find(p=>!p.hidden);if(previous?.contains(document.activeElement))button.focus({preventScroll:true});
  current=value;for(const p of panels)p.hidden=p!==panel;
  for(const tab of tabs){const active=tab===button;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1}
  stage.setAttribute('aria-busy','false');status.textContent=t('Viser format:')+' '+button.textContent.replace(/^\s*\d+\s*/,'').trim();enter(panel.querySelector('.format-scene'));
 }
 tabs.forEach(tab=>tab.addEventListener('click',()=>void choose(tab)));
 root.querySelector('.format-tabs').addEventListener('keydown',event=>{const index=tabs.indexOf(event.target);if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?tabs[0]:event.key==='End'?tabs.at(-1):tabs[(index+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length];next.focus({preventScroll:true});void choose(next)});
 addEventListener('pagehide',()=>{request++});
}
for(const root of document.querySelectorAll('[data-detail-explorer]')){
 const buttons=[...root.querySelectorAll('[data-detail]')],notes=[...root.querySelectorAll('[data-detail-note]')];let selected='0';
 function choose(button,animate=true){selected=button.dataset.detail;buttons.forEach(b=>{b.hidden=false;b.setAttribute('aria-pressed',String(b===button))});notes.forEach(note=>note.hidden=note.dataset.detailNote!==selected);if(animate)enter(notes.find(note=>!note.hidden));root.querySelector('[data-detail-status]').textContent=t('Detalje')+' '+(Number(selected)+1)+' / '+notes.length+' / '+button.getAttribute('aria-label')}
 choose(buttons[0],false);buttons.forEach(button=>button.addEventListener('click',()=>choose(button)));
 root.addEventListener('keydown',event=>{const index=buttons.indexOf(event.target);if(index<0||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=event.key==='Home'?buttons[0]:event.key==='End'?buttons.at(-1):buttons[(index+(event.key==='ArrowRight'?1:-1)+buttons.length)%buttons.length];next.focus({preventScroll:true});choose(next)});
}
for(const details of document.querySelectorAll('[data-experience-disclosure]')){
 const summary=details.querySelector('summary'),body=details.querySelector('.experience-disclosure'),state={details,summary,body,target:details.open};disclosures.push(state);body.hidden=!state.target;summary.setAttribute('aria-expanded',String(state.target));
 summary.addEventListener('click',event=>{event.preventDefault();state.target=!state.target;if(state.target)details.open=true;else if(body.contains(document.activeElement))summary.focus({preventScroll:true});summary.setAttribute('aria-expanded',String(state.target));void disclose(body,state.target).then(done=>{if(done&&!state.target)details.open=false})});
}
for(const root of document.querySelectorAll('[data-studio-archive]')){
 const filters=[...root.querySelectorAll('[data-archive-filter]')],cards=[...root.querySelectorAll('[data-archive-kind]')];root.querySelector('.archive-filters').hidden=false;
 function filter(button){let count=0;for(const card of cards){const show=button.dataset.archiveFilter==='all'||card.dataset.archiveKind===button.dataset.archiveFilter;if(!show&&card.contains(document.activeElement))button.focus({preventScroll:true});card.hidden=!show;card.inert=!show;if(show)count++}filters.forEach(b=>b.setAttribute('aria-pressed',String(b===button)));root.querySelector('[data-archive-status]').textContent=count+' '+t('studier');enter(root.querySelector('.archive-grid'))}
 filters.forEach(button=>button.addEventListener('click',()=>filter(button)));filter(filters[0]);
}
function settle(){for(const animation of animations)animation.cancel();animations.clear();for(const {details,summary,body,target}of disclosures){body.getAnimations().forEach(a=>a.cancel());body.hidden=!target;body.inert=!target;body.style.height='';body.style.overflow='';details.open=target;summary.setAttribute('aria-expanded',String(target))}}
reduce.addEventListener('change',()=>{if(reduce.matches)settle()});addEventListener('pagehide',settle);
