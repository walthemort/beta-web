import {t} from './locale.js';
import {mountReveals} from './scroll-reveal.js';
import {mountFloatingMenu} from './floating-menu.js';

mountReveals();mountFloatingMenu(t);

for(const anchor of document.querySelectorAll('#menu nav a')){const url=new URL(anchor.href,location.href);if(url.pathname.replace(/\/$/,'')===location.pathname.replace(/\/$/,'')||(/\/cases$/.test(url.pathname)&&location.pathname.startsWith(url.pathname+'/')))anchor.setAttribute('aria-current','page')}

for(const link of document.querySelectorAll('[data-back-to-top]'))link.addEventListener('click',event=>{event.preventDefault();document.querySelector('.site-header .brand')?.focus({preventScroll:true});window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})});
