# Full-bleed hero film

The homepage uses the uploaded 18-second `Final Comp.mp4` montage as a muted, looping background. It fills the hero with a centred `object-fit: cover` crop. The compact BETA_REVIEW headline, URL field and playback button sit at the bottom, leaving the centre clear. The hero has no video frame, letterboxing or video parallax. Findings expand beneath the hero, with the live identity proof visible only after an actual result arrives.

`src/hero-film.js`, bundled into `public/review-home.js`, manages one native video. It selects one responsive source, pauses when the hero leaves view, when the menu opens, or when the tab is hidden, and resumes only when appropriate. A manual pause persists across scrolling and menu changes. The initial reduced-motion or data-saver view loads the poster without an MP4 request; explicit playback remains available. A preference change stops playback immediately. Autoplay rejection leaves a usable play button, and a media error keeps the poster and working Review form. Without JavaScript the poster and page content remain visible.

The original 4K/60fps master is not served or committed. Existing optimized exports are reused:

- `public/work/hero-loop.mp4`: silent 1280×720 / 24fps, about 2.4 MB, desktop background.
- `public/work/hero-loop-mobile.mp4`: silent 640×360 / 24fps, about 745 KB, mobile background.
- `public/work/beta-brand-film.mp4`: retained 1280×720 / 30fps with AAC audio; not downloaded by the hero.
- `public/work/hero-film-poster.webp`: static first-frame fallback.

The compact hero replaces the earlier blue paper opening; the paper material study remains on Studio. All MP4s retain fast-start metadata. The server supports byte ranges, HEAD, suffix requests and 416 responses.

To replace the film with the new-logo render, re-encode its master with FFmpeg:

```sh
bash scripts/encode-hero-film.sh /path/to/new-brand-film.mp4
```

Keep the same export paths to update the background and poster together. FFmpeg is not required to install, build or run the site. Run `npm run build:studio` after controller changes. `test:hero-film` covers real desktop/mobile playback, the clear centre, bottom-dock geometry, responsive requests, pause/resume, motion/data preferences, media failure and no-JS fallback. `test:hero` retains the real Review/viewport/export boundary and responsive layout checks.
