import {t} from './locale.js';
import {directionSteps,cleanDirection,directionChoices,completeDirection,cleanLogoTest} from './lab-data.js';
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)],lang=document.documentElement.lang==='en'?'en':'da',locale=lang==='en'?'/en':'';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=key=>{try{return JSON.parse(localStorage.getItem(key))}catch{return null}},write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true}catch{return false}};
function arrive(el){el.getAnimations().forEach(a=>a.cancel());if(!matchMedia('(prefers-reduced-motion:reduce)').matches)el.animate([{opacity:0,translate:'0 10px'},{opacity:1,translate:'0 0'}],{duration:360,easing:'cubic-bezier(.22,1,.36,1)'})}
function focusResult(el){el.focus({preventScroll:true});const rect=el.getBoundingClientRect();if(rect.top<72||rect.top>innerHeight*.6)el.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth',block:'start'})}
function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000)}
const png=canvas=>new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error(t('Billedet kunne ikke gemmes.'))),'image/png'));
function canvas(width,height){const el=document.createElement('canvas');el.width=width;el.height=height;return el}
function contain(ctx,img,x,y,width,height){const scale=Math.min(width/img.width,height/img.height),w=img.width*scale,h=img.height*scale;ctx.drawImage(img,x+(width-w)/2,y+(height-h)/2,w,h)}
function cover(ctx,img,x,y,width,height){const scale=Math.max(width/img.width,height/img.height),w=width/scale,h=height/scale;ctx.drawImage(img,(img.width-w)/2,(img.height-h)/2,w,h,x,y,width,height)}
function wrapped(ctx,text,x,y,width,lineHeight){let line='';for(const char of text){if(char==='\n'){ctx.fillText(line,x,y);line='';y+=lineHeight;continue}if(ctx.measureText(line+char).width>width){ctx.fillText(line,x,y);line='';y+=lineHeight}line+=char}if(line)ctx.fillText(line,x,y);return y}
function loadImage(url){return new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error(t('Filen kunne ikke læses som et billede.')));img.src=url})}
// SVG is decoded as an image, then rasterised. Uploaded markup is never inserted into the document.
function staticSVG(text){
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error(t('SVG-filen indeholder indhold, som testen ikke understøtter.'));
 const doc=new DOMParser().parseFromString(text,'image/svg+xml'),root=doc.documentElement;
 if(root.localName!=='svg'||root.namespaceURI!=='http://www.w3.org/2000/svg'||doc.querySelector('parsererror'))throw Error(t('SVG-filen er ikke gyldig.'));
 let hasText=false;
 for(const node of [root,...root.querySelectorAll('*')]){
  if(['script','foreignobject','iframe','object','embed','animate','animatetransform','animatemotion','set'].includes(node.localName.toLowerCase()))throw Error(t('Brug en statisk SVG uden scripts, animation eller indlejret HTML.'));
  if(node.localName==='text')hasText=true;
  for(const attr of node.attributes){const name=attr.localName.toLowerCase(),value=attr.value.trim();if(name.startsWith('on')||name==='base')throw Error(t('Brug en statisk SVG uden scripts, animation eller indlejret HTML.'));if(name==='href'&&!value.startsWith('#')&&!(node.localName==='image'&&/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=\s]+$/i.test(value)))throw Error(t('SVG-filen skal have sine billeder og skrifter indlejret. Eksterne links understøttes ikke.'))}
  const style=node.localName==='style'?node.textContent:node.getAttribute('style')||'';
  if(/@import|@font-face|expression\s*\(/i.test(style))throw Error(t('SVG-filen skal have sine billeder og skrifter indlejret. Eksterne links understøttes ikke.'));
  for(const content of [style,...[...node.attributes].map(a=>a.value)])for(const match of content.matchAll(/url\s*\(([^)]*)\)/gi))if(!match[1].trim().replace(/^['"]|['"]$/g,'').startsWith('#'))throw Error(t('SVG-filen skal have sine billeder og skrifter indlejret. Eksterne links understøttes ikke.'));
 }
 const box=(root.getAttribute('viewBox')||'').trim().split(/[\s,]+/).map(Number);let width=box.length===4?box[2]:parseFloat(root.getAttribute('width')),height=box.length===4?box[3]:parseFloat(root.getAttribute('height'));
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0){width=512;height=512}
 if(width>100000||height>100000)throw Error(t('Billedets dimensioner er for store.'));
 const scale=Math.min(1,1600/Math.max(width,height));root.setAttribute('width',String(Math.max(1,Math.round(width*scale))));root.setAttribute('height',String(Math.max(1,Math.round(height*scale))));
 return{blob:new Blob([new XMLSerializer().serializeToString(root)],{type:'image/svg+xml'}),width,height,hasText};
}
if($('#logo-lab')){
 const root=$('#logo-lab'),drop=$('#logo-dropzone'),input=$('#logo-file'),status=$('#logo-status'),result=$('#logo-results');root.hidden=false;
 let current=null,revision=0,activeURLs=[];
 const savedContext=cleanLogoTest(read('beta:logo-test'));if(savedContext){$('#logo-saved-context').hidden=false;$('#logo-saved-name').textContent=t('Gemt til briefen:')+' '+savedContext.name}
 function forgetContext(){try{localStorage.removeItem('beta:logo-test');$('#logo-saved-context').hidden=true;return true}catch{status.textContent=t('Testen kunne ikke ryddes fra browserens lager.');return false}}
 $('#logo-forget').onclick=()=>{if(forgetContext()){status.textContent=t('Testen er fjernet fra briefen.');input.focus()}};

 const revoke=()=>{activeURLs.forEach(url=>URL.revokeObjectURL(url));activeURLs=[]};
 async function openFile(file){
  const cycle=++revision;status.textContent='';if(!file)return;
  if(file.size>5*1024*1024){status.textContent=t('Filen er for stor. Vælg et logo på højst 5 MB.');input.value='';return}
  const svg=/\.svg$/i.test(file.name)||file.type==='image/svg+xml';if(!svg&&!['image/png','image/jpeg','image/webp'].includes(file.type)){status.textContent=t('Vælg en SVG, PNG, JPG eller WebP.');input.value='';return}
  root.setAttribute('aria-busy','true');status.textContent=t('Gør dit logo klar…');let sourceURL=null,newURLs=[];
  try{
   const vector=svg?staticSVG(await file.text()):null;sourceURL=URL.createObjectURL(vector?.blob||file);const img=await loadImage(sourceURL);
   if(img.naturalWidth>8192||img.naturalHeight>8192||img.naturalWidth*img.naturalHeight>24000000)throw Error(t('Billedets dimensioner er for store.'));
   const scale=Math.min(1,1600/Math.max(img.naturalWidth,img.naturalHeight)),raster=canvas(Math.max(1,Math.round(img.naturalWidth*scale)),Math.max(1,Math.round(img.naturalHeight*scale))),ctx=raster.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,raster.width,raster.height);
   const pixels=ctx.getImageData(0,0,raster.width,raster.height).data;let transparent=false;for(let i=3;i<pixels.length;i+=4)if(pixels[i]<250){transparent=true;break}
   const data=cleanLogoTest({version:1,name:file.name,kind:svg?'svg':'raster',width:vector?.width||img.naturalWidth,height:vector?.height||img.naturalHeight,transparent,hasText:vector?.hasText,note:''});
   const mono=canvas(raster.width,raster.height),mc=mono.getContext('2d');mc.drawImage(raster,0,0);mc.globalCompositeOperation='source-in';mc.fillStyle='#0B0B0E';mc.fillRect(0,0,mono.width,mono.height);
   const previewURL=URL.createObjectURL(await png(raster)),monoURL=URL.createObjectURL(await png(mono));newURLs=[previewURL,monoURL];if(cycle!==revision){newURLs.forEach(url=>URL.revokeObjectURL(url));return}
   revoke();activeURLs=newURLs;current={raster,mono,data};$$('[data-logo-preview]').forEach(img=>img.src=previewURL);$('#logo-mono').src=monoURL;$('#logo-filename').textContent=data.name;
   const facts=[svg?t('Vektorfil'):`${data.width} × ${data.height} px`,t(transparent?'Gennemsigtig baggrund':'Baggrund i filen')];if(data.width/data.height>3.5)facts.push(t('Langt format — prøv også en ikonversion.'));if(data.hasText)facts.push(t('Tekst i SVG — kontrollér de anvendte skrifter.'));
   $('#logo-facts').replaceChildren(...facts.map(text=>{const span=document.createElement('span');span.textContent=text;return span}));$('#logo-note').value='';result.hidden=false;status.textContent=t('Dit logo er klar. Prøv det på de forskellige flader.');arrive(result);focusResult($('#logo-result-title'));
  }catch(error){if(cycle===revision){status.textContent=error.message;input.value=''}}finally{if(sourceURL)URL.revokeObjectURL(sourceURL);if(cycle===revision)root.removeAttribute('aria-busy')}
 }
 input.addEventListener('change',()=>void openFile(input.files[0]));
 for(const type of ['dragenter','dragover'])drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add('is-dragging')});for(const type of ['dragleave','drop'])drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove('is-dragging')});drop.addEventListener('drop',e=>{const file=e.dataTransfer?.files[0];if(file)void openFile(file)});
 $('#logo-demo').onclick=async()=>{const button=$('#logo-demo'),cycle=++revision;button.disabled=true;try{const response=await fetch('/logos/b-blue.svg');if(!response.ok)throw Error(t('Eksemplet kunne ikke hentes.'));const blob=await response.blob();if(cycle===revision)await openFile(new File([blob],'beta.svg',{type:'image/svg+xml'}))}catch(error){status.textContent=error.message}finally{button.disabled=false}};
 $$('[name=logo-surface]').forEach(input=>input.addEventListener('change',()=>{$('#logo-proof').dataset.surface=input.value;arrive($('#logo-proof'))}));
 $('#logo-remove').onclick=()=>{revision++;revoke();current=null;result.hidden=true;input.value='';status.textContent=t('Logoet er fjernet.');root.removeAttribute('aria-busy');forgetContext();input.focus()};
 $('#logo-favicon').onclick=async()=>{if(!current)return;try{const c=canvas(32,32);contain(c.getContext('2d'),current.raster,2,2,28,28);downloadBlob(await png(c),'logo-favicon-32.png');status.textContent=t('Dit favicon er downloadet.')}catch(error){status.textContent=error.message}};
 $('#logo-sheet').onclick=async()=>{if(!current)return;try{await document.fonts.ready;const c=canvas(1440,1120),ctx=c.getContext('2d');ctx.fillStyle='#F6F4EF';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#0B0B0E';ctx.font='38px "Inter Variable", Arial';ctx.fillText(t('Logo under pres'),64,80);ctx.font='16px "Inter Variable", Arial';ctx.fillText(current.data.name,64,116);
 const cells=[{x:64,y:160,w:640,h:380,bg:'#F6F4EF',ink:'#0B0B0E',label:t('Lys baggrund')},{x:736,y:160,w:640,h:380,bg:'#0B0B0E',ink:'#F6F4EF',label:t('Mørk baggrund')},{x:64,y:580,w:640,h:380,bg:'#1B4DFF',ink:'#F6F4EF',label:t('Beta-blå')},{x:736,y:580,w:640,h:380,bg:'#e7e4dd',ink:'#0B0B0E',label:t('Enfarvet simulering')}];
 for(const cell of cells){ctx.fillStyle=cell.bg;ctx.fillRect(cell.x,cell.y,cell.w,cell.h);ctx.strokeStyle='#0B0B0E25';ctx.strokeRect(cell.x,cell.y,cell.w,cell.h);contain(ctx,cell.label===t('Enfarvet simulering')?current.mono:current.raster,cell.x+80,cell.y+50,cell.w-160,cell.h-120);ctx.fillStyle=cell.ink;ctx.font='14px "Inter Variable", Arial';ctx.fillText(cell.label,cell.x+24,cell.y+cell.h-22)}
 ctx.fillStyle='#0B0B0E';ctx.font='14px "Inter Variable", Arial';ctx.fillText(t('Browserfane · 16 px'),64,1020);contain(ctx,current.raster,260,1004,16,16);ctx.fillText('BETA / '+t('Visuel test — ikke en trykklar fil.'),64,1080);downloadBlob(await png(c),'beta-logo-test.png');status.textContent=t('Dit testark er downloadet.')}catch(error){status.textContent=error.message}};
 $('#logo-to-brief').onclick=()=>{if(!current)return;const data={...current.data,note:$('#logo-note').value.trim()};if(write('beta:logo-test',data))location.assign(locale+'/start?logo-test=1');else status.textContent=t('Browseren kunne ikke gemme testen. Du kan stadig downloade dit testark.')};
 addEventListener('pagehide',()=>{revision++;revoke()});addEventListener('pageshow',event=>{if(event.persisted&&current){result.hidden=true;current=null;input.value='';status.textContent=t('Vælg dit logo igen for at fortsætte testen.')}});
}
if($('#direction-lab')){
 const root=$('#direction-lab');root.hidden=false;let value=cleanDirection(read('beta:visual-direction'))||{version:1,choices:{},note:''},step=0;
 const status=$('#direction-status'),save=()=>{const ok=write('beta:visual-direction',value);if(!ok)status.textContent=t('Dine valg kunne ikke gemmes i denne browser. Du kan stadig downloade din retning.');return ok};
 function render(focus=false){
  $('#direction-result').hidden=true;$('#direction-quiz').hidden=false;const item=directionSteps[step];$('#direction-step').textContent=`${step+1} / ${directionSteps.length}`;$('#direction-progress-fill').style.width=`${(step+1)/directionSteps.length*100}%`;$('#direction-question').textContent=item.question[lang];$('#direction-back').hidden=step===0;
  $('#direction-options').innerHTML=item.options.map(option=>`<button type="button" data-direction-choice="${option.id}" aria-pressed="${value.choices[item.id]===option.id}"><span class="direction-option-art"><img src="${option.image}" alt="${esc(option.alt[lang])}" width="900" height="650" decoding="async"><span class="direction-choice-check" aria-hidden="true">✓</span></span><span class="direction-option-copy"><strong>${esc(option.label[lang])}</strong><span>${esc(option.description[lang])}</span></span></button>`).join('');
  const next=$('#direction-next');next.disabled=!value.choices[item.id];next.textContent=t(step===directionSteps.length-1?'SE DIN RETNING →':'VIDERE →');
  $$('[data-direction-choice]').forEach(button=>button.onclick=()=>{value.choices[item.id]=button.dataset.directionChoice;$$('[data-direction-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));next.disabled=false;save()});arrive($('#direction-stage'));if(focus)focusResult($('#direction-question'));
 }
 function result(focus=false){
  if(!completeDirection(value))return;$('#direction-quiz').hidden=true;$('#direction-result').hidden=false;const choices=directionChoices(value);$('#direction-words').textContent=choices.map(o=>o.label[lang]+'.').join(' ');$('#direction-board').innerHTML=choices.map(option=>`<figure${['open','expressive'].includes(option.id)?' class="direction-board-graphic"':''}><img src="${option.image}" alt="${esc(option.alt[lang])}" width="900" height="650"><figcaption>${esc(option.label[lang])}</figcaption></figure>`).join('');$('#direction-note').value=value.note;arrive($('#direction-result'));if(focus)focusResult($('#direction-result-title'));
 }
 $('#direction-next').onclick=()=>{if(!value.choices[directionSteps[step].id])return;if(step<directionSteps.length-1){step++;render(true)}else{save();result(true)}};
 $('#direction-back').onclick=()=>{if(step>0){step--;render(true)}};
 $('#direction-edit').onclick=()=>{step=0;render(true)};
 $('#direction-reset').onclick=()=>{value={version:1,choices:{},note:''};step=0;status.textContent='';try{localStorage.removeItem('beta:visual-direction')}catch{status.textContent=t('Valgene kunne ikke ryddes fra browserens lager.')}render(true)};
 $('#direction-note').addEventListener('input',()=>{value.note=$('#direction-note').value.slice(0,500);save()});
 $('#direction-download').onclick=async()=>{const button=$('#direction-download'),snapshot=cleanDirection(value);if(!completeDirection(snapshot))return;button.disabled=true;try{const choices=directionChoices(snapshot),images=await Promise.all(choices.map(option=>loadImage(option.image)));await document.fonts.ready;const c=canvas(1440,1240),ctx=c.getContext('2d');ctx.fillStyle='#F6F4EF';ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle='#0B0B0E';ctx.font='20px "Inter Variable", Arial';ctx.fillText('BETA / '+t('VISUEL RETNING'),64,72);ctx.fillStyle='#1B4DFF';ctx.font='60px "Inter Variable", Arial';ctx.fillText(choices.map(option=>option.label[lang]+'.').join(' '),64,170);
 for(let i=0;i<choices.length;i++){const x=64+i*448;ctx.fillStyle='#e8e5df';ctx.fillRect(x,240,416,520);if(['open','expressive'].includes(choices[i].id))contain(ctx,images[i],x,240,416,520);else cover(ctx,images[i],x,240,416,520);ctx.fillStyle='#0B0B0E';ctx.font='24px "Inter Variable", Arial';ctx.fillText(choices[i].label[lang],x,806)}
 ctx.font='22px "Inter Variable", Arial';if(snapshot.note)wrapped(ctx,snapshot.note,64,890,1312,32);ctx.fillStyle='#65656b';ctx.font='16px "Inter Variable", Arial';ctx.fillText(t('Dine valg er et afsæt til en samtale — ikke en færdig identitet.'),64,1176);downloadBlob(await png(c),'beta-visuel-retning.png');status.textContent=t('Din retning er downloadet.')}catch(error){status.textContent=error.message}finally{button.disabled=false}};

 $('#direction-to-brief').onclick=()=>{if(completeDirection(value)&&save())location.assign(locale+'/start?direction=1')};
 if(completeDirection(value))result();else{const firstMissing=directionSteps.findIndex(s=>!value.choices[s.id]);step=Math.max(0,firstMissing);render()}
}
