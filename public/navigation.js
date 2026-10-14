const reduce=()=>matchMedia('(prefers-reduced-motion: reduce)').matches;
// Native cross-document transitions where supported, with a short fallback elsewhere.
document.addEventListener('click',event=>{
 const anchor=event.target.closest('a[href]');if(!anchor||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||anchor.target||anchor.hasAttribute('download'))return;
 if(anchor.closest('#menu'))return;
 const url=new URL(anchor.href,location.href);if(url.origin!==location.origin||url.pathname===location.pathname||url.pathname.startsWith('/portal')||url.pathname.startsWith('/app'))return;
 const visual=anchor.querySelector('.case-art');
 if(visual&&!reduce()){document.querySelectorAll('.case-art').forEach(e=>e.style.viewTransitionName='');visual.style.viewTransitionName='case-visual'}
 if(anchor.classList.contains('client-logo')&&!reduce()){document.querySelectorAll('.client-logo').forEach(e=>e.style.viewTransitionName='');anchor.style.viewTransitionName='client-mark'}
 if('onpagereveal'in window||reduce())return;
 event.preventDefault();document.body.animate([{opacity:1},{opacity:0}],{duration:150,fill:'forwards'}).finished.then(()=>location.assign(url.href)).catch(()=>location.assign(url.href));
});
addEventListener('pageshow',()=>{document.body.getAnimations().forEach(a=>a.cancel());document.querySelectorAll('.case-art,.client-logo').forEach(e=>e.style.viewTransitionName='')});
// Browsers may abort a native transition on resize, Back, or an opted-out destination.
// Those are normal navigations, so consume the transition promises rather than surface errors.
for(const eventName of ['pagereveal','pageswap'])addEventListener(eventName,event=>{
 const transition=event.viewTransition;
 if(!transition)return;
 for(const key of ['ready','finished','updateCallbackDone'])transition[key]?.catch(()=>{});
});
