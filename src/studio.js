import {mountEditorialHero} from './editorial-hero.js';
import {mountProjects} from './projects.js';
import {mountHomeServices} from './home-services.js';
import {t} from './locale.js';
import {mountReveals} from './scroll-reveal.js';
import {mountFloatingMenu} from './floating-menu.js';

mountEditorialHero();mountProjects(t);mountHomeServices(t);mountReveals();mountFloatingMenu(t);

// Keep a direction while browsing; the existing inspiration board and brief read this same key.
const read=()=>{try{const saved=JSON.parse(localStorage.getItem('beta:inspiration')||'[]');return Array.isArray(saved)?saved.filter(value=>typeof value==='string'&&/^[a-z0-9-]{1,60}$/.test(value)):[]}catch{return[]}};
function update(){const saved=read();for(const button of document.querySelectorAll('[data-studio-save]')){const active=saved.includes(button.dataset.studioSave);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',t(active?'Fjern gemt retning':'Gem som inspiration')+' / '+button.dataset.name);button.title=t(active?'Fjern gemt retning':'Gem som inspiration')}}
document.addEventListener('click',event=>{const button=event.target.closest('[data-studio-save]');if(!button)return;const slug=button.dataset.studioSave,saved=read(),active=saved.includes(slug),status=document.querySelector('#studio-save-status');try{localStorage.setItem('beta:inspiration',JSON.stringify(active?saved.filter(value=>value!==slug):[...saved,slug]));update();window.dispatchEvent(new CustomEvent('beta:inspiration-changed'));if(status)status.textContent=t(active?'Retning fjernet fra din inspiration.':'Retning gemt i din inspiration.');if(!active)window.dispatchEvent(new CustomEvent('beta:case-saved'))}catch{if(status)status.textContent=t('Inspiration kunne ikke gemmes i denne browser.')}});
addEventListener('storage',update);addEventListener('beta:portfolio-changed',update);update();

for(const anchor of document.querySelectorAll('#menu nav a')){const url=new URL(anchor.href,location.href);if(url.pathname.replace(/\/$/,'')===location.pathname.replace(/\/$/,'')||(/\/cases$/.test(url.pathname)&&location.pathname.startsWith(url.pathname+'/')))anchor.setAttribute('aria-current','page')}

for(const link of document.querySelectorAll('[data-back-to-top]'))link.addEventListener('click',event=>{event.preventDefault();document.querySelector('.site-header .brand')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})});
