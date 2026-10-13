# Beta website + client portal

Beta's public website and its Forme-powered portal run from one Node server. The portal's original public marketing page is excluded in Beta mode. The bundled portal has a Beta loading/login screen, database-backed staff/client routing, a client project overview, new-project requests, shared file downloads, feedback and version-aware acceptance.

## Run the packaged website

Requires Node.js 22.9+ (Node 24 recommended).

```sh
npm run dev
```

The website uses port 3000; PORT overrides it. This package includes the built portal in `public/portal-app`, so no Forme build is needed for first use. No third-party packages are required by the website server. Keep the package's `public/portal-app` folder when copying it. Live processes do not survive snapshots; restart the server as needed.

## Login setup

Supabase must allow this website origin's `/portal` and `/app/settings/cloud` under Authentication → URL Configuration. Local development normally uses origin `http://localhost:3000`; adjust to the actual origin/port. Use your website's own public URL after hosting it. The compiled portal targets Beta studio `713a2e85-2f38-4d5e-97b3-999d21a770a4`. Its Supabase URL and publishable key are public frontend configuration; only database/storage permissions protect customer data.

Staff sign in with their existing studio account. Assign clients using `beta_client_members`, never `studio_members`. See the included `PORTAL-SETUP.md` and migrations for setup. Requests appear in the existing studio activity feed. Client file reviews need migration 0004, real cloud-uploaded shared files, and a client assignment. Live authenticated role routing and file decisions must be tested with real accounts before launch.

## Booking and contact

Create `.env.local` beside package.json and configure a real BOOKING_URL and/or CONTACT_EMAIL using .env.example. Restart the server. Without either, the contact action displays a coming-soon message and sends nothing. Optionally configure PORTAL_URL if using a separately hosted Forme portal.

## Rebuild the portal during development

Use the existing sibling `/workspace/forme` checkout (or set FORME_PATH). Copy `.env.example` to `.env.local` and supply VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and VITE_BETA_STUDIO_ID, then run:

```sh
npm run build:portal
```

This builds Forme with VITE_BETA_MODE=true and replaces its boot HTML with Beta branding. It copies generated files only, leaving Forme's source landing page available for ordinary deployments. Configure VITE_BETA_WEBSITE_URL for the backlink (default `/`). Both repositories are isolated per cloud task; use their existing checkouts, without creating worktrees unless explicitly requested.

## Beta Review and cases

Review now detects hex colours, font-family definitions, source font sizes, SVG references and possible SVG logo references from HTML and up to three same-origin stylesheets. It does not render the website or judge logo identity/visual suitability. Its qualitative label describes detectable foundations, not designer judgment. Network connections validate DNS addresses when connecting, redirects are rechecked, response sizes are capped, and requests have a total time budget. IPv6-only websites are currently unsupported. Cloud external DNS still prevents live public-site validation in this machine; controlled browser results exercise the success presentation and extractor tests exercise real parsing. Do not describe this as a complete rendered brand audit. The case studies are illustrative concepts and are labelled accordingly.

## Validation

- Normal and Beta-mode Forme production builds pass.
- 26 cloud database/sync tests pass, including client isolation and stale-version rejection.
- Browser checks verify homepage → Beta login, case dialog, contact fallback and mobile layout without horizontal overflow.
- Website, portal routes and generated assets respond successfully on the same server.
- Owner studio sync was reported Saved by the user. Live client reviews and email-login callbacks on this unified origin have not yet been exercised.

No public deployment has been made. The runnable artifact is separate from your existing local Forme checkout.


## Beta redesign

The public site now uses the provided Beta SVG logos and brand colours (#1B4DFF / #F6F4EF / #0B0B0E), with Danish copy following the Figma direction. Features include an animated review hero, full-screen navigation, a rolling type strip, expandable services, remembered service selection, a local downloadable project brief, interactive concept cases and accessible FAQ disclosure. The brief is not sent automatically. Motion is disabled when the user requests reduced motion. The website and portal branding share the same palette. The about section uses brand artwork until an approved portrait is supplied.

Browser checks cover logo delivery, menu/Escape, service selection/removal, actual brief download contents, review errors, concept details, FAQ, portal login and narrow-screen overflow. The analysis engine itself is unchanged and still needs the work described above.


## Inline review and client logos

Pressing Enter expands the review card in the hero instead of navigating to a separate results section. Loading, findings, failure and reset all stay in that card. Copy colour codes, download an initial text brand guide, or open a project brief. No simulated review findings are shipped.

The former text ticker is replaced with the client's logo loop, populated from `public/clients.json`. The six supplied SVG files are included; Red Bull is a text name pending an image file. SVG, PNG, JPG and WebP logos are supported. Add an approved local logo under `public/clients/`, then update the JSON entry and run `npm run build:clients`. The two identical track groups loop without a gap; hover, keyboard focus or the pause button stops motion. Reduced-motion mode uses a static layout. Missing image files fall back to client names.

Validation: 3 Node extractor/address-validation tests pass. Browser checks cover Enter/loading expansion, a controlled success response (palette/fonts/sizes), download contents, inline errors, reset, actual supplied logos, loop/pause, reduced motion, and mobile widths. Live external requests still return DNS EAI_AGAIN in this cloud machine and must be checked from local or hosted deployment.


## Disclosure motion and resilient logo strip

The logo bar is rendered directly into the homepage with embedded images. It remains visible even when `/clients.json` cannot be fetched, image routes are unavailable, or JavaScript is disabled. `npm run build:clients` regenerates that section from the approved local logos and manifest; this command does not run at startup.

Service and FAQ disclosures now animate both height and opacity on opening and closing, including rapid direction changes. Dialog dismissal, Escape, backdrop dismissal and case-to-project-brief transitions animate before focus/scroll state is released. Review results animate their height when loading changes to findings or errors. Closing the review waits for its panel transition before resetting the hero. Selection-list changes animate their height. Reduced-motion preference makes these operations immediate.

Browser regression checks verify logos without any manifest/image endpoint (and without JavaScript), intermediate disclosure heights, interrupted open/close, keyboard FAQ use, dialog transitions, restored scrolling, mobile overflow and reduced motion.
