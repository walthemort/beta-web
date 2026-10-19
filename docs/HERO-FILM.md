# Temporary hero film

The uploaded `Final Comp.mp4` is temporarily used with the user's explicit authorization while the new-logo film renders. It is an 18-second montage. The original 4K/60fps master is not served or committed.

The website uses:

- `public/work/hero-loop.mp4`: silent 1280×720 / 24fps desktop background, about 2.4 MB.
- `public/work/hero-loop-mobile.mp4`: silent 640×360 / 24fps mobile background, about 745 KB.
- `public/work/beta-brand-film.mp4`: 1280×720 / 30fps full film with AAC audio, about 3.4 MB; fetched only when requested.
- `public/work/hero-film-poster.webp`: static first-frame poster.

All MP4s have fast-start metadata. The server streams validated public video assets with single-byte-range, suffix-range, HEAD and 416 support, allowing native seeking without loading files into a full response buffer.

## Behavior

The hero presents the film in a wide frame with no overlaid headline or marketing copy. Its complete composition is preserved with `object-fit: contain`, including on mobile; there is no side gradient or image parallax. A compact introduction and project/Review links live directly below the film. Navigation and those links are usable immediately. Hero playback is muted, inline and loops. A pause/play control is provided. Playback pauses offscreen, in a hidden tab, while the full-film dialog is open, and on page leave; a user's pause survives scrolling. Reduced-motion and data-saving preferences prevent automatic video fetching/playback; the existing ribbon artwork remains the fallback. Explicit play is available. Failed hero playback preserves the artwork and full-film button.

The full film opens on request with native controls, including audio and seeking. Escape, the close control and backdrop clicks close it, pause audio and return focus. Closing resumes the background only when current preferences and the user's pause state permit it. No-JavaScript visitors retain the static hero.

## Replace with the new rendering

With FFmpeg installed, run:

```sh
bash scripts/encode-hero-film.sh /path/to/new-brand-film.mp4
```

The script recreates the four web exports at stable paths, preserving the new master outside public assets. Then bump `?v=1` on the film/poster URLs in `public/index.html` to a new version so cached browsers receive the replacement. Adjust the web encoding if a materially different edit exceeds the existing media budgets; do not raise budgets to hide oversized assets.

FFmpeg is needed only to regenerate exports, not to install, build or run the website. Run `npm run build:studio`, `npm test`, `npm run test:film` and `npm run test:budget` after replacing media or changing playback behavior. The browser test checks actual decoded desktop/mobile playback, manual pause, offscreen suspension, full-film seeking/focus, reduced-motion/data-saving/no-JS behavior and missing-video fallback.
