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

Review currently detects colours, inline font families, and SVG references from HTML. It does not analyse external CSS, computed sizes, rendered content, logo identity, or visual suitability. Its qualitative label describes detectable foundations, not designer judgment. Cloud external DNS and further outbound request hardening remain unresolved; do not publish it as a finished brand audit service. The case studies are illustrative concepts and are labelled accordingly.

## Validation

- Normal and Beta-mode Forme production builds pass.
- 26 cloud database/sync tests pass, including client isolation and stale-version rejection.
- Browser checks verify homepage → Beta login, case dialog, contact fallback and mobile layout without horizontal overflow.
- Website, portal routes and generated assets respond successfully on the same server.
- Owner studio sync was reported Saved by the user. Live client reviews and email-login callbacks on this unified origin have not yet been exercised.

No public deployment has been made. The runnable artifact is separate from your existing local Forme checkout.
