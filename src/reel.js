import {t} from './locale.js';
const reduce=matchMedia('(prefers-reduced-motion: reduce)');let session=null;
function clean(s){if(session!==s)return;s.video.pause();s.video.removeAttribute('src');s.video.load();s.dialog.close();s.dialog.remove();document.body.style.overflow=s.overflow;session=null;if(s.opener.isConnected)s.opener.focus({preventScroll:true})}
async function close(){const s=session;if(!s||s.closing)return;s.closing=true;s.video.pause();s.entry?.cancel();if(!reduce.matches){s.exit=s.dialog.animate([{opacity:1},{opacity:0}],{duration:160,fill:'forwards'});try{await s.exit.finished}catch{}}if(session===s&&s.closing)clean(s)}
function open(opener){
 if(session){if(session.closing){session.closing=false;session.exit?.cancel();session.exit=null;void session.video.play().catch(()=>{})}session.dialog.querySelector('button').focus();return}
 const dialog=document.createElement('dialog');dialog.className='reel-dialog';dialog.setAttribute('aria-labelledby','reel-title');
 const head=document.createElement('div');head.className='reel-head';const title=document.createElement('h2');title.id='reel-title';title.textContent=t('BETA / STUDIEREEL / 00:24');const dismiss=document.createElement('button');dismiss.type='button';dismiss.textContent=t('LUK ×');dismiss.setAttribute('aria-label',t('Luk studiereel'));head.append(title,dismiss);
 const video=document.createElement('video');video.controls=true;video.playsInline=true;video.muted=true;video.preload='metadata';video.src='/work/beta-studio-reel.mp4';video.setAttribute('aria-label',t('Beta studiereel med visuelle konceptstudier'));video.setAttribute('aria-describedby','reel-description');
 const description=document.createElement('p');description.id='reel-description';description.textContent=t('24 sekunder med Forma, Offscript og Betas visuelle studier. Starter uden lyd; lyden kan slås til i afspilleren.');
 const transcript=document.createElement('details'),summary=document.createElement('summary'),text=document.createElement('p');summary.textContent=t('Filmforløb');text.textContent=t('Beta åbner filmen. Forma udforsker materialer, mellemrum og et digitalt udtryk. Offscript skifter til blå, store ord og kampagneformater. Filmen slutter med Beta. Alt vist arbejde er konceptstudier.');transcript.append(summary,text);
 const error=document.createElement('p');error.className='reel-error';error.hidden=true;error.setAttribute('role','status');const message=document.createElement('span');message.textContent=t('Filmen kunne ikke afspilles. ');const retry=document.createElement('a');retry.href='/work/beta-studio-reel.mp4';retry.textContent=t('Åbn videofilen');error.append(message,retry);
 dialog.append(head,video,description,transcript,error);document.body.append(dialog);const s={dialog,video,opener,overflow:document.body.style.overflow,closing:false};session=s;dialog.showModal();document.body.style.overflow='hidden';dismiss.focus();
 dismiss.addEventListener('click',()=>void close());dialog.addEventListener('cancel',event=>{event.preventDefault();void close()});dialog.addEventListener('close',()=>{if(session===s)clean(s)});
 video.addEventListener('error',()=>error.hidden=false);video.addEventListener('playing',()=>error.hidden=true);
 if(!reduce.matches)s.entry=dialog.animate([{opacity:.5},{opacity:1}],{duration:200});
 void video.play().catch(()=>{});
}
document.addEventListener('click',event=>{const link=event.target.closest('[data-open-reel]');if(!link||event.defaultPrevented||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||event.button!==0)return;event.preventDefault();open(link)});
reduce.addEventListener('change',()=>{if(!reduce.matches||!session)return;session.entry?.cancel();if(session.closing)session.exit?.finish()});
addEventListener('pagehide',()=>{if(session){session.closing=true;clean(session)}});
