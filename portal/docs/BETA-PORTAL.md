# Beta deployment

Forme remains the default product. Enable an optional Beta deployment without deleting its landing page, sales tools, or other features.

## Settings

In an ignored `.env.local` (or your hosting settings):

```dotenv
VITE_BETA_MODE=true
VITE_BETA_STUDIO_ID=<the existing Beta studio UUID>
VITE_BETA_WEBSITE_URL=<the public Beta website URL>
VITE_SUPABASE_URL=<your Supabase project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<your public publishable key>
```

Use only the public anon key, never a service-role key in the frontend. Restart Vite after setting these variables and rebuild for deployment.

Run migrations 0001 and 0002 as documented in BACKEND.md, followed by `supabase/migrations/0003_beta_portal.sql` and `supabase/migrations/0004_beta_file_review.sql`. This work has not applied migrations to any remote project.

The Beta studio must already exist: prepare it through the normal Forme cloud setup first. Studio staff retain their existing `studio_members` membership. Beta mode does not offer open registration or studio creation.

Create/invite each client user through Supabase Auth's admin dashboard, then assign their auth user UUID to the existing Forme client record ID in `beta_client_members`, with the Beta studio UUID. Owners can manage these rows under RLS. Do not invite clients through Forme's staff invitations: that would grant studio-wide access.

In Supabase Auth allow the hosted portal's `/portal` as a redirect URL. Email-link login routes according to database membership; there is no user-selectable staff role. Deploy one frontend per Beta studio.

## Website integration

Set `PORTAL_URL` on the Beta website server to the externally reachable Forme Beta deployment's `/portal` URL. The Beta website's portal entry redirects there. Set `VITE_BETA_WEBSITE_URL` here to link back to the public website. Forme's public marketing page is not displayed in Beta mode, including when accessing `/` directly.

## Included and next steps

- Beta loading, login and connection-error screens.
- Authenticated studio members access the existing studio workspace.
- Clients read their own active project names/dates through a narrow database function, without downloading the studio store.
- Clients submit project requests into the existing studio activity feed.
- Unauthenticated users and unassigned accounts cannot enter client or staff pages. Existing `/p`, `/c`, share, and public routes are intentionally gated in Beta mode.
- Clients open projects, download the current shared file version, submit feedback, and accept or request changes. New migration 0004 supplies client-scoped downloads and version-checked review functions. Detailed image annotation and proposal/contract views still need secure client adapters.
- Clients have no direct read/write access to `records`. Storage policies permit downloads only for current shared versions in their assigned active projects. Add secure invitations and a staff access-management UI next.
- The studio workspace remains feature-complete initially; simplify its navigation for Beta after deciding which staff tools to retain.

Validated: TypeScript + production build, original cloud sync/security tests, and added database isolation tests for cross-client/cross-studio access, internal-field omission, role escalation and scoped project requests. Hosted Supabase login and client email delivery require configuration and have not been exercised.

## Starting with a new Supabase project

1. Create a Supabase project (an EU region is suitable for Danish customers).
2. Run migrations `0001_formlar.sql`, `0002_subscriptions.sql`, then `0003_beta_portal.sql` and `0004_beta_file_review.sql` in order in its SQL editor. The cloud tests exercise all three locally; no remote project is created by this code.
3. Add the public URL and anon key to the settings above. Initially keep `VITE_BETA_MODE=false`.
4. Open the normal Forme workspace → Settings → Cloud, sign in as the owner, and move the intended Beta workspace to the cloud. Check the data first: this uploads what is in that browser, including any sample projects. This step creates the studio and owner membership.
5. Copy that studio UUID from Supabase's `studios` table into `VITE_BETA_STUDIO_ID`. Set `VITE_BETA_MODE=true`, configure the public website backlink, and restart/rebuild.
6. Add the hosted `/portal` to Supabase's allowed Auth redirect URLs. For local development, also allow the Vite origin's `/portal` and `/app/settings/cloud` callback. Configure SMTP before real client use.
7. Create/invite the client in Supabase Auth. In `beta_client_members`, assign the resulting user UUID, the Beta studio UUID, and the client's existing ID from Forme's `records` row (`coll='clients'`). Keep clients out of `studio_members`.
8. Set the website server's `PORTAL_URL` to the hosted Beta portal entry. Verify owner login, client login, sign-out, client requests in Recent activity, and denial for an unassigned user. Test two different clients before launch.

Cloud-machine validation against this project will need its specific `<project>.supabase.co` hostname allowed in environment network settings. Never paste service-role keys, database passwords, or SMTP credentials into chat or the frontend.


## File review update for an existing setup

If migrations 0001–0003 have already run, apply only `0004_beta_file_review.sql` next. Clients cannot review/download files until this is applied. Sharing a file means setting it to In review (or another client-visible review state) in the existing studio workspace and ensuring its blob has uploaded to private cloud storage. The client downloads the current version before accepting it. The server rejects obsolete version IDs, unauthorized projects, duplicate approval, and change requests without feedback. Review decisions update the existing Forme file record and are picked up by staff sync. Browser automations and file-version-specific image annotations are separate existing features; they have not been validated through this client adapter.

Current validation: Supabase Auth settings and the studios REST endpoint respond with HTTP 200; the installed client-project function denies anonymous execution (HTTP 401). Local build and 26 database/sync tests pass. Owner login, client login, storage and reviews against the hosted project are pending owner/studio configuration and migration 0004.
