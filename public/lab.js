import {t} from './locale.js';
import {directionSteps,cleanDirection,directionChoices,completeDirection} from './lab-data.js';
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
