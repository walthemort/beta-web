# Beta website + client portal

Beta’s Danish/English public site and its Forme-powered client portal run from one Node server. Brand colours: `#1B4DFF`, `#F6F4EF`, `#0B0B0E`. The provided Beta logos and six client marks are included. Red Bull uses its name until an approved image file is supplied.

## Run locally

Use Node 22.9+ (Node 24 recommended). After pulling changes, stop the old server, then:

```sh
npm ci
npm run dev
```

The default port is 3000. The existing portal bundle is committed, so first use does not require rebuilding Forme. A missing `.env.local` message is informational: public Beta/Supabase configuration is included in `content/business.json`. Restart Node after server changes.

## Pages and interactions

- `/`: expanding Beta Review, client-logo loop with faded/blurred edges and client-case links, animated service/FAQ disclosures and a local project brief.
- `/cases`, `/cases/forma`, `/cases/offscript`, and seven client case URLs: filtering, saved inspiration, chapter navigation, typography playgrounds, full-size keyboard-accessible galleries and comparison sliders.
- `/services`: service descriptions and an interactive four-stage process map.
- `/studio`: editorial studio page and animated principles.
- `/inspiration`: saved case references and private notes, stored only in this browser.
- `/start`: three-step brief, remembered service selections/timing, inspiration notes, optional review findings, export, configured estimates and booking. Downloads do not submit anything to Beta.
- `/en` and `/en/...`: English public pages; switch language while preserving the route. Service IDs stay canonical across languages. Editorial translations live in `public/locale.js`; translate new CMS copy there when publishing bilingual content.
- `/privacy`: storage and analytics explanation, with consent controls.
- `/admin`: authenticated studio-owner editor for case stories/images, service copy, business settings and aggregate analytics.
- `/portal`: invitation-based client sign-in, projects, private attachments, timelines, current file reviews and deliberately shared version comparisons.
- `/app/beta`: studio-owner tools for client invitations/access revocation, shared milestones, previous versions, requests and uploaded attachments.

All real-client pages remain explicitly labelled placeholders until approved content is entered. The Forma/Offscript visual explorations are concepts. Client placeholder artwork says “not client work.” Comparison sliders show concept A/B; no invented client before/after stories or metrics are included.

## Enable the new portal tools

The connected studio already uses migrations 0001–0004. Run the complete `migrations/0005_beta_workflows.sql` in **Supabase → SQL Editor** once. It creates client invitations, scoped requests/attachments, a private `beta-uploads` bucket, client-visible timeline events and explicit historical-version sharing. File approvals cannot silently carry over to a new uploaded version.

In **Authentication → URL Configuration**, allow your local or hosted origin’s `/portal`, `/admin` and `/app/settings/cloud` callbacks. Set the actual hosted Site URL when deploying. Supabase email delivery and account signup must be enabled for invited clients’ first magic-link login. The portal permits account creation, but database access still requires a matching, unexpired owner-created invitation; arbitrary signups receive no workspace data.

Use `/app/beta` to select an existing client record and save an invitation. Share the portal URL yourself; saving an invitation does not send an email. Invitations expire after 14 days. The client requests their sign-in link at the portal. Their assigned projects are derived from each project’s client ID. Clients are never added to `studio_members` and never receive direct access to private `records`.

Private attachments go directly to Supabase under the signed-in client’s studio/user path. Accepted types: PNG, JPEG, WebP, PDF, TXT and ZIP; 20 MB per file, up to ten attachments per request. Downloads stay private. Visual version comparison accepts validated raster images; other file types can be downloaded for review. Only current or explicitly shared historical versions can be downloaded, and only the current version can be approved.

Live email callbacks, real owner/client workflows and storage service enforcement still need verification in your Supabase project. Local Postgres tests validate SQL/RLS boundaries but do not replace those live checks. See `PORTAL-SETUP.md`.

## Business settings and publishing

Sign into `/admin` with the Beta studio owner email. The server verifies the bearer token with Supabase and checks owner membership in the configured studio on every editing request. There is no service-role key in the browser or repository.

Configure the public domain, booking URL, contact email, optional supported booking context parameter, manually maintained availability, currency and indicative service ranges. Empty settings stay hidden. Estimates appear only when every selected service has a configured range. They exclude VAT and are not binding quotes. The planner adds a short project/service context to booking only if you configure a parameter your provider supports; the full brief is downloaded separately.

Use the case editor to create a client draft, write approved copy and add images. Uploaded public images are limited to PNG/JPEG/WebP below 5 MB, with required alt text. Drafts are absent from public case endpoints. Publishing makes the story available at its client case URL. Service IDs remain fixed to preserve saved selections; descriptions and tags are editable.

CMS files live in `content/`, public uploaded media in `public/media/`, and anonymous aggregate analytics in `data/`. Use one Node instance with a **persistent writable disk** and backups for these directories. Git pulls/redeployments must preserve local content changes and uploaded media. A stateless/serverless host needs a durable content/storage adapter before enabling the editor. CMS writes are not pushed to GitHub automatically.

Alternatively configure `BOOKING_URL`, `CONTACT_EMAIL`, `SITE_URL`, `PORT`, or `PORTAL_URL` in `.env.local` using `.env.example`. Environment overrides take precedence. Never put a Supabase service-role/secret key in frontend variables.

## Beta Review and export

The engine attempts a bounded, sandboxed Chromium desktop visit. It reads computed colours/sizes and uses Chromium glyph evidence for fonts actually rendered. It returns an anonymous screenshot and separate SVG/logo evidence. When browser rendering is unavailable, it falls back to HTML and up to three same-origin stylesheets, including CSS custom-property resolution. The report identifies its source; source declarations are not presented as rendered measurements. Qualitative labels and recommendations describe detected evidence, not aesthetic judgment or a complete website audit.

Detected colour pairs can be explored with a WCAG contrast calculation. This does not establish that the website uses those colours together for text or that the site as a whole is accessible. Export a designed A4 PDF or a printable HTML guide. Review findings can be included in a brief; the latest report is stored only in this browser and can be cleared.

For PDF/browser features on your own machine, install the browser once:

```sh
npx playwright install chromium
```

`CHROMIUM_PATH` can point to an installed Chromium. Public-site rendering requires a working OS Chromium sandbox; do not disable it for untrusted websites. A non-root Linux runtime with supported user namespaces is recommended. PDF rendering uses only escaped local report content and blocks external network access.

Review connections validate and pin DNS addresses, reject private/local destinations and unsafe redirects, and bound methods, requests, time and transferred bytes. WebSockets/service workers are blocked, scanning is rate/concurrency limited, and PDF work is bounded. No authenticated browsing is performed. In this Codex machine public DNS still returns `EAI_AGAIN`; real external rendering/fetching cannot be validated here. Computed-style parsing, private-destination rejection and real PDF generation are verified locally; browser success presentation also uses a controlled fixture. Validate representative public sites locally/on your intended host before launch.

## Analytics and SEO

Analytics are **opt-in**. Before consent, the browser sends no event requests. The server stores only daily counts for an allowlist of events/paths and aggregate LCP/CLS/interaction-duration samples, with 90-day retention. Query strings, user identifiers, IP addresses and advertising cookies are not retained in the analytics store. Basic web-vital observations are diagnostic samples, not a full field CWV certification. Hosting providers may have separate operational logs. Users can decline or change their selection in the footer/privacy page.

Canonical URLs, language alternates, Organization structured data and sitemap URLs are generated once the actual `siteURL` is configured. No placeholder domain or invented business address is published. Public assets use gzip, uploaded/vector images reserve layout space, galleries load lazily, portal assets use immutable caching, and expensive staff tools remain lazy-loaded.

## Customize/build

The portal source is included under `portal/`, so this repository can now evolve independently for Beta. `FORME_PATH` defaults to `./portal`; your original Forme checkout is preserved.

```sh
npm --prefix portal ci
npm run build
```

This builds the private editor, regenerates embedded client marks, compiles the Beta-mode portal and copies its bundle to `public/portal-app`. When committing a rebuilt portal, use `git add -f public/portal-app`; generated portal assets are ignored by default but the runnable bundle is intentionally tracked. The original Forme landing page remains available only in ordinary Forme mode.

## Validation

```sh
npm test
npm run test:portal
npm run test:budget
```

16 website tests and 31 portal database/sync tests pass. Checks cover role verification, content validation/escaping, CSS variables, real computed typography, private network blocking, contrast, language routes, real PDFs, owner/client isolation, invitation identity/expiry, uploads, requests, timelines and version protection. The portal production build/type checks pass. Browser checks cover actual downloads, galleries/keyboard controls, service disclosures, saved notes, process tabs, consent, mobile widths and English navigation. Gzip budgets pass; public JS is approximately 34 KiB and CSS 16 KiB combined. Public deployment and live authenticated client validation are pending.

The complete feature/status ledger is `docs/NEXT-IDEAS.md`.
