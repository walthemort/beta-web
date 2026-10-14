# Public website overhaul — 50 improvements

Scope: all public pages, Danish and English. Keep the approved ribbon hero and plain white burger. Client portal and authenticated studio tools are outside this pass. Placeholder client stories remain placeholders. No made-up prices, team members, results or booking links.

## A coherent visual system

1. Use one content width and consistent page gutters across public pages.
2. Replace uneven section gaps with a shared spacing scale.
3. Give every page introduction the same restrained hierarchy.
4. Replace the remaining heavy block headings with editorial typography.
5. Make small labels readable without excessive tracking or capitals.
6. Set a comfortable reading width and line height for body copy.
7. Unify primary, secondary and text-link button sizes and states.
8. Give links, form controls and disclosure buttons consistent focus rings.
9. Reserve scrollbar space and image geometry to prevent layout jumps.
10. Bring footer typography and navigation out of the tiny-label layout.

## Navigation and the homepage

11. Use the same navigation order and portal link on every page.
12. Mark the active public route consistently in header and menu.
13. Add an accessible skip link to the homepage as well as subpages.
14. Reduce menu entrance delay and keep the fast closing response.
15. Make menu navigation land immediately after its close animation.
16. Keep header and floating burger touch targets large with plain white strokes.
17. Move embedded client logos into cacheable files to shrink homepage HTML.
18. Make the client strip behave well at every width and on keyboard focus.
19. Clarify the website-review input and give its result area an accessible name and busy state.
20. Make the homepage service summary compact when nothing is selected.

## Cases and project stories

21. Fix the narrow-screen overflow on the cases index.
22. Show complete case artwork in consistent reserved frames.
23. Turn case filters into a readable toolbar with an obvious active state.
24. Make saved-case controls compact while keeping their accessible labels.
25. Link the saved filter directly to the inspiration board.
26. Present client holding pages as a compact directory instead of oversized empty stories.
27. Stop injecting fake galleries/comparisons into unpublished client holding pages.
28. Simplify case hero metadata and the route back to the work index.
29. Rebuild the case gallery as a balanced cover plus two supporting images.
30. Give case stories, palette sections and comparison tools matching typography.

## Services and studio

31. Present services as clear editorial offerings with consistent dividers.
32. Reduce visual clutter in service deliverable tags.
33. Give each service a clearly labelled project-start link.
34. Replace the repeated process explanations with one concise interactive process.
35. Improve process-tab layout, focus and selected-state contrast.
36. Make the studio manifesto a balanced image-and-story composition.
37. Reduce repeated supporting labels on the studio page.
38. Make studio principle disclosures consistent with the rest of the site.
39. Keep conceptual studio imagery clearly labelled and correctly proportioned.
40. Use one concise next-project CTA treatment across subpages.

## Enquiry and utility flows

41. Rebuild planner service choices so mobile titles and descriptions fit.
42. Hide the empty planner sidebar until it has useful context.
43. Show whether a project draft was saved locally or could not be saved.
44. Offer undo after clearing a local draft.
45. Make step changes and validation guide keyboard focus predictably.
46. Give an unconfigured booking flow an honest, useful next step after export.
47. Replace the empty inspiration board with a clear browse-and-save starting point.
48. Improve note fields and saved-card layout in the inspiration board.
49. Reformat privacy information and consent controls into readable, compact sections.
50. Add a branded, useful public 404 page with correct HTTP status and localised navigation.

## Completion evidence

Items 1–50 are implemented in this public-page pass.

| Items | Implementation |
| --- | --- |
| 1–10 | `public/editorial.css`: shared spacing, width, type, controls, focus, media geometry and rebuilt footer. |
| 11–20 | `lib/site.mjs`, `src/studio.js`, `public/navigation.js`, homepage markup and client-strip builder: consistent navigation, active routes, skip link, faster menu entrance, cacheable logos and review state. |
| 21–30 | Cases index/detail styles, compact save controls and inspiration shortcut, truthful client holding-page rendering, balanced gallery and story typography. |
| 31–40 | Editorial offerings, labelled start links, one interactive process, studio image/story composition, principle disclosures and consistent next-project CTA. |
| 41–46 | Planner layout and `public/pages.js`: single-column mobile options, contextual sidebar, honest local save/error status, clear/undo, validation focus and unconfigured-booking fallback. |
| 47–50 | Inspiration empty states and note feedback, correct multiple-removal persistence, readable privacy sections and consent focus return, bilingual public 404 rendering. |

Verification: 54 route/locale/width checks (nine pages × two languages × three widths), gallery keyboard navigation, process-to-planner selection, brief download, draft clear/undo and validation, unavailable-storage feedback, multiple saved-case removal, consent focus, localised HTTP 404 responses. Existing 22 website tests plus studio, comparison and adaptive-browser checks pass. Gzip budgets pass; homepage HTML decreased from roughly 144 KiB to 4.4 KiB by referencing the existing logos as cacheable files. Logo assets remain served separately.

Run `npm run test:overhaul` for the new public-page/flow checks, `npm run build:clients` after changing the logo manifest, and `npm run build:studio` after editing studio interactions.

Remote booking configuration and approved client assets remain separate content inputs. The portal and its authenticated workflow have not been rebuilt in this pass.
