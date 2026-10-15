import {cleanDirection,completeDirection,cleanLogoTest,contextText,directionChoices} from './lab-data.js';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=key=>{try{return JSON.parse(localStorage.getItem(key))}catch{return null}};
function contexts(){const direction=cleanDirection(read('beta:visual-direction')),logo=cleanLogoTest(read('beta:logo-test'));return[...(direction&&completeDirection(direction)?[{id:'direction',value:direction}]:[]),...(logo?[{id:'logo',value:logo}]:[])]}
export function mountLabContext(aside,onChange){
 const en=document.documentElement.lang==='en',lang=en?'en':'da';
 for(const {id,value} of contexts()){
  const section=document.createElement('div');section.className='planner-lab-context';section.dataset.labContext=id;
  const title=document.createElement('span');title.className='tiny-mono';title.textContent=id==='direction'?(en?'VISUAL DIRECTION':'VISUEL RETNING'):(en?'LOGO UNDER PRESSURE':'LOGO UNDER PRES');
  const text=document.createElement('p');text.textContent=id==='direction'?directionChoices(value).map(o=>o.label[lang]).join(' / '):value.name;
  const label=document.createElement('label');label.className='include-review';const input=document.createElement('input');input.type='checkbox';input.id='include-'+id;input.checked=true;input.addEventListener('change',onChange);label.append(input,document.createTextNode(en?' Include in brief':' Medtag i briefen'));section.append(title,text,label);
  if(id==='logo'){const note=document.createElement('small');note.textContent=en?'Notes and file information only. The file is not attached.':'Kun noter og filoplysninger. Filen er ikke vedhæftet.';section.append(note)}aside.append(section);
 }
}
const included=()=>contexts().filter(c=>document.querySelector('#include-'+c.id)?.checked);
export function labContextSummary(lang){return included().map(c=>contextText(c.id==='direction'?'direction':'logo',c.value,lang)).join('\n\n')}
export function labContextHTML(lang){return included().map(c=>{const [title,...lines]=contextText(c.id==='direction'?'direction':'logo',c.value,lang).split('\n');return `<section class="brief-lab-context"><h4>${esc(title)}</h4>${c.id==='direction'?`<div class="brief-direction-board">${directionChoices(c.value).map(option=>`<img src="${option.image}" alt="${esc(option.label[lang==='en'?'en':'da'])}" width="300" height="240">`).join('')}</div>`:''}<p>${lines.map(esc).join('<br>')}</p></section>`}).join('')}
