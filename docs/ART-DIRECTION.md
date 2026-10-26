# BETA — statement edition

The public entry point is rebuilt around a first look at the visitor’s brand and the original seven selected client collaborations. The opening, form, result styling, client collection, studio introduction, service links, Review questions and contact chapter are new markup and styling. The former blue concept hero, Edge/Calm controls, project index/stage, moving logo strip, homepage reel teaser and home service-selection widget are removed.

## Review as the opening

`public/review-home.css` is the homepage’s own foundation. The homepage does not load `style.css`, `features.css`, `agency.css`, `editorial.css`, `subpages-art.css` or `atelier.css`. It includes its own shared-shell, Review, consent and modal styles. `public/selected-work.css` styles the selected-client collection on both the homepage and `/cases`.

The supplied white Beta wordmark sits on a black header, and returns at full width in the footer. An oversized Syne display headline and a blue tactile paper study make the Review opening read as a printed statement. Inter stays on UI and body copy. The clear URL form sits on its own warm-white strip, with a tilted live proof alongside the headline. On mobile the form appears before the proof so the primary action stays on the first screen. The proof’s initial colours and Inter reference are explicitly labelled as **Beta’s own example**, and are never stored as an analysis result.

Submitting Enter runs the existing Review API and expands the findings in place. `src/review-home.js` listens for real review results and updates the proof with validated detected colours, the actual font names when available, and the reviewed domain. Desktop/mobile view changes update the same proof. Missing findings remain explicit; closing or an error restores the labelled example. The specimen stays an illustration and never downloads arbitrary fonts from the visited website. Palette labels choose a contrasting foreground. Existing screenshots, optional details/contrast, PDF/print export, local storage and brief continuity remain available.

## Real collaborations first

`lib/selected-work.mjs` curates Rekom, BAT, Reformed Cleaning, Red Bull, Selfmade Records, Freshpoint and Ild.Pizza using the supplied marks. Red Bull remains a text reference until an approved image is supplied. The close-seamed, two-column client wall uses large marks, small sequence numbers and integrated captions. Its final tile spans both columns. Cards are native links, with clear pending-case labels. No project photography or outcomes are invented. Published matching client stories automatically use their approved gallery cover and a case link label; drafts and unselected concepts cannot appear as commissioned work.

`/cases` uses the same collection. Forma and Offscript remain available through a smaller studio directory and `/studio/arkiv`, with their individual layouts, formats, reasoning, details, galleries and comparison controls. The optional reel remains on the studio and archive routes. Inspiration saves remain available on the case pages and continue into the planner.

## A simpler path through the studio

Primary navigation starts with BETA_REVIEW, followed by Work, Studio and Client portal. Services remain available in the menu and from four direct homepage links, each selecting the corresponding service in the project brief. The shared subpage shell in `public/atelier.css` is reduced to header/footer, public-page styling and menu motion. The unused hero/project/service controllers and old project-rendering module are deleted.

Static line masks reveal each logical heading line with a short transform entrance. Cards and action arrows use brief opacity/translate entrances. Homepage service rows wipe to blue on hover or focus. The live proof straightens when actual findings arrive and resets to the labelled sample on close/error. Reduced-motion preferences stop running entrances immediately. The result expansion, small interactive disclosures and compositor menu slide keep their established behavior. There is no continuous hero rendering, automatic video, cursor-following preview or page-navigation delay. Native links and the full selected-client collection remain usable without JavaScript; a visible note explains that analysis requires JavaScript.

## Public pages and materials

Cases open with a blue typographic statement and an edge-to-edge client wall. Studio opens in black, followed by a full-width material study and a warm-white manifesto. Services use a warm-white statement and oversized editorial chapters. The planner, archive, inspiration, visual-direction and privacy pages use the same public identity while keeping their existing task controls. The two concept editions keep their own distinctive project imagery and presentation. Private portal/authentication and data models are not changed.

`public/fonts/syne-latin-variable.woff2` is a Latin subset of the variable [Syne font from Google Fonts](https://github.com/google/fonts/tree/main/ofl/syne), licensed under SIL OFL 1.1; the full license is beside the asset. It is self-hosted, preloaded and adds no runtime font service. Inter remains self-hosted too.

`public/work/beta-paper-{1536,768}.webp` are responsive exports of an image generated for Beta on 2026-10-26: cobalt paper, a torn ivory edge, black backing and raking light, with no generated lettering or logo. This is an own-studio material study, not a client deliverable or documentary project photo. It appears in the Review backdrop and Studio page. The backdrop uses a fixed image size so expanding a report does not recrop the composition. There is no video request or continuous hero animation.

## Verification

`test:statement` covers 48 bilingual responsive views, the local display font, readable headings, the white-on-black shell, mobile menu geometry, the material image, reduced-motion changes during a real entrance, and no-JS pages. New font and material exports have explicit delivery budgets.

`npm test` includes the standalone CSS contract, selected-client curation, published-story boundary, escaping and bilingual rendering alongside the existing server/security tests. `test:hero` now checks the Review-first opening, eight responsive/bilingual combinations, the action above the fold, Enter submission, live proof updates, viewport switching, reset/error focus and no-JS access. `test:projects` now checks twenty selected-work combinations and native client/concept navigation. `test:services` covers all four service-to-brief links in two languages and three widths. Menu, shared pages, case experiences, comparison dragging, Review exports and private portal workflows retain their relevant checks.
