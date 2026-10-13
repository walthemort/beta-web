function decorateArrows(root=document.body){
 const paths={'↗':'M4 20 20 4M4 4h16v16','↘':'M4 4 20 20M4 20h16V4','→':'M3 12h18M13 4l8 8-8 8','↓':'M12 3v18M4 13l8 8 8-8','↑':'M12 21V3M4 11l8-8 8 8'};
 const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);const nodes=[];let node;
 while(node=walker.nextNode())if(!['SCRIPT','STYLE','TEXTAREA'].includes(node.parentElement?.tagName)&&/[↗↘→↓↑]/.test(node.textContent))nodes.push(node);
 for(const text of nodes){const fragment=document.createDocumentFragment();for(const part of text.textContent.split(/([↗↘→↓↑])/)){if(!paths[part]){fragment.append(document.createTextNode(part));continue}const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('class','ui-arrow');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[part]);path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.4');svg.append(path);fragment.append(svg)}text.replaceWith(fragment)}
}
const modal=document.querySelector('#modal'),content=document.querySelector('#modal-content');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
document.querySelector('#modal-close').onclick=()=>modal.close();
modal.addEventListener('click',e=>{if(e.target===modal)modal.close()});
function portal(){window.location.assign('/portal')}
document.querySelector('#portal-open').onclick=portal;document.querySelector('#portal-open-bottom').onclick=portal;
document.querySelectorAll('[data-case]').forEach(el=>el.onclick=()=>{content.innerHTML=`<span class="tiny-label">CONCEPT CASE / ${esc(el.dataset.case.toUpperCase())}</span><h2>${esc(el.dataset.case)}.</h2><p>${el.dataset.case==='Forma'?'A warm, architectural identity exploring space, balance, and a quieter kind of confidence.':'An expressive retail direction with bold typography, a fresh palette, and a playful point of view.'}</p><p>This is an illustrative concept, rather than a completed Beta client project. Real case studies will replace these examples.</p><a class="dark-button" href="#contact" id="case-contact">Start a conversation ↗</a>`;decorateArrows(modal);modal.showModal();document.querySelector('#case-contact').onclick=()=>modal.close()});
document.querySelector('#review-form').onsubmit=async e=>{e.preventDefault();const status=document.querySelector('#review-status'),result=document.querySelector('#review-result'),button=e.target.querySelector('button');button.disabled=true;result.hidden=true;status.textContent='Looking at your website’s visual foundations…';try{const response=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url:document.querySelector('#url').value.trim()})});const data=await response.json();if(!response.ok)throw Error(data.error);status.textContent='Your initial review is ready.';result.innerHTML=`<span class="tiny-label">${esc(data.title)}</span><h3>${esc(data.rating)}</h3><b>Colour palette</b><div class="swatches">${data.colors.map(c=>`<span class="swatch" style="background:${esc(c)}" title="${esc(c)}"></span>`).join('')}</div><p>${data.colors.length?data.colors.map(esc).join(' · '):'No colours detected in the page HTML.'}</p><b>Typography</b><p>${data.fonts.length?data.fonts.map(esc).join(' · '):'No font declarations detected in the page HTML.'}</p><b>Brand assets</b><p>${data.svg?'SVG assets detected. A logo needs manual confirmation.':'No SVG assets detected in the page HTML.'}</p><p class="form-note">${esc(data.note)}</p><a class="dark-button" href="#contact">Talk through your review ↗</a>`;decorateArrows(result);result.hidden=false}catch(err){status.textContent=err.message}finally{button.disabled=false}};

let siteConfig={};
fetch('/api/site-config').then(r=>r.json()).then(config=>{siteConfig=config;const link=document.querySelector('[data-booking]');if(config.bookingURL)link.href=config.bookingURL;else if(config.contactEmail)link.href='mailto:'+config.contactEmail;}).catch(()=>{});
document.querySelector('[data-booking]').addEventListener('click',e=>{
 if(siteConfig.bookingURL||siteConfig.contactEmail)return;
 e.preventDefault();content.innerHTML='<span class="tiny-label">LET’S TALK</span><h2>A little conversation.<br>A bigger <em>next step.</em></h2><p>Online booking is coming soon. Come back shortly to arrange a conversation with Beta.</p>';decorateArrows(modal);modal.showModal();
});

decorateArrows();
