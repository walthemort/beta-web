const $=s=>document.querySelector(s);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function decorateArrows(root=document.body){
 const paths={'↗':'M4 20 20 4M4 4h16v16','→':'M3 12h18M13 4l8 8-8 8','↓':'M12 3v18M4 13l8 8 8-8','↑':'M12 21V3M4 11l8-8 8 8'};
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT),nodes=[];let node;
 while(node=walker.nextNode())if(!['SCRIPT','STYLE','TEXTAREA'].includes(node.parentElement?.tagName)&&/[↗→↓↑]/.test(node.textContent))nodes.push(node);
 for(const node of nodes){const fragment=document.createDocumentFragment();for(const part of node.textContent.split(/([↗→↓↑])/)){if(!paths[part]){fragment.append(document.createTextNode(part));continue}const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','ui-arrow');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[part]);path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.6');svg.append(path);fragment.append(svg)}node.replaceWith(fragment)}
}
const motionOff=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const panelAnimations=new WeakMap();
async function animateDisclosure(panel,open){
 const wasHidden=panel.hidden;
 const from=wasHidden?0:panel.getBoundingClientRect().height;
 const fromPadding=wasHidden?'0px':getComputedStyle(panel).paddingBottom;
 const opacity=panel.hidden?0:Number(getComputedStyle(panel).opacity);
 panelAnimations.get(panel)?.cancel();panelAnimations.delete(panel);
 panel.hidden=false;panel.inert=!open;panel.style.height='auto';
 const to=open?panel.scrollHeight:0;
 const toPadding=open?getComputedStyle(panel).paddingBottom:'0px';
 if(motionOff()||!panel.animate){panel.hidden=!open;panel.style.height='';panel.style.overflow='';panel.style.opacity='';return true}
 panel.style.height=`${from}px`;panel.style.overflow='hidden';
 const animation=panel.animate([{height:`${from}px`,opacity,paddingBottom:fromPadding},{height:`${to}px`,opacity:open?1:0,paddingBottom:toPadding}],{duration:open?460:320,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'});
 panelAnimations.set(panel,animation);
 try{await animation.finished}catch{return false}
 if(panelAnimations.get(panel)!==animation)return false;
 panel.hidden=!open;panel.style.height='';panel.style.overflow='';panel.style.opacity='';panelAnimations.delete(panel);animation.cancel();return true;
}
const heightAnimations=new WeakMap();
function animateHeightChange(element,from){
 heightAnimations.get(element)?.cancel();element.style.overflow='';
 const to=element.getBoundingClientRect().height;if(motionOff()||Math.abs(from-to)<1)return;
 element.style.overflow='hidden';
 const animation=element.animate([{height:`${from}px`},{height:`${to}px`}],{duration:380,easing:'cubic-bezier(.22,1,.36,1)'});
 heightAnimations.set(element,animation);
 animation.finished.catch(()=>{}).then(()=>{if(heightAnimations.get(element)===animation){element.style.overflow='';heightAnimations.delete(element)}});
}
const modal=$('#modal'),content=$('#modal-content'),menu=$('#menu');
const lockScroll=()=>{document.body.style.overflow=modal.open||menu.open?'hidden':''};
const closingDialogs=new WeakMap();
function showDialog(dialog){const pending=closingDialogs.get(dialog);if(pending){closingDialogs.delete(dialog);pending.animation.cancel();pending.paused?.forEach(a=>a.play())}dialog.removeAttribute('data-closing');if(!dialog.open)dialog.showModal();lockScroll()}
function closeDialog(dialog){
 if(!dialog.open)return Promise.resolve();const pending=closingDialogs.get(dialog);if(pending)return pending.promise;
 if(motionOff()||!dialog.animate){dialog.close();return Promise.resolve()}
 dialog.setAttribute('data-closing','');
 const current=getComputedStyle(dialog);
 const isMenu=dialog===menu;
 const paused=isMenu?dialog.getAnimations({subtree:true}).filter(a=>a instanceof CSSAnimation&&a.playState==='running'):[];paused.forEach(a=>a.pause());
 const frames=isMenu?[{opacity:1,transform:current.transform},{opacity:1,transform:'translateX(100%)'}]:[{opacity:current.opacity,transform:current.transform},{opacity:0,transform:'translateY(12px) scale(.97)'}];
 const animation=dialog.animate(frames,{duration:isMenu?260:220,easing:isMenu?'cubic-bezier(.22,1,.36,1)':'cubic-bezier(.4,0,1,1)',fill:'forwards'});
 const state={animation,paused,promise:null};closingDialogs.set(dialog,state);
 const reduce=matchMedia('(prefers-reduced-motion: reduce)'),settle=()=>{if(reduce.matches&&closingDialogs.get(dialog)===state)animation.finish()};reduce.addEventListener('change',settle);
 state.promise=animation.finished.then(()=>{if(closingDialogs.get(dialog)!==state)return;closingDialogs.delete(dialog);dialog.close();dialog.removeAttribute('data-closing');animation.cancel()}).catch(()=>{}).finally(()=>reduce.removeEventListener('change',settle));return state.promise;
}
function openModal(html){
 const alreadyOpen=modal.open,from=content.getBoundingClientRect().height;
 content.innerHTML=html;decorateArrows(content);showDialog(modal);
 if(alreadyOpen){animateHeightChange(content,from);if(!motionOff())content.animate([{opacity:0,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:300,easing:'ease-out'});content.querySelector('input,button')?.focus({preventScroll:true})}
}
$('#modal-close').onclick=()=>closeDialog(modal);$('#menu-close').onclick=()=>closeDialog(menu);
for(const dialog of [modal,menu]){dialog.addEventListener('close',lockScroll);dialog.addEventListener('cancel',e=>{e.preventDefault();void closeDialog(dialog)});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)void closeDialog(dialog)}})}
$('#menu-open').onclick=()=>showDialog(menu);
menu.querySelectorAll('a').forEach(a=>a.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();void closeDialog(menu).then(()=>{if(a.getAttribute('href').startsWith('#')){$(a.getAttribute('href'))?.scrollIntoView({behavior:motionOff()?'instant':'smooth'});history.replaceState(null,'',a.getAttribute('href'))}else window.location.assign(a.href)})}));
const services=[...document.querySelectorAll('[data-service]')],names=services.map(el=>el.dataset.service);
let selected=new Set();try{selected=new Set(JSON.parse(localStorage.getItem('beta:services')||'[]').filter(n=>names.includes(n)))}catch{}
function updateSelection(animate=true){
 const previousHeight=$('#selection-list').getBoundingClientRect().height;
 for(const el of services){const active=selected.has(el.dataset.service),button=el.querySelector('.service-add');el.classList.toggle('is-selected',active);button.setAttribute('aria-pressed',String(active));button.setAttribute('aria-label',`${active?'Fjern':'Tilføj'} ${el.dataset.service}`);button.textContent=active?'VALGT ✓':'VÆLG ↗';decorateArrows(button)}
 $('#selection-count').textContent=String(selected.size).padStart(2,'0');$('#selection-list').innerHTML=selected.size?[...selected].map(n=>`<li><span>${esc(n)}</span><button data-remove="${esc(n)}" aria-label="Fjern ${esc(n)}">×</button></li>`).join(''):'<li class="selection-empty">Vælg en eller flere services.<br>Vi sammensætter et tilbud til dig.</li>';
 $('#selection-list').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{selected.delete(b.dataset.remove);updateSelection()});
 if(animate){animateHeightChange($('#selection-list'),previousHeight);if(!motionOff())$('#selection-list').animate([{opacity:.3},{opacity:1}],{duration:250})}
 try{localStorage.setItem('beta:services',JSON.stringify([...selected]))}catch{}
}
for(const el of services){el.querySelector('.service-toggle').onclick=()=>{const button=el.querySelector('.service-toggle'),panel=el.querySelector('.service-body'),open=button.getAttribute('aria-expanded')==='true';button.setAttribute('aria-expanded',String(!open));void animateDisclosure(panel,!open);el.classList.toggle('is-open',!open)};el.querySelector('.service-add').onclick=()=>{selected.has(el.dataset.service)?selected.delete(el.dataset.service):selected.add(el.dataset.service);updateSelection()}}
let siteConfig={};fetch('/api/site-config').then(r=>r.json()).then(c=>{siteConfig=c}).catch(()=>{});
function contactDestination(){if(siteConfig.bookingURL){try{const u=new URL(siteConfig.bookingURL);if(u.protocol==='https:'||u.protocol==='http:')return u.href}catch{}}if(siteConfig.contactEmail&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(siteConfig.contactEmail))return `mailto:${siteConfig.contactEmail}`;return null}
function openBrief(){
 openModal(`<span class="eyebrow">DIT NÆSTE PROJEKT / BETA</span><h2 id="modal-heading">FRA IDÉ<br>TIL <span style="color:var(--blue)">VIRKELIGHED.</span></h2><p>${selected.size?`Dit valg: ${[...selected].map(esc).join(' / ')}`:'Fortæl os om din idé. Vi hjælper med at finde den rigtige retning.'}</p><label for="brief-company">Virksomhed / projektnavn</label><input id="brief-company" autocomplete="organization" placeholder="Hvad hedder dit projekt?"><label for="brief-description">Din idé</label><textarea id="brief-description" placeholder="Hvad vil du skabe? Hvad er målet? Og hvad har du allerede klar?" maxlength="5000"></textarea><div class="brief-actions"><a class="outline-button" href="/start">ÅBN PROJEKTPLANLÆGGER ↗</a><button id="brief-download" class="button-blue">DOWNLOAD PROJEKTBRIEF ↗</button>${contactDestination()?'<button id="brief-contact" class="outline-button">BOOK EN SAMTALE ↗</button>':''}</div><p id="brief-status" role="status">Briefen gemmes på din enhed. Den bliver ikke sendt automatisk.</p>`);
 $('#brief-download').onclick=()=>{const description=$('#brief-description').value.trim();if(!description){$('#brief-status').textContent='Skriv lidt om din idé, før du downloader din brief.';$('#brief-description').focus();return}const text=`BETA / PROJEKTBRIEF\n\nProjekt: ${$('#brief-company').value.trim()||'Ikke angivet'}\nServices: ${[...selected].join(', ')||'Afklares sammen'}\n\n${description}\n\nDenne brief er ikke en bestilling og er ikke sendt til Beta.`;const u=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=u;a.download='beta-projektbrief.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000);$('#brief-status').textContent='Din brief er downloadet. Gem den til vores første samtale.'};
 if($('#brief-contact'))$('#brief-contact').onclick=()=>window.location.assign(contactDestination());
}
$('#brief-open').onclick=openBrief;document.querySelector('[data-booking]').onclick=()=>{const destination=contactDestination();destination?window.location.assign(destination):openBrief()};
const ratingLabels={'A promising foundation':'ET STÆRKT UDGANGSPUNKT','Room for improvement':'PLADS TIL FORBEDRING'};
const hero=$('#review'),shell=$('#review-shell'),expansion=$('#review-expansion'),report=$('#review-result');
let loadingTimer=null;
let reviewCycle=0;
function expandReview(){reviewCycle++;hero.classList.add('has-review');shell.classList.add('is-expanded');expansion.inert=false;$('#review-submit').setAttribute('aria-expanded','true')}
async function closeReview(){const cycle=++reviewCycle;clearInterval(loadingTimer);shell.classList.remove('is-expanded');expansion.inert=true;$('#review-submit').setAttribute('aria-expanded','false');$('#review-status').textContent='';$('#url').focus({preventScroll:true});expansion.getBoundingClientRect();if(!motionOff())await Promise.all(expansion.getAnimations().map(a=>a.finished.catch(()=>{})));if(cycle===reviewCycle)hero.classList.remove('has-review')}
$('#url').addEventListener('focus',()=>hero.classList.add('is-editing'));$('#url').addEventListener('blur',()=>hero.classList.remove('is-editing'));
$('#review-submit').setAttribute('aria-controls','review-expansion');$('#review-submit').setAttribute('aria-expanded','false');
function showLoading(){
 report.innerHTML='<div class="scan-head"><p>Vi finder dit brands byggesten.</p><span class="scan-live"><i></i> ANALYSERER</span></div><div class="scan-grid" aria-hidden="true"><div class="scan-block"><span>01 / FARVER</span><div class="skeleton"></div><div class="skeleton line"></div></div><div class="scan-block"><span>02 / TYPOGRAFI</span><div class="skeleton"></div><div class="skeleton line"></div></div><div class="scan-block"><span>03 / ASSETS</span><div class="skeleton"></div><div class="skeleton line"></div></div></div><div class="scan-steps" aria-hidden="true"><span class="is-active">Henter hjemmeside</span><span>Leder efter visuelle detaljer</span><span>Samler dit review</span></div>';
 let i=0;loadingTimer=setInterval(()=>{const steps=report.querySelectorAll('.scan-steps span');steps.forEach(el=>el.classList.remove('is-active'));i=(i+1)%3;steps[i]?.classList.add('is-active')},1900);
}
function reviewError(message){const from=report.getBoundingClientRect().height;report.innerHTML=`<div class="review-error"><span class="report-label">VI KUNNE IKKE GENNEMFØRE REVIEWET</span><h3>Et lille bump på vejen.</h3><p>${esc(message)}</p><button id="review-reset" class="outline-button">PRØV EN ANDEN ADRESSE ↗</button></div>`;animateHeightChange(report,from);decorateArrows(report);$('#review-reset').onclick=closeReview}
function renderReview(data){
 const from=report.getBoundingClientRect().height;
 const colors=(data.colors||[]).filter(c=>/^#[\da-f]{3}(?:[\da-f]{3})?$/i.test(c));const fonts=Array.isArray(data.fonts)?data.fonts:[];const sizes=Array.isArray(data.sizes)?data.sizes:[];
 let hostname;try{hostname=new URL(data.url).hostname.replace(/^www\./,'')}catch{hostname=$('#url').value}
 report.innerHTML=`<div class="report-head"><p class="report-site">${esc(hostname)}</p><span class="report-badge">FØRSTE KIG</span></div><div class="report-grid"><article class="report-card"><span class="report-label">01 / FARVEPALETTE</span><h3>Dit brands farver.</h3>${colors.length?`<div class="report-palette">${colors.map((c,i)=>`<button class="report-swatch" data-color="${c}" style="background:${c};--i:${i}" aria-label="Kopiér farvekode ${c}"><span>${c}</span></button>`).join('')}</div>`:'<p>Vi fandt ingen farvekoder i de kilder, vi kunne læse.</p>'}</article><article class="report-card"><span class="report-label">02 / TYPOGRAFI</span><div class="report-font-preview" aria-hidden="true">Aa</div><p class="report-font-name">${fonts.length?fonts.map(esc).join('<br>'):'Ingen fontdefinitioner fundet.'}</p>${sizes.length?`<div class="type-sizes">${sizes.slice(0,5).map(s=>`<span>${esc(s)}</span>`).join('')}</div>`:''}<p class="report-font-evidence">Skriftnavne fra kildekoden. Aa er en illustration.</p></article><article class="report-card"><span class="report-label">03 / BRAND ASSETS</span><div class="asset-symbol" aria-hidden="true">${data.svg?'SVG':'?'}</div><h3>${data.svg?'SVG fundet.':'Et nærmere kig.'}</h3><p>${data.logoSvg?'En mulig logo-reference i SVG-format blev fundet.':data.svg?'SVG-assets findes på siden. Det er ikke nødvendigvis dit logo.':'Ingen SVG-assets fundet i de læste kilder.'}</p></article></div><div class="report-verdict"><div><span class="report-label">VORES FØRSTE INDIKATION</span><h3>${esc(ratingLabels[data.rating]||'ET NÆRMERE KIG VÆRD')}</h3></div><div class="report-actions"><button id="guide-download">GEM BRANDGUIDE ↓</button><button id="review-brief" class="report-booking">TAG NÆSTE SKRIDT ↗</button></div></div><div class="report-foot"><p>${esc(data.note||'Et første kig på sidens kildekode. Det renderede design og visuel kvalitet kræver et nærmere review.')}</p><button id="review-reset">LUK REVIEW</button></div>`;
 animateHeightChange(report,from);decorateArrows(report);$('#review-brief').onclick=openBrief;$('#review-reset').onclick=closeReview;
 $('#guide-download').onclick=()=>{const text=`BETA / INDLEDENDE BRANDGUIDE\n\nWebsite: ${data.url}\nFarver: ${colors.join(', ')||'Ikke fundet'}\nTypografi: ${fonts.join(', ')||'Ikke fundet'}\nSkriftstørrelser (${data.rendered?(data.view==='mobile'?'mobil':'desktop'):'kildekode'}): ${sizes.join(', ')||'Ikke fundet'}\nSVG-assets: ${data.svg?'Fundet':'Ikke fundet'}\nVurdering: ${ratingLabels[data.rating]||data.rating}\n\n${data.note}`;const u=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=u;a.download='beta-brandguide.txt';a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);$('#review-status').textContent='Din indledende brandguide er downloadet.'};
 window.betaLatestReview=data;window.dispatchEvent(new CustomEvent('beta:review-ready',{detail:data}));
 report.querySelectorAll('[data-color]').forEach(button=>button.onclick=async()=>{try{await navigator.clipboard.writeText(button.dataset.color);$('#review-status').textContent=`${button.dataset.color} kopieret.`}catch{$('#review-status').textContent=`Farvekode: ${button.dataset.color}`}});
}
window.betaRenderReview=renderReview;
$('#review-form').onsubmit=async e=>{
 e.preventDefault();const button=$('#review-submit'),status=$('#review-status');if(button.disabled)return;button.disabled=true;status.textContent='Vi undersøger dit websites visuelle fundament…';$('#review-form').setAttribute('aria-busy','true');$('#review-result').setAttribute('aria-busy','true');expandReview();showLoading();
 try{const response=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:$('#url').value.trim()}),signal:AbortSignal.timeout(45000)});const data=await response.json();if(!response.ok)throw Error(data.error);clearInterval(loadingTimer);renderReview(data);status.textContent='Dit review er klar. Farver, typografi og assets vises herunder.'}
 catch(err){clearInterval(loadingTimer);const raw=err.message;const message=/public website|private/i.test(raw)?'Indsæt en offentlig hjemmeside. Lokale og private adresser kan ikke analyseres.':/URL|Invalid|includes/i.test(raw)?'Tjek adressen og prøv igen. Fx dinvirksomhed.dk.':/Timeout|abort|time/i.test(raw)?'Websitet svarede ikke i tide. Prøv igen om lidt.':'Vi kunne ikke læse websitet lige nu. Det kan skyldes adgangsbegrænsninger. Prøv en anden adresse eller kom tilbage senere.';reviewError(message);status.textContent=message}
 finally{clearInterval(loadingTimer);button.disabled=false;$('#review-form').removeAttribute('aria-busy');$('#review-result').setAttribute('aria-busy','false')}
};
function initializeClients(){
 const strip=$('#client-strip'),track=$('#client-track'),originals=track.querySelector('.client-group');if(!originals)return;
 const slots=[...originals.children];
 originals.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>{const slot=img.parentElement;slot.textContent=img.alt;slot.classList.add('client-name')}));
 function repeatTrack(){track.classList.toggle('is-looping',!window.matchMedia('(prefers-reduced-motion: reduce)').matches);track.querySelectorAll('[data-repeat]').forEach(n=>n.remove());originals.querySelectorAll('[data-fill]').forEach(n=>n.remove());if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){let count=0;while(originals.getBoundingClientRect().width<innerWidth&&count++<20){for(const slot of slots){const clone=slot.cloneNode(true);clone.dataset.fill='true';clone.setAttribute('aria-hidden','true');clone.tabIndex=-1;originals.append(clone)}}const copy=originals.cloneNode(true);copy.dataset.repeat='true';copy.setAttribute('aria-hidden','true');copy.querySelectorAll('a').forEach(a=>a.tabIndex=-1);track.append(copy);track.style.setProperty('--loop-duration',Math.max(25,originals.getBoundingClientRect().width/45)+'s')}}
 repeatTrack();let resizeTimer;window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(repeatTrack,150)});window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',repeatTrack);
 $('#client-motion-toggle').onclick=()=>{const paused=strip.classList.toggle('is-paused');$('#client-motion-toggle').textContent=paused?'AFSPIL':'PAUSE';$('#client-motion-toggle').setAttribute('aria-pressed',String(paused));$('#client-motion-toggle').setAttribute('aria-label',paused?'Afspil logoanimation':'Sæt logoanimation på pause')};
}
initializeClients();
const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(!reducedMotion&&'IntersectionObserver'in window){document.body.classList.add('js-motion');const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('is-visible');observer.unobserve(e.target)}}),{threshold:.1});document.querySelectorAll('.reveal').forEach(el=>observer.observe(el))}
let scrollScheduled=false;window.addEventListener('scroll',()=>{if(scrollScheduled)return;scrollScheduled=true;requestAnimationFrame(()=>{const max=document.documentElement.scrollHeight-window.innerHeight;$('.scroll-progress').style.transform=`scaleX(${max>0?window.scrollY/max:0})`;scrollScheduled=false})},{passive:true});
updateSelection(false);decorateArrows();
if(!reducedMotion&&window.matchMedia('(pointer: fine)').matches){let pointerFrame=null;hero.addEventListener('pointermove',event=>{if(pointerFrame)return;pointerFrame=requestAnimationFrame(()=>{const rect=hero.getBoundingClientRect();hero.style.setProperty('--pointer-x',`${(event.clientX-rect.left)/rect.width*100}%`);hero.style.setProperty('--pointer-y',`${(event.clientY-rect.top)/rect.height*100}%`);pointerFrame=null})});hero.addEventListener('pointerleave',()=>{hero.style.removeProperty('--pointer-x');hero.style.removeProperty('--pointer-y')})}

for(const details of document.querySelectorAll('.faq details')){
 const summary=details.querySelector('summary'),body=document.createElement('div');body.className='faq-body';
 [...details.children].filter(child=>child!==summary).forEach(child=>body.append(child));details.append(body);body.hidden=!details.open;body.inert=!details.open;
 let target=details.open;summary.setAttribute('aria-expanded',String(target));
 summary.addEventListener('click',event=>{event.preventDefault();target=!target;summary.setAttribute('aria-expanded',String(target));details.classList.toggle('is-closing',!target);if(target)details.open=true;void animateDisclosure(body,target).then(completed=>{if(completed&&!target){details.open=false;details.classList.remove('is-closing')}})});
}
