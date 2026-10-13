export function mountFloatingMenu(t){
 const header=document.querySelector('.site-header'),menu=document.querySelector('#menu'),trigger=document.querySelector('#menu-open');
 if(!header||!menu||!trigger||!('IntersectionObserver'in window))return;
 const button=document.createElement('button');button.className='floating-menu';button.type='button';
 button.setAttribute('aria-label',t('Åbn menu'));button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','menu');button.setAttribute('aria-expanded','false');button.inert=true;
 button.innerHTML='<span>MENU</span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h18M3 16h18"/></svg>';
 document.body.append(button);
 button.addEventListener('click',()=>trigger.click());
 const observer=new IntersectionObserver(entries=>{const show=entries[0].boundingClientRect.bottom<=0;button.classList.toggle('is-visible',show);button.inert=!show},{threshold:0});observer.observe(header);
 const state=new MutationObserver(()=>button.setAttribute('aria-expanded',String(menu.open)));state.observe(menu,{attributes:true,attributeFilter:['open']});
}
