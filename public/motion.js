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
export async function closeDialog(dialog){if(!dialog.open)return;if(!motionOff()){try{await dialog.animate([{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-12px)'}],{duration:220,easing:'ease-in',fill:'forwards'}).finished}catch{}}dialog.close();dialog.getAnimations().forEach(a=>a.cancel());document.body.style.overflow=''}
