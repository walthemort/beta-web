# Public art direction — an image-led studio edition

The supplied Beta wordmark sets the direction: sharp terminals, stretched proportions and a feeling of forward movement. Those qualities become fixed photographic cuts, oblique sans-serif emphasis and a staggered composition. The actual logo files remain untouched. Brand colours remain `#1B4DFF`, `#F6F4EF` and `#0B0B0E`.

## Two perspectives

The homepage opens in blue with Offscript’s concept photograph. “Kant / Ro” (“Edge / Calm”) changes the hero’s palette and photograph to Forma’s quieter paper-and-material study. The composition and page height remain steady. The visible image is a native case link with a clear concept label. Without JavaScript, the first case link and heading remain visible; the interactive controls stay hidden.

The second image decodes before selection. Request generations prevent stale selections from replacing a more recent click. Failed decoding leaves the existing picture and case link usable, announces the issue and permits a retry. Arrow keys, Home and End operate the two buttons. A focused case link is returned to the chosen button before its panel is hidden. Reduced motion, including a live preference change, cancels animations. Neither selection nor scroll starts an idle rendering loop.

Image frames use a static angled cut. Only opacity and transform animate on the photograph; the shape itself does not morph. The hero background colour transitions briefly when explicitly switching perspectives. No hero film or substitute brand mark is used.

## Composition across the site

The blue opening leads into a slim black logo loop and a light project chapter. On desktop the homepage’s project photograph is on the left and the index on the right. A blue angled field identifies the selected concept; mobile keeps the compact horizontal index above the picture. The project photograph has a small cut corner. Its metadata, native case navigation and inspiration saves remain available.

Large oblique sans-serif accents replace the earlier serif emphasis in public page introductions, the studio statement and contact chapters. The service section stays blue; the studio statement stays black. Review and concise FAQs use paper, followed by the blue contact chapter and the original large footer wordmark. The services subpage opens in blue; the studio manifesto shares the homepage’s ink palette. All new copy is translated into English.

Service disclosures and image crossfades, the project brief and private portal retain their behavior. Forced colours removes the photographic cuts and supplies explicit selection outlines. Focusable image links keep their outline outside the cut image wrapper.

## Cases, rebuilt

The former staggered card grid and expanding project modal are replaced by a project index and a single visual stage. The homepage contains the available illustrated concept studies. `/cases` contains those concepts and the real client entries, with brand/digital/client/saved filters. The opening, index, stage and mobile composition are rebuilt together.

Desktop puts the names beside the image, with a clear selected state and a native full-case link. Mobile uses a horizontally scrollable index above the image. The stage retains its image dimensions and enough caption space to avoid reflow for the current catalog. No visual changes happen merely because the mouse passes across a row. Arrow keys, Home and End navigate the visible index. Filtering returns focus safely when it removes an active saved project. Empty and storage-denied states remain usable.

Panels decode only on request and are cached. Request generations prevent an earlier image or filter request from replacing a newer selection. One brief opacity/translate transition introduces the selected panel. There is no image pan, clip-path animation, large height animation or modal close sequence. Without JavaScript, every index entry is a native case link and the first project stays visible.

Concepts retain their labels. Client pages use supplied marks and explicit pending-material copy; no project photography, metrics or stories are invented. Existing inspiration saves and the project brief remain connected through the same local storage key.

## Motion and rendering

Public page navigation is native. Cross-document screenshot transitions, body fade redirects, scroll-linked gradient text, per-node text splitting, cursor-following project arrows, magnetic actions and the animated SVG gesture are removed. Heading entrances use only short opacity/transform animations. A single observer handles these entrances, which run once. Logo edges retain a soft mask without backdrop blur. The client strip still moves on hover, pauses under keyboard focus, and becomes manually scrollable for reduced motion.

The fullscreen menu opens with a compositor slide and closes in 180 ms, without a changing clip mask. The plain white floating burger, focus return, scroll lock and interrupted/reduced-motion closing remain supported. Service and FAQ disclosures retain their small, interruptible height animations; service imagery now crossfades briefly without a mask or image zoom. Comparison dragging remains intact.

## Verification

`npm test` covers the server and data boundaries. `test:hero` checks perspective switching, stable page geometry, decode races, failures/retry, keyboard focus, live reduced motion, bilingual responsive presentation and native no-JS links. `test:projects` checks the new index/stage, stable image dimensions, selection/filter races, direct case links, saved panel state, keyboard/focus, bilingual responsive layouts, no JavaScript and denied storage. `test:studio` checks removed effects, menu slides/reversal, focus, logo behavior and inspiration continuity. `test:overhaul` covers 54 bilingual responsive routes and the existing planner/privacy/gallery flows. `test:services`, `test:adaptive` and `test:budget` retain their respective checks. The former scroll-scene test and its removed runtime are retired.

Local rendering measurements and their practical limits are recorded in [RENDER-PERFORMANCE.md](RENDER-PERFORMANCE.md).

## Concept editions and the studio collection

The six experiences in [CASE-EXPERIENCES.md](CASE-EXPERIENCES.md) build on this direction. Forma now uses warm paper, a serif masthead and an offset image/gallery composition; Offscript uses stacked type, a blue opening and a dark campaign chapter. Print/web/campaign compositions, expandable design reasoning and photographic detail points provide distinct ways into the work. The new studio archive and on-demand reel are linked from the homepage and studio. The concept/published boundary keeps these explorations out of real client stories.
