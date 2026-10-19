# Public art direction — an image-led studio edition

The site keeps warm white, Beta blue, black and the supplied wordmark. The opening now pairs a three-line editorial heading with an asymmetric spread of Offscript and Forma concept photographs. Each photograph is a native case link, with visible project names and a shared concept-study label. Responsive crops preserve the image-led composition on mobile. The experimental blue gesture has been removed from the homepage, contact and every public subpage. It did not communicate a clear enough connection to the brand. No hero film or new substitute brand mark is used. The actual logos are unchanged.

## Composition across the site

The homepage progresses from paper and photography to a slim blue logo loop, a light project index, full-blue services and an ink-black studio manifesto. The manifesto uses a larger statement above the studio introduction and three practical principles. Review returns to paper, with a muted flat input field, followed by concise FAQs and the blue contact chapter. The services subpage opens in blue; the studio manifesto shares the homepage’s ink palette. The real Beta wordmark remains large and readable in the header and footer.

Service study crossfades use the concept collection rather than the old sculptural hero and branded poster mockup. The accordion, independent service selection, saved inspiration, project brief and private portal keep their existing behavior. All new copy has a matching English translation. The two concept photographs also use the existing one-shot reveal observer, so there are no idle image loops or pointer tracking.

## Cases, rebuilt

The former staggered card grid and expanding project modal are replaced by a project index and a single visual stage. The homepage contains the available illustrated concept studies. `/cases` contains those concepts and the real client entries, with brand/digital/client/saved filters. The opening, index, stage and mobile composition are rebuilt together.

Desktop puts the names beside the image, with a clear selected state and a native full-case link. Mobile uses a horizontally scrollable index above the image. The stage retains its image dimensions and enough caption space to avoid reflow for the current catalog. No visual changes happen merely because the mouse passes across a row. Arrow keys, Home and End navigate the visible index. Filtering returns focus safely when it removes an active saved project. Empty and storage-denied states remain usable.

Panels decode only on request and are cached. Request generations prevent an earlier image or filter request from replacing a newer selection. One brief opacity/translate transition introduces the selected panel. There is no image pan, clip-path animation, large height animation or modal close sequence. Without JavaScript, every index entry is a native case link and the first project stays visible.

Concepts retain their labels. Client pages use supplied marks and explicit pending-material copy; no project photography, metrics or stories are invented. Existing inspiration saves and the project brief remain connected through the same local storage key.

## Motion and rendering

Public page navigation is native. Cross-document screenshot transitions, body fade redirects, scroll-linked gradient text, per-node text splitting, cursor-following project arrows, magnetic actions and the animated SVG gesture are removed. Heading entrances use only short opacity/transform animations. A single observer handles these entrances, which run once. Logo edges retain a soft mask without backdrop blur. The client strip still moves on hover, pauses under keyboard focus, and becomes manually scrollable for reduced motion.

The fullscreen menu opens with a compositor slide and closes in 180 ms, without a changing clip mask. The plain white floating burger, focus return, scroll lock and interrupted/reduced-motion closing remain supported. Service and FAQ disclosures retain their small, interruptible height animations; service imagery now crossfades briefly without a mask or image zoom. Comparison dragging remains intact.

## Verification

`npm test` covers the server and data boundaries. `test:projects` checks the new index/stage, stable image dimensions, selection/filter races, direct case links, saved panel state, keyboard/focus, bilingual responsive layouts, no JavaScript and denied storage. `test:studio` checks removed effects, menu slides/reversal, focus, logo behavior and inspiration continuity. `test:overhaul` covers 54 bilingual responsive routes and the existing planner/privacy/gallery flows. `test:services`, `test:adaptive` and `test:budget` retain their respective checks. The former scroll-scene test and its removed runtime are retired.

Local rendering measurements and their practical limits are recorded in [RENDER-PERFORMANCE.md](RENDER-PERFORMANCE.md).
