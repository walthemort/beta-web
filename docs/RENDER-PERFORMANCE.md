# Public rendering pass

The performance pass accompanies the new project index/stage and removal of the rejected blue gesture. Removed work includes scroll-linked text-gradient painting, text-node splitting, pointer-driven image pans and magnetic actions, SVG clip/draw animation, backdrop blur over the moving client strip, whole-page view-transition snapshots and modal project clipping/height animations. Service studies now crossfade without zoom or masks. The fullscreen menu slides using transform and closes in 180 ms.

## Local sample

Chromium, 1440×1000, 4× CPU throttling, fonts loaded, 1.5 seconds to settle, then 180 animation-frame scroll steps over the complete homepage. The earlier design and rebuilt homepage have different content/layout lengths; this measures their actual full-page rendering work under the same sampling procedure. Samples were run without other browser test suites. The earlier revision was `4d10bc0`.

| Timeline measure | Earlier design | Rebuilt design |
| --- | ---: | ---: |
| Paint events | 694 | 214 |
| Paint time | 255.6 ms | 83.3 ms |
| Style update time | 163.6 ms | 96.7 ms |
| Layout events | 19 | 12 |
| Layout time | 18.1 ms | 11.2 ms |
| 95th percentile frame interval | 17.7 ms | 17.8 ms |
| Frame intervals over 32 ms | 2 | 0 |

Paint time falls by about 67% in this local sample. Frame cadence remains close to the display interval; this is not a universal FPS improvement claim and does not reproduce the user’s GPU or establish the cause of every reported stall.

Run `npm run profile:scroll` for the same procedure. It prints a JSON summary and saves `beta-scroll-profile.json` in the system temporary directory. An optional path can be passed after `--`. Each run uses its own ephemeral test server and closes its browser/server. The command is a diagnostic, not a hardware-dependent pass/fail test.

`test:studio` checks that removed effects stay absent, menu motion uses transform, and scroll lock/focus are restored. `test:projects` checks steady image dimensions, cancellation of stale decoded selections and filters, native case links, saved panel state, keyboard/mobile/no-JS behavior and empty states. Service and review/planner flows retain their own browser checks.

## Image-led edition

The following visual pass adds two linked hero concept photographs to the same one-shot opacity/translate observer. It keeps the project index and all removed-effect constraints. An isolated sample using the same procedure recorded 218 paints / 104.4 ms paint time, 18 layouts / 35.0 ms layout time, a 17.5 ms 95th-percentile frame interval and two intervals over 32 ms. These are local diagnostic samples, not a promise of zero dropped frames on other hardware. No image panning, scrolling blur, word gradients or continuous hero render loop has been added.

## Selectable perspectives

The next edition uses a fixed angled photographic crop and explicit Edge/Calm controls. The image crop never morphs. Selecting a perspective decodes the requested image, then runs a short opacity/translate entrance and a brief background-colour transition. Scroll keeps the existing one-shot heading reveals and no continuous hero render loop.

An isolated run using the same 1440×1000 / 4× CPU procedure recorded 216 paints / 82.8 ms paint time, 18 layouts / 18.4 ms layout time, a 17.5 ms 95th-percentile frame interval and one interval over 32 ms. Treat run-to-run differences as local measurements rather than a cross-device FPS guarantee. `test:hero` covers rapid changes, failed decoding/retry, stable geometry, keyboard access, reduced motion and the primary action on a shorter desktop display.

## Case experiences and on-demand reel

The homepage adds a compact studio teaser. Its native MP4 link is enhanced by a small modal controller; the browser test confirms that there is no video element or MP4 request before a click. Closing removes the media and releases its source. Case-format, detail and archive styles/scripts are delivered on the relevant routes rather than loaded into the homepage.

An isolated run of the established 1440×1000 / 4× CPU homepage procedure recorded 222 paints / 98.5 ms paint time, 20 layouts / 30.0 ms layout time, a 17.7 ms 95th-percentile frame interval and one interval over 32 ms. The new teaser changes the homepage length, so this remains a local full-page diagnostic, not an identical-content comparison or a measurement of every case page. Common delivery budgets still pass; route-specific assets and the 24-second encoded reel are reported separately.

## Review-first foundation

The homepage is now independent of the legacy homepage CSS and the old concept/project/service controllers. Its two stylesheets total about 7.5 KiB gzip in the delivery check; the common subpage styles are measured separately. The first screen contains native text, the supplied logo, a labelled Beta identity example and the Review form. The moving logo track, concept photography and studio reel teaser are absent from the homepage. No video is requested there.

An isolated run of the same 1440×1000 / 4× CPU procedure recorded 24 paints / 26.6 ms paint time, eight layouts / 8.2 ms layout time, a 17.5 ms 95th-percentile frame interval and no sampled interval over 32 ms. Content and page length have changed; these remain local diagnostic measurements, not a guarantee for every device. The new client collection uses supplied SVG marks until approved project covers are published.

`test:hero` now validates Review-first responsive/bilingual structure, a primary action visible on shorter screens, real Enter-to-review submission against a controlled response, live proof updates, viewport changes, close/error focus and no-JS client links. `test:projects` and `test:services` cover the replacement native client and service flows. Tests of the retired Edge/Calm hero, project index and home service-selection widget have been replaced with checks of the new behavior.

## Statement edition

The public identity now uses a self-hosted 42.1 KiB Syne display font alongside Inter, responsive paper material exports (192.2 KiB desktop / 25.8 KiB mobile), static line masks with short transform entrances, and a close-seamed client wall. The paper backdrop has a fixed image size during report expansion. There is no continuous hero renderer, scrolling blur, automatic video or per-frame text painting.

An isolated 1440×1000 / 4× CPU full-homepage sample recorded 81 paints / 54.9 ms paint time, 25 layouts / 25.0 ms layout time, a 17.5 ms 95th-percentile frame interval and no sampled interval above 32 ms. This is a local diagnostic of the new content and page length, not a hardware-independent smoothness guarantee. Homepage CSS is 10.1 KiB gzip; public JavaScript is 50.8 KiB gzip. All existing delivery limits still pass, with explicit budgets added for the new font and material exports.

`test:statement` adds 48 bilingual responsive checks, heading readability, material-image decoding, mobile menu geometry, a running text entrance cancelled by a reduced-motion change, and no-JS access. The existing Review/client/service/menu/planner/case/reel/compare/export checks remain in use.
