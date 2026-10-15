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
