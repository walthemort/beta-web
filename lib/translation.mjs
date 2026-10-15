import {translate} from '../public/locale.js';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
export function translateHTML(html){let blocked=false;return html.split(/(<[^>]*>)/g).map(part=>{if(part.startsWith('<')){if(/^<(script|style|textarea)\b/i.test(part))blocked=true;if(/^<\/(script|style|textarea)>/i.test(part))blocked=false;return part.replace(/(placeholder|aria-label|alt|content)="([^"]*)"/g,(_,attr,v)=>`${attr}="${esc(translate(decode(v)))}"`)}return blocked?part:esc(translate(decode(part)))}).join('')}
