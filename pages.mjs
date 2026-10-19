import {renderProjectCollection} from './lib/projects.mjs';
import {briefQuestions} from './lib/brief.mjs';
import {readFileSync} from 'node:fs';
const clients=JSON.parse(readFileSync(new URL('./public/clients.json',import.meta.url),'utf8'));
let cases=JSON.parse(readFileSync(new URL('./content/cases.json',import.meta.url),'utf8'));
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const menu=`<dialog id="menu" class="menu-dialog" aria-label="Navigation"><div class="menu-header"><a href="/" aria-label="Beta hjem"><img src="/logos/beta-white.svg" alt="Beta" width="110" height="28"></a><button id="menu-close" aria-label="Luk menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><nav><a href="/">Hjem<span>↗</span></a><a href="/cases">Arbejde<span>↗</span></a><a href="/services">Services<span>↗</span></a><a href="/studio">Studio<span>↗</span></a><a href="/portal">Kundeportal<span>↗</span></a></nav><div class="menu-footer"><a href="/start">HAR DU EN GOD IDÉ? ↗</a></div></dialog>`;
function layout({title,description,body,page='standard',path}){return `<!doctype html><html lang="da"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#F6F4EF"><title>${escape(title)} — BETA</title><meta name="description" content="${escape(description)}"><meta property="og:title" content="${escape(title)} — BETA"><meta property="og:description" content="${escape(description)}"><meta property="og:type" content="website"><link rel="icon" href="/favicon.svg?v=4"><script src="/navigation.js"></script><link rel="stylesheet" href="/style.css"><link rel="stylesheet" href="/pages.css"></head><body class="subpage public-edition page-${page}" data-page="${page}" data-path="${escape(path)}"><a class="skip-link" href="#main">Spring til indhold</a><div class="scroll-progress" aria-hidden="true"></div><header class="site-header"><a href="/" class="brand" aria-label="Beta hjem"><img src="/logos/beta-black.svg" alt="Beta" width="220" height="55"><span class="brand-studio" aria-hidden="true">STUDIO</span></a><nav class="desktop-nav" aria-label="Hovednavigation"><a href="/cases" ${path.startsWith('/cases')?'aria-current="page"':''}>Arbejde</a><a href="/services" ${path==='/services'?'aria-current="page"':''}>Services</a><a href="/studio" ${path==='/studio'?'aria-current="page"':''}>Studio</a><a href="/start" class="nav-project">LAD OS SKABE ↗</a></nav><button class="menu-trigger" id="menu-open" aria-haspopup="dialog" aria-controls="menu" aria-expanded="false" aria-label="Åbn menu"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg></button></header><main id="main">${body}</main><footer class="site-footer"><a href="/" class="brand" aria-label="Beta hjem"><img src="/logos/beta-white.svg" alt="Beta" width="110" height="28"></a><span>© BETA 2026</span><a href="/#review">BETA_REVIEW™</a><a href="/portal">KUNDEPORTAL</a><a href="/start">START ET PROJEKT ↗</a></footer>${menu}<script type="module" src="/pages.js"></script></body></html>`}
const cover = c => c.gallery?.[0] || {
  src: ['forma', 'offscript'].includes(c.slug) ? `/work/${c.slug}-cover.webp` : '/work/placeholder-1.svg',
  alt: `${c.name} / konceptstudie`
};
function responsiveCover(image, sizes) {
  return /^\/work\/(?:forma|offscript)-cover\.webp$/.test(image.src)
    ? `srcset="${image.src.replace('.webp', '-768.webp')} 768w, ${image.src} 1536w" sizes="${sizes}"`
    : '';
}
function casesIndex() {
  return layout({
    title: 'Cases', description: 'Udforsk visuelle retninger, gem din inspiration og find næste skridt for dit brand.',
    path: '/cases', page: 'cases', body: `
    <section class="page-intro work-intro section-pad">
      <div class="section-top"><span>ARBEJDE</span><a href="/inspiration">DIN INSPIRATION ↗</a></div>
      <div class="editorial-intro"><h1>Arbejde med<br><em>karakter.</em></h1><p>Udforsk koncepterne. Gem det, der taler til dig.</p></div>
    </section>
    <section class="project-paper project-archive section-pad">${renderProjectCollection()}</section>
    ${cta('Dit brand.', 'Dit næste kapitel.')}`
  });
}
function cta(line = 'Har du en god idé?', secondary = 'Lad os give den retning.') {
  return `<section class="page-cta section-pad"><a href="/start"><h2>${line}<br><em>${secondary}</em></h2><span aria-hidden="true">↗</span></a></section>`;
}
function clientCase(client) {
  return layout({
    title: `${client.name} / Case`, description: `${client.name} er en del af Betas kunder. Projektets case kommer snart.`,
    path: client.case, page: 'client', body: `
    <section class="page-intro client-case-intro section-pad">
      <div class="section-top"><a href="/cases">← ALLE CASES</a><span>KUNDE / BETA</span></div>
      <div class="client-holding-layout"><div><div class="client-case-status"><span class="status-orbit" aria-hidden="true"></span><span>CASE KOMMER SNART</span></div><h1>${escape(client.name)}<em>.</em></h1></div><div class="client-case-mark">${client.logo ? `<img src="${escape(client.logo)}" alt="${escape(client.name)}">` : escape(client.name)}</div></div>
    </section>
    <section class="client-case-story section-pad"><h2>Et samarbejde.<br><em>En historie.</em></h2><div><p>${escape(client.name)} er en del af Betas kunder. Godkendt projektmateriale kommer her, når casen er klar.</p><a href="/cases" class="text-link">UDFORSK VORES KONCEPTER ↗</a></div></section>
    ${cta('Dit brand.', 'Dit næste kapitel.')}`
  });
}
function caseDetail(c) {
  const next = cases.find(n => n.slug === c.next) || cases.find(n => n.slug !== c.slug) || c;
  const image = cover(c);
  return layout({
    title: `${c.name} / ${c.type}`, description: c.intro, path: `/cases/${c.slug}`, page: 'case',
    body: `
    <section class="case-hero ${c.slug}-hero" data-case-slug="${c.slug}">
      <div class="case-hero-top"><a href="/cases">← ALLE CASES</a><span>${c.status === 'published' ? 'KUNDECASE' : 'KONCEPTPROJEKT'}</span><button data-share-case>DEL CASE ↗</button></div>
      <div class="case-title-row"><h1>${escape(c.name)}</h1><p>${escape(c.headline).replace('\n', '<br>')}</p></div>
      <div class="case-hero-art"><img class="case-cover" src="${escape(image.src)}" alt="${escape(image.alt)}" ${responsiveCover(image, '90vw')} width="1536" height="1024" fetchpriority="high"></div>
      <div class="case-hero-bottom"><p>${escape(c.categoryLabel)}</p><a href="#direction">UDFORSK RETNINGEN ↓</a><button data-save-case="${c.slug}" aria-pressed="false">+ GEM INSPIRATION</button></div>
    </section>
    <nav class="chapter-nav" aria-label="Case-kapitler"><a href="#direction" aria-current="location">01 / RETNING</a><a href="#system">02 / SYSTEM</a><a href="#play">03 / AFPRØV</a><a href="#next-case">04 / NÆSTE</a><span class="chapter-progress" aria-hidden="true"></span></nav>
    <section class="case-story section-pad" id="direction"><div class="story-layout"><h2>Retningen.</h2><div><p class="story-lead">${escape(c.intro)}</p><div class="story-columns"><div><h3>SPØRGSMÅLET</h3><p>${escape(c.challenge)}</p></div><div><h3>RETNINGEN</h3><p>${escape(c.direction)}</p></div></div><p class="concept-note">${c.status === 'published' ? 'Godkendt projektfortælling.' : 'Konceptstudie — ikke et afsluttet kundeprojekt.'}</p></div></div></section>
    <section class="case-system section-pad" id="system"><div class="section-top"><span>FARVER, FORM OG FØLELSE.</span></div><div class="system-palette">${c.palette.map(color => `<button data-copy-color="${color}" style="--swatch:${color}" aria-label="Kopiér ${color}"><span>${color}</span></button>`).join('')}</div><div class="principle-grid">${c.principles.map(([n,title,text]) => `<article><span>${escape(n)}</span><h3>${escape(title)}</h3><p>${escape(text)}</p></article>`).join('')}</div><div class="deliverable-row"><span>UDFORSKET I KONCEPTET</span><div>${c.deliverables.map(d => `<span>${escape(d)}</span>`).join('')}</div></div></section>
    <section class="design-lab section-pad" id="play"><div class="lab-heading"><h2>Prøv udtrykket.<br><em>Med dine ord.</em></h2><p>Leg med udtrykket og se, hvad detaljerne gør.</p></div><div class="lab ${c.slug}-lab"><div class="lab-controls"><label for="specimen-text">DINE ORD</label><input id="specimen-text" maxlength="32" value="${c.slug === 'forma' ? 'space to be.' : 'MAKE ROOM.'}" autocomplete="off"><label for="type-spacing">AFSTAND MELLEM BOGSTAVER</label><input type="range" id="type-spacing" min="-5" max="12" value="${c.slug === 'forma' ? 0 : -3}"><label>UDTRYK</label><div class="lab-modes" role="group" aria-label="Vælg udtryk"><button data-lab-mode="quiet" aria-pressed="true">RO</button><button data-lab-mode="bold" aria-pressed="false">KONTRAST</button></div><button data-lab-reset class="lab-reset">NULSTIL</button><p id="lab-status" role="status">Din leg ændrer kun dette eksempel.</p></div><div class="lab-preview" id="lab-preview"><div id="specimen-output">${c.slug === 'forma' ? 'space to be.' : 'MAKE ROOM.'}</div></div></div></section>
    <section class="case-actions section-pad"><p>${c.services.map(escape).join(' / ')}</p><a href="/start?inspiration=${c.slug}" class="button-blue">SAMME ENERGI. DIT EGET BRAND. ↗</a><span id="case-status" role="status"></span></section>
    <a class="next-case section-pad next-${next.slug}" href="/cases/${next.slug}" id="next-case"><span class="tiny-mono">NÆSTE UDFORSKNING</span><div><h2>${escape(next.name)}</h2><span aria-hidden="true">↗</span></div></a>`
  });
}
let offerings=JSON.parse(readFileSync(new URL('./content/services.json',import.meta.url),'utf8')).map(c=>[c.number,c.title,c.id,c.summary,c.tags.join(' / ')]);
function servicesPage() {
  return layout({
    title: 'Services', description: 'Strategi, brandidentitet, websites og indhold. Find den rigtige retning for dit næste projekt.',
    path: '/services', page: 'services', body: `
    <section class="page-intro services-intro section-pad"><div class="section-top"><span>SERVICES</span></div><div class="editorial-intro"><h1>Fra idé.<br><em>Til indtryk.</em></h1><div><p>Strategi, identitet og digitale oplevelser.<br>Skabt til at hænge sammen.</p><a href="/retning" class="text-link">FIND DIN RETNING ↗</a></div></div></section>
    <section class="offerings section-pad">${offerings.map(([n,title,name,line,details]) => `<article><span class="offering-number">${n}</span><div><h2>${escape(title)}</h2><p>${escape(line)}</p><div class="offering-tags">${details.split(' / ').map(tag => `<span>${escape(tag)}</span>`).join('')}</div></div><a class="offering-start" href="/start?service=${encodeURIComponent(name)}" aria-label="Start projekt med ${escape(name)}">↗</a></article>`).join('')}</section>
    <section class="process section-pad"></section>
    ${cta()}`
  });
}
function studioPage() {
  return layout({
    title: 'Studio', description: 'Et uafhængigt kreativt studio. Nysgerrighed, klarhed og tæt samarbejde fra første tanke til sidste detalje.',
    path: '/studio', page: 'studio', body: `
    <section class="page-intro studio-intro section-pad"><div class="section-top"><span>STUDIO</span></div><div class="editorial-intro"><h1>Lille studio.<br><em>Stor omtanke.</em></h1><p>Et kreativt studio for brands i udvikling.<br>Fra den første tanke til den sidste detalje.</p></div></section>
    <section class="studio-manifesto section-pad"><h2>Godt design<br>starter med<br><em>gode spørgsmål.</em></h2><div><p class="studio-lead">Vi er nysgerrige på det, din virksomhed kan blive til.</p><p>Vi arbejder med strategi, identitet og digitale oplevelser som ét samlet system. De bedste valg er dem, der både giver mening og kan mærkes.</p><a href="/start" class="text-link">LAD OS LÆRE HINANDEN AT KENDE ↗</a></div></section>
    <section class="studio-values section-pad"><span class="tiny-mono">TRE PRINCIPPER. HVER GANG.</span>${[['01','KLARHED FØR PYNT.','Vi prioriterer de valg, der gør brandet tydeligt. Det visuelle udtryk skal bære en idé, ikke skjule manglen på en.'],['02','TÆTTERE SAMARBEJDE.','Din viden om virksomheden er en del af processen. Vi gør feedback og retning til et fælles arbejde.'],['03','ALDRIG HELT FÆRDIG.','Et brand skal kunne leve og udvikle sig. Vi bygger systemer, der kan vokse med virksomheden.']].map(([n,h,p]) => `<details><summary><small>${n}</small>${h}<span>+</span></summary><div><p>${p}</p></div></details>`).join('')}</section>
    ${cta()}`
  });
}
function startPage(){return layout({title:'Start et projekt',description:'Saml din idé, dine services og inspiration i en konkret projektbrief. Gem den og tag næste skridt med Beta.',path:'/start',page:'start',body:`<section class="page-intro section-pad"><div class="section-top"><span>START ET PROJEKT</span><a href="/">← TILBAGE TIL BETA</a></div><h1>En god start.<br><em>Helt enkelt.</em></h1><p>Fortæl os lidt om det, du gerne vil skabe.</p></section><script type="application/json" id="brief-catalog">${JSON.stringify(briefQuestions()).replace(/</g,'\\u003c')}</script><section class="planner section-pad"><nav class="planner-steps" aria-label="Projektbrief-trin"><output id="draft-save-status" class="draft-save-status" role="status"></output><button class="clear-draft" id="undo-draft" hidden>FORTRYD RYDNING</button><button data-step-target="0" aria-current="step"><span>01</span> RETNING</button><button data-step-target="1"><span>02</span> DIN IDÉ</button><button data-step-target="2"><span>03</span> DIN BRIEF</button></nav><div class="planner-stage"><section class="planner-step" data-step="0"><h2>Hvad skal vi<br><em>skabe sammen?</em></h2><div class="planner-options">${offerings.map(([n,title,name,line])=>`<button data-planner-service="${name}" aria-pressed="false"><span>${n}</span><b>${escape(title)}</b><small>${escape(line)}</small><i>+</i></button>`).join('')}</div><p class="planner-note">Du kan også gå videre uden at vælge. Så finder vi retningen sammen.</p><button class="button-blue" data-next-step>VIDERE TIL DIN IDÉ →</button></section><section class="planner-step" data-step="1" hidden><h2>Hvad har du<br><em>i tankerne?</em></h2><label for="project-name">VIRKSOMHED / PROJEKT</label><input id="project-name" autocomplete="organization" placeholder="Dit projekt eller din virksomhed" maxlength="150"><label for="project-goal">HVAD VIL DU OPNÅ?</label><textarea id="project-goal" aria-describedby="planner-error" placeholder="Fortæl lidt om idéen, udfordringen eller den forandring, du vil skabe…" maxlength="5000"></textarea><label for="project-timing">HVORNÅR SKAL DET SKE?</label><select id="project-timing"><option value="Afklares sammen">Afklares sammen</option><option value="Snarest muligt">Snarest muligt</option><option value="Inden for 1–3 måneder">Inden for 1–3 måneder</option><option value="Jeg udforsker mulighederne">Jeg udforsker mulighederne</option></select><section class="adaptive-brief" id="adaptive-brief"><h3>Et par detaljer.</h3><p>Valgfrit. Svar på det, du ved.</p><div id="adaptive-fields"></div></section><p class="planner-note">Dine indtastninger gemmes kun på denne enhed. Briefen bliver ikke sendt automatisk.</p><p id="planner-error" role="alert"></p><div class="planner-buttons"><button class="outline-button" data-prev-step>← TILBAGE</button><button class="button-blue" data-next-step>SE DIN BRIEF →</button></div></section><section class="planner-step" data-step="2" hidden><h2>Fra tanke<br><em>til næste skridt.</em></h2><div class="brief-summary" id="brief-summary"></div><div class="planner-buttons"><button class="outline-button" data-prev-step>← REDIGÉR</button><button class="button-blue" id="planner-download">DOWNLOAD BRIEF ↓</button><button class="outline-button" id="planner-booking" hidden>BOOK EN SAMTALE ↗</button></div><p id="planner-status" role="status">Gem briefen til vores første samtale. Det er ikke en bestilling.</p><button class="clear-draft" id="clear-draft">RYD LOKAL KLADDE</button><p class="booking-fallback" id="booking-fallback">Download din brief og gem den til den første samtale. Den bliver ikke sendt automatisk.</p></section></div><aside class="planner-aside" hidden><p>Dit projekt.</p><div id="planner-selection" hidden><span class="tiny-mono">DIN RETNING</span><div id="planner-selection-tags"></div></div><div id="planner-inspiration" hidden></div></aside></section>`})}
export function renderPage(pathname){offerings=JSON.parse(readFileSync(new URL('./content/services.json',import.meta.url),'utf8')).map(c=>[c.number,c.title,c.id,c.summary,c.tags.join(' / ')]);cases=JSON.parse(readFileSync(new URL('./content/cases.json',import.meta.url),'utf8')).filter(c=>c.status!=='draft');const path=pathname.length>1?pathname.replace(/\/$/,''):pathname;if(path==='/cases')return {status:200,html:casesIndex()};if(path==='/services')return {status:200,html:servicesPage()};if(path==='/studio')return {status:200,html:studioPage()};if(path==='/start')return {status:200,html:startPage()};if(path.startsWith('/cases/')){const c=cases.find(c=>path===`/cases/${c.slug}`);if(c)return {status:200,html:caseDetail(c)};const client=clients.find(c=>c.case===path);if(client)return {status:200,html:clientCase(client)};return {status:404,html:layout({title:'Case ikke fundet',description:'Find en anden visuel retning hos Beta.',path,page:'missing',body:`<section class="page-intro section-pad"><span class="tiny-mono">404 / DEN RETNING FINDES IKKE HER</span><h1>NY RETNING?<br><em>DENNE VEJ.</em></h1><a href="/cases" class="text-link">SE ALLE CASES ↗</a></section>`})}}return null}

export function renderMissingPage(path){return {status:404,html:layout({title:'Side ikke fundet',description:'Find din næste retning hos Beta.',path,page:'missing',body:`<section class="page-intro section-pad"><span class="tiny-mono">404</span><h1>EN NY RETNING.<br><em>DENNE VEJ.</em></h1><p>Vi kunne ikke finde siden. Her er et godt sted at starte.</p><div class="missing-actions"><a href="/" class="button-blue">TIL FORSIDEN ↗</a><a href="/cases" class="outline-button">SE VORES ARBEJDE ↗</a></div></section>`})}}

// Public tools reuse the same navigation, metadata and accessible page shell.
export function renderPublicPage(options){return {status:200,html:layout(options)}}
