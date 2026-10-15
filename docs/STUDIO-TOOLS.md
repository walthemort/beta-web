# Beta studio tools

Two focused public pages are linked from the homepage Review and from one another. Services also leads to the visual direction tool. Both support Danish and English routes.

## Logo under pres — `/logo-test`

Visitors choose or drop a local SVG, PNG, JPEG or WebP, up to 5 MB, or try the actual Beta mark. The browser shows the logo in a 16px tab, profile circle, card, large surface and monochrome simulation. Light, dark and Beta-blue backgrounds can be selected. File type, transparency and dimensions are observations; this is not an automated quality score or print-production check.

Uploads stay in the current tab. SVG markup is validated and decoded as an image, then rasterised to PNG. Scripts, animation, embedded HTML and external resource links are rejected. No uploaded markup enters the document, and no file is posted to the server. Visitors can export an actual PNG test sheet and a transparent 32px PNG favicon.

“Take it into your brief” stores only bounded file information and the visitor's note. The file itself is never attached. The saved context can be removed on returning to the tool; the in-memory image can be removed independently.

## Visuel mavefornemmelse — `/retning`

Three pairs of illustrative concept studies explore energy, surface and rhythm. Results display exactly the visitor's chosen preferences, not inferred personality traits or an AI assessment. Choices and a note persist locally. Visitors can go back, revise, reset, export a PNG reference board, and carry their direction into the project brief.

`public/lab-data.js` owns the bilingual choice catalog and strict context normalisers. `public/lab.js` handles the two tools, local image processing and exports. `public/lab.css` and the tool script load only on these routes. Existing artwork is reused; no client work is invented.

## Brief continuity

`public/lab-context.js` shows complete saved directions and explicitly saved logo tests in the planner. Each can be included or excluded. The on-screen brief includes the chosen reference images; the text download includes preferences, file information and notes. Logo image data is never stored in the brief context. Nothing is submitted to Beta automatically. Storage failures remain explicit and do not claim that context was carried across pages.

## Verification

Run `npm run test:lab` for bilingual layouts at 360, 390, 768 and 1440px, valid/invalid SVG and raster input, external-resource rejection, drag/drop, image and brief downloads, keyboard selection, persistence, reset/removal, include/exclude controls, no-JS and blocked-storage behavior, and the transparent Beta favicon. The core suite also covers catalog validation and bounded metadata. Performance budgets include the new modules and separately loaded tool assets.
