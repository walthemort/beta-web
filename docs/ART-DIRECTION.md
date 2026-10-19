# Public site art direction

This pass turns the public site into a more cohesive creative studio portfolio. The approved ribbon hero, actual Beta identity and compact client loop remain the visual starting point.

- Work appears before the lead tool, with asymmetric project compositions and new tactile concept artwork.
- Warm paper sections give the Review, Services and enquiry flow a clear hierarchy against the dark studio pages.
- Service names use plain language, with a quieter capabilities index and restrained detail lists.
- Case pages lead with artwork; Studio leads with a large material study and a shorter manifesto.
- The homepage enquiry buttons use the complete project planner. Service selections and saved inspiration carry into the same brief.
- Copy, controls, captions, footer, privacy and inspiration pages follow the same spacing and typography system.
- Text and action entrances are shorter and coordinated. Pointer effects reset when scrolling, dragging, cancelling or leaving the window. Reduced motion keeps a compact, horizontally scrollable client strip.

Forma and Offscript remain clearly labelled concept projects. Their new generated images are illustrative art direction, not evidence of commissioned client work. The seven real-client pages remain holding pages until approved material is available. No results, testimonials or pricing were invented.

`public/editorial.css` contains the shared system and homepage direction. `public/subpages-art.css` contains the public subpage compositions. Both load after the existing component styles. The client portal and its authentication/data flows are outside this visual pass.

Images have responsive 768px and 1536px WebP versions. Their encoded sizes are covered by `test:budget`; existing CSS and JavaScript budgets remain unchanged. Run `build:studio` after changing the motion source. Verification includes the root suite, `test:studio`, `test:ui`, `test:adaptive` and `test:overhaul`.

A subsequent simplification pass removes the logo pause button, hover pausing, decorative menu numbers and repeated slogans/metadata around headings, comparisons and calls to action. The client loop continues on hover; keyboard focus pauses moving links and reduced-motion preferences keep the static row. Concept disclosures, practical instructions and local-save/privacy feedback remain visible.

## Service atelier

The homepage services now pair four numbered, single-open stories with a desktop visual study that follows exploration. The studies reuse existing concept artwork and are labelled as studies. Hover wipes, plus/minus controls and staggered body content share a restrained motion rhythm. Repeated clicks reverse from the current height; a responsive reflow or reduced-motion change clears height constraints.

Service selection stays separate from expansion. Keyed selection chips keep their controls, use the existing `beta:services` planner state and return keyboard focus after removal. Storage failures are announced. Run `npm run test:services` for motion reversal, preview stability, keyboard selection, persistence, planner continuity, bilingual layouts and responsive/reduced-motion behavior.

## Project collection and public edition

The public edition takes its blue chapter heading, curved paper transition and compact grid from the user's Framer screenshots while retaining Beta's existing hero artwork, wordmark, Review and service atelier. The Framer URLs initially returned a proxy CONNECT 403. After the user activated the saved network draft, both returned HTTP 200 and the earlier reference was inspected in Chromium. See `docs/FRAMER-REFERENCE.md` for the confirmed FrameAuth snippet and the motion reference.

The homepage renders six projects first and expands to the full catalog. The archive renders every project and adds category and saved filters. `lib/projects.mjs` joins approved/published case entries with client holding pages without duplicating clients or inventing project material. Holding cards use existing client marks; concepts retain their labels. Uploaded case photography can replace the holding presentation when approved.

Native case links open an optional animated dialog with previous/next controls, keyboard navigation, focus restoration and a link to the full case. Without JavaScript, links navigate directly and the complete archive remains accessible. The dialog, gallery expansion, saved filters and reduced-motion transitions are covered by `npm run test:projects`. Image arrivals extend to public service, studio, case, inspiration and privacy content; the authenticated portal is outside this edition.


## Scroll scenes

Existing about, studio and case headings now fill progressively with scroll, retaining their actual selectable text and brand colours. The blue project chapter's paper edge flattens as it passes. These scenes use native page scrolling, schedule work only for visible scenes after scroll/resize, and do not pin the page. Reduced motion, unsupported CSS, printing and forced-colour modes show solid readable type. The user has authorized the older-logo montage as a temporary hero while the new version renders. It is now optimized and replaceable, with optional full-film playback.


## Film-first homepage

The hero now contains only the wide film and its play/pause/full-film controls. The former oversized headline, supporting paragraph and split-screen gradient are removed. A short studio introduction and project/Review links sit below the frame. The video keeps its full composition on desktop and mobile, and the fallback image is steady. This supersedes the former pointer-driven ribbon parallax and text-over-art hero layout.
