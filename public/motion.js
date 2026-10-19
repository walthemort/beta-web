export const motionOff=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const animations=new WeakMap();
export async function disclose(panel,open){
 const wasHidden=panel.hidden,from=wasHidden?0:panel.getBoundingClientRect().height,opacity=wasHidden?0:getComputedStyle(panel).opacity;
 animations.get(panel)?.cancel();panel.hidden=false;panel.inert=!open;panel.style.height='auto';
 const to=open?panel.scrollHeight:0;
 if(motionOff()){panel.hidden=!open;panel.style.height='';return true}
 panel.style.overflow='hidden';
 const animation=panel.animate([{height:`${from}px`,opacity},{height:`${to}px`,opacity:open?1:0}],{duration:open?420:300,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});animations.set(panel,animation);
 try{await animation.finished}catch{return false}
 if(animations.get(panel)!==animation)return false;panel.hidden=!open;panel.style.height='';panel.style.overflow='';animations.delete(panel);animation.cancel();return true;
}
export function enter(element){if(!motionOff())element.animate([{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)'}],{duration:400,easing:'cubic-bezier(.22,1,.36,1)'})}
const menuClosings=new WeakMap();
export function openMenu(dialog){const pending=menuClosings.get(dialog);if(pending){menuClosings.delete(dialog);pending.animation.cancel();pending.paused.forEach(a=>a.play())}dialog.removeAttribute('data-closing');if(!dialog.open)dialog.showModal();document.body.style.overflow='hidden'}
function closeMenu(dialog){
 if(!dialog.open)return Promise.resolve();const pending=menuClosings.get(dialog);if(pending)return pending.promise;
 if(motionOff()||!dialog.animate){dialog.close();document.body.style.overflow='';return Promise.resolve()}
 dialog.setAttribute('data-closing','');
 const from=getComputedStyle(dialog).transform,paused=dialog.getAnimations({subtree:true}).filter(a=>a instanceof CSSAnimation&&a.playState==='running');paused.forEach(a=>a.pause());
 const animation=dialog.animate([{transform:from},{transform:'translateX(100%)'}],{duration:180,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'}),state={animation,paused,promise:null};menuClosings.set(dialog,state);
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),settle=()=>{if(reduce.matches&&menuClosings.get(dialog)===state)animation.finish()};reduce.addEventListener('change',settle);
 state.promise=animation.finished.then(()=>{if(menuClosings.get(dialog)!==state)return;menuClosings.delete(dialog);dialog.close();dialog.removeAttribute('data-closing');animation.cancel();document.body.style.overflow=''}).catch(()=>{}).finally(()=>reduce.removeEventListener('change',settle));return state.promise;
}
export async function closeDialog(dialog){if(dialog.classList.contains('menu-dialog'))return closeMenu(dialog);if(!dialog.open)return;if(!motionOff()){try{await dialog.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-12px)'}],{duration:220,easing:'ease-in',fill:'forwards'}).finished}catch{}}dialog.close();dialog.getAnimations().forEach(a=>a.cancel());document.body.style.overflow=''}
