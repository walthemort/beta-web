import {t} from './locale.js';
import {mountHeroFilm} from './hero-film.js';
mountHeroFilm();
const proof=document.querySelector('.review-proof');
if(proof){
 const label=proof.querySelector('#proof-label'),font=proof.querySelector('#proof-font'),palette=proof.querySelector('#proof-palette'),caption=proof.querySelector('#proof-caption'),reduce=matchMedia('(prefers-reduced-motion: reduce)'),running=new Set();
 const defaults=['#1B4DFF','#F6F4EF','#0B0B0E'];
 function foreground(hex){const value=hex.slice(1),full=value.length===3?[...value].map(c=>c+c).join(''):value,channels=[0,2,4].map(i=>parseInt(full.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*channels[0]+.7152*channels[1]+.0722*channels[2]>.179?'#0B0B0E':'#F6F4EF'}
 function paint(colors){palette.replaceChildren();if(!colors.length){const p=document.createElement('p');p.textContent=t('Ingen farver fundet.');palette.append(p);return}for(const color of colors.slice(0,5)){const chip=document.createElement('span');chip.style.setProperty('--proof-color',color);chip.style.setProperty('--proof-ink',foreground(color));chip.textContent=color.toUpperCase();palette.append(chip)}}
 function example(){label.textContent=t('EKSEMPEL / BETAS EGET UDTRYK');font.textContent='Inter';caption.textContent=t('Dine fundne styles vises, når dit review er klar.');palette.setAttribute('aria-label',t('Betas brandfarver'));proof.removeAttribute('data-live-proof');paint(defaults)}
 addEventListener('beta:review-state',event=>{if(['loading','closed','error'].includes(event.detail?.state))example()});
 addEventListener('beta:review-ready',event=>{
  const data=event.detail;if(!data||typeof data!=='object')return;
  const colors=Array.isArray(data.colors)?data.colors.filter(c=>typeof c==='string'&&/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(c)):[];
  const fonts=(Array.isArray(data.actualFonts)&&data.actualFonts.length?data.actualFonts:Array.isArray(data.fonts)?data.fonts:[]).filter(v=>typeof v==='string');
  label.textContent=t('FUNDNE STYLES / DIT WEBSITE');font.textContent=fonts.slice(0,2).join(' / ')||t('Ingen skriftnavne fundet.');
  let domain='';try{domain=new URL(data.url).hostname.replace(/^www\./,'')}catch{}
  caption.textContent=(domain?domain+' / ':'')+t('Et øjebliksbillede af de styles, vi kunne finde.');palette.setAttribute('aria-label',t('Fundne farver fra dit website'));proof.dataset.liveProof='true';paint(colors);
  if(!reduce.matches){const animation=palette.animate([{opacity:.25,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,easing:'ease-out'});running.add(animation);animation.finished.catch(()=>{}).finally(()=>running.delete(animation))}
 });
 function settle(){for(const animation of running)animation.cancel();running.clear()}
 reduce.addEventListener('change',()=>{if(reduce.matches)settle()});addEventListener('pagehide',settle);
}
