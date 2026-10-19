# Archived film exports

The user requested a fresh, non-video direction after trying the older-logo montage. The current public homepage contains no video, film controls, media frame or fallback artwork. The film player and parallax modules and their obsolete browser test have been removed. `npm run test:studio` verifies the new typography, no hero media requests, responsive layout, reduced motion and no-JavaScript content.

The 18-second uploaded `Final Comp.mp4` was optimized into these retained, inactive assets. The original 4K/60fps master is not served or committed.

- `public/work/hero-loop.mp4`: silent 1280×720 / 24fps, about 2.4 MB.
- `public/work/hero-loop-mobile.mp4`: silent 640×360 / 24fps, about 745 KB.
- `public/work/beta-brand-film.mp4`: 1280×720 / 30fps with AAC audio, about 3.4 MB.
- `public/work/hero-film-poster.webp`: a static first-frame poster.

All MP4s retain fast-start metadata. The server supports byte ranges, HEAD, suffix requests and 416 responses; unit and HTTP tests cover this independently of the website UI.

To regenerate the archived exports with FFmpeg:

```sh
bash scripts/encode-hero-film.sh /path/to/new-brand-film.mp4
```

Encoding does not enable video on the site. FFmpeg is not required to install, build or run the app.
