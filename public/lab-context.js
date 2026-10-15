import {cleanDirection,completeDirection,directionText,directionChoices} from './lab-data.js';
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=key=>{try{return JSON.parse(localStorage.getItem(key))}catch{return null}};
function contexts(){const direction=cleanDirection(read('beta:visual-direction'));return direction&&completeDirection(direction)?[{id:'direction',value:direction}]:[]}
export function mountLabContext(aside,onChange){
 const en=document.documentElement.lang==='en',lang=en?'en':'da';
 for(const {id,value} of contexts()){
  const section=document.createElement('div');section.className='planner-lab-context';section.dataset.labContext=id;
  const title=document.createElement('span');title.className='tiny-mono';title.textContent=en?'VISUAL DIRECTION':'VISUEL RETNING';
  const text=document.createElement('p');text.textContent=directionChoices(value).map(o=>o.label[lang]).join(' / ');
  const label=document.createElement('label');label.className='include-review';const input=document.createElement('input');input.type='checkbox';input.id='include-'+id;input.checked=true;input.addEventListener('change',onChange);label.append(input,document.createTextNode(en?' Include in brief':' Medtag i briefen'));section.append(title,text,label);
  aside.append(section);
 }
}
const included=()=>contexts().filter(c=>document.querySelector('#include-'+c.id)?.checked);
export function labContextSummary(lang){return included().map(c=>directionText(c.value,lang)).join('\n\n')}
export function labContextHTML(lang){return included().map(c=>{const [title,...lines]=directionText(c.value,lang).split('\n');return `<section class="brief-lab-context"><h4>${esc(title)}</h4><div class="brief-direction-board">${directionChoices(c.value).map(option=>`<img src="${option.image}" alt="${esc(option.label[lang==='en'?'en':'da'])}" width="300" height="240">`).join('')}</div><p>${lines.map(esc).join('<br>')}</p></section>`}).join('')}
