# Beta visual direction tool

Visuel mavefornemmelse is linked beneath the homepage Review and from Services, at `/retning` and `/en/retning`.

Three pairs of illustrative concept studies explore energy, surface and rhythm. Results display exactly the visitor's chosen preferences, not inferred personality traits or an AI assessment. Choices and a note persist locally. Visitors can go back, revise, reset, export a PNG reference board, and carry their direction into the project brief.

`public/lab-data.js` owns the bilingual choice catalog and context validation. `public/lab.js` handles the choices and PNG export. `public/lab.css` and the tool script load only on the direction routes. Existing artwork is reused; no client work is invented.

## Brief continuity

`public/lab-context.js` shows complete saved directions in the planner. Visitors can include or exclude them. The on-screen brief includes the chosen reference images; the text download includes preferences and notes. Nothing is submitted to Beta automatically. Storage failures remain explicit and do not claim that context was carried across pages.

## Logo testing

Logo under pres has been removed from the Beta website, including its routes, links, uploads, exports and planner integration. Legacy `beta:logo-test` browser metadata is ignored. Logo testing belongs with the separate Aftryk app; the app's future name is deferred to a separate conversation. The original implementation remains available in Git history.

## Verification

Run `npm run test:lab` for bilingual layouts at 360, 390, 768 and 1440px, image and brief downloads, keyboard selection, persistence, reset, include/exclude controls, no-JS and blocked-storage behavior, and the transparent Beta favicon. It also verifies removed logo routes and links, and exclusion of legacy logo metadata from briefs. The core suite covers catalog validation and the retained bilingual route. Performance budgets include the shared modules and separately loaded direction assets.
