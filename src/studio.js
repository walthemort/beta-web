import {t} from './locale.js';
import {mountReveals} from './scroll-reveal.js';
import {mountFloatingMenu} from './floating-menu.js';
import {mountHeroParallax} from './hero-parallax.js';
import {mountCreativeInteractions} from './creative-interactions.js';

mountReveals();mountFloatingMenu(t);
mountHeroParallax();
mountCreativeInteractions();

// Keep a direction while browsing; the existing inspiration board and brief read this same key.
const buttons=[...document.querySelectorAll('[data-studio-save]')];
const read=()=>{try{const saved=JSON.parse(localStorage.getItem('beta:inspiration')||'[]');return Array.isArray(saved)?saved.filter(value=>typeof value==='string'&&/^[a-z0-9-]{1,60}$/.test(value)):[]}catch{return[]}};
function update(){const saved=read();for(const button of buttons){const active=saved.includes(button.dataset.studioSave);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',t(active?'Fjern gemt retning':'Gem som inspiration')+' / '+button.dataset.name);button.title=t(active?'Fjern gemt retning':'Gem som inspiration')}}
for(const button of buttons)button.addEventListener('click',()=>{const slug=button.dataset.studioSave,saved=read(),active=saved.includes(slug);try{localStorage.setItem('beta:inspiration',JSON.stringify(active?saved.filter(value=>value!==slug):[...saved,slug]));update();document.querySelector('#studio-save-status').textContent=t(active?'Retning fjernet fra din inspiration.':'Retning gemt i din inspiration.');if(!active)window.dispatchEvent(new CustomEvent('beta:case-saved'))}catch{document.querySelector('#studio-save-status').textContent=t('Inspiration kunne ikke gemmes i denne browser.')}});
addEventListener('storage',update);update();

for(const anchor of document.querySelectorAll('#menu nav a')){const url=new URL(anchor.href,location.href);if(url.pathname.replace(/\/$/,'')===location.pathname.replace(/\/$/,''))anchor.setAttribute('aria-current','page')}
