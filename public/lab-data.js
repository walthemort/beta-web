// Small, shared catalog: every result refers to choices the visitor actually made.
export const directionSteps=[
 {id:'energy',question:{da:'Hvilken energi tiltaler dig?',en:'Which energy speaks to you?'},options:[
  {id:'calm',label:{da:'Rolig',en:'Calm'},description:{da:'Plads, balance og et lavere tempo.',en:'Space, balance and a slower pace.'},image:'/work/forma-cover-768.webp',alt:{da:'Varme tryksager og rolige arkitektoniske former',en:'Warm printed matter and quiet architectural forms'}},
  {id:'bold',label:{da:'Markant',en:'Bold'},description:{da:'Kontrast, kant og noget på hjerte.',en:'Contrast, character and something to say.'},image:'/work/offscript-cover-768.webp',alt:{da:'Blå plakat med stor sort typografi',en:'Blue poster with oversized black typography'}}]},
 {id:'material',question:{da:'Hvilken overflade føles rigtig?',en:'Which surface feels right?'},options:[
  {id:'tactile',label:{da:'Taktil',en:'Tactile'},description:{da:'Papir, stoflighed og det menneskelige.',en:'Paper, texture and a human touch.'},image:'/work/beta-posters.webp',alt:{da:'Foldet papir og plakatteksturer',en:'Folded paper and poster textures'}},
  {id:'precise',label:{da:'Præcis',en:'Precise'},description:{da:'Skarpe detaljer og glatte overflader.',en:'Sharp details and smooth surfaces.'},image:'/work/hero-ribbon-768.webp',alt:{da:'Flydende metal med blå kantlys',en:'Flowing metal with blue edge lighting'}}]},
 {id:'rhythm',question:{da:'Hvordan må udtrykket fylde?',en:'How should the expression take up space?'},options:[
  {id:'open',label:{da:'Luftig',en:'Spacious'},description:{da:'Få elementer. Plads til hvert enkelt.',en:'Fewer elements. Room for each one.'},image:'/work/forma-2.svg',alt:{da:'En enkel varm komposition med luft omkring formerne',en:'A simple warm composition with space around its shapes'}},
  {id:'expressive',label:{da:'Ekspressiv',en:'Expressive'},description:{da:'Stor skala og en mere legende rytme.',en:'Large scale and a more playful rhythm.'},image:'/work/offscript-2.svg',alt:{da:'Ekspressiv blå komposition med stor typografi',en:'Expressive blue composition with oversized typography'}}]}
];
export function cleanDirection(raw){
 if(!raw||typeof raw!=='object'||raw.version!==1||!raw.choices||typeof raw.choices!=='object')return null;
 const choices={};for(const step of directionSteps){const option=step.options.find(o=>o.id===raw.choices[step.id]);if(option)choices[step.id]=option.id}
 return{version:1,choices,note:typeof raw.note==='string'?raw.note.slice(0,500):''};
}
export function directionChoices(raw){const value=cleanDirection(raw);return value?directionSteps.flatMap(step=>{const option=step.options.find(o=>o.id===value.choices[step.id]);return option?[option]:[]}):[]}
export function completeDirection(raw){return directionChoices(raw).length===directionSteps.length}
export function cleanLogoTest(raw){
 if(!raw||raw.version!==1||typeof raw.name!=='string'||!['svg','raster'].includes(raw.kind))return null;
 const width=Number(raw.width),height=Number(raw.height);if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||width>100000||height>100000)return null;
 return{version:1,name:raw.name.replace(/[\u0000-\u001f]/g,'').slice(0,120),kind:raw.kind,width,height,transparent:raw.transparent===true,hasText:raw.hasText===true,note:typeof raw.note==='string'?raw.note.slice(0,500):''};
}
export function contextText(kind,raw,lang='da'){
 const en=lang==='en';if(kind==='direction'){const value=cleanDirection(raw);if(!value||!completeDirection(value))return'';return `${en?'VISUAL DIRECTION':'VISUEL RETNING'}\n${directionChoices(value).map(o=>o.label[en?'en':'da']).join(' / ')}${value.note?'\n'+value.note:''}`}
 const value=cleanLogoTest(raw);if(!value)return'';return `${en?'LOGO UNDER PRESSURE':'LOGO UNDER PRES'}\n${value.name}\n${value.kind==='svg'?(en?'Vector file':'Vektorfil'):`${value.width} × ${value.height} px`} / ${en?(value.transparent?'Transparent background':'Background included'):(value.transparent?'Gennemsigtig baggrund':'Baggrund i filen')}${value.note?'\n'+value.note:''}`;
}
