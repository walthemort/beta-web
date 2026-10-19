# Framer reference access and FrameAuth

References supplied by the user:

- https://make-circle-364735.framer.app/
- https://inexpensive-direction-528222.framer.app/

After the user activated the network draft, both reference documents returned HTTP 200. The earlier version was also rendered in Chromium to inspect the actual composition. Chromium does not trust the cloud proxy CA, so the read-only inspection fulfilled public resources fetched by curl using verified system TLS. Certificate verification was not disabled. Only the reference host and `framerusercontent.com` were fetched; analytics and unrelated destinations were not loaded.

The earlier page's large typographic chapters, curved transitions and progressive type reveals inform the scroll-linked type and chapter motion. The website retains Beta's existing hero, actual wordmark, Review and compact project collection.

## Confirmed FrameAuth script

The newer published page still includes this script at the start of the body, inside Framer snippet `jynODyGMm`:

```html
<script src="https://cdn.jsdelivr.net/npm/@framerauth/sdk@2/dist/framerauth.js" id="framerauth-v2-plugin-script"></script>
```

The earlier reference does not include that SDK. The user's report of a remaining FrameAuth banner is therefore consistent with a live integration still being injected in the newer published page.

Search site/page Custom Code and the remaining FrameAuth plugin/integration for `framerauth-v2-plugin-script` or `@framerauth/sdk`. Remove the integration/snippet and republish the affected pages, then check the published source and a private window. The exact editor location has not been accessed. No changes have been made to the user's Framer project.

## Uploaded motion reference

`Final Comp.mp4` was inspected: 18 seconds, 3840×2160, 60fps, H.264/AAC, about 21.7 MB. It is a montage with quick scene changes and the earlier Beta01 mark. It has not been published as the current brand's hero.

Recommended direction: a short, muted hero loop after the mark is updated, with an optional full-film playback. For scroll scrubbing, use one continuous shot or a dedicated short edit; seeking across the complete montage produces abrupt cuts. A loading screen should not make visitors wait for the 18-second film. Keep the original as a master and supply a separate optimized web export.
