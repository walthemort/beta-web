# Beta portal setup

The existing Beta studio is `713a2e85-2f38-4d5e-97b3-999d21a770a4`. Public connection configuration is already included. Your original local Forme app remains separate; Beta’s editable portal source is now in `portal/`.

1. Run `migrations/0005_beta_workflows.sql` in your Supabase SQL Editor after the already-installed 0001–0004 migrations. Run the complete file, including triggers at the end. Do not rerun old migrations blindly: their named policies already exist.
2. Supabase Authentication → URL Configuration: allow your actual origin’s `/portal`, `/admin` and `/app/settings/cloud` callbacks. During local use this is normally the origin on port 3000. Set the hosted Site URL after deploying.
3. Ensure Supabase magic-link email delivery and new-account signup are enabled. For production, configure your SMTP provider and its rate limits in Supabase. No SMTP/admin secret is required by the website browser.
4. Sign in as your existing owner at `/portal`. Staff go to `/app`.
5. Create a client in the staff Clients area and assign a project to that client.
6. Open `/app/beta`, select the client and save an invitation for their email. Then share the `/portal` URL yourself. Invitations expire after 14 days; no outbound email is sent by the invitation editor.
7. The client requests a magic link at `/portal`, signs in and accepts the matching invitation automatically. They see only their assigned projects, shared files, public project milestones and their own requests/uploads.

`/app/beta` also revokes active client access, shares client-facing milestones, explicitly shares/unshares previous versions, reads attachments and updates request statuses. Internal project notes/tasks/comments are never projected into the client timeline. File share/review actions generate safe timeline messages; new uploaded versions clear a carried-over approval.

Storage buckets `files` and `beta-uploads` must stay private. Clients cannot upload to staff file storage. Their own attachments use studio/user-scoped paths; metadata registration verifies that a private uploaded object exists. Other clients and unrelated users cannot read those objects. File review approval requires the current version; history is downloadable only after owner sharing.

Before launch, test with your real owner and two separate client accounts: invitation/expiry, correct project assignment, cross-client denial, upload/download, request receipt/status, timeline visibility, shared history, stale-version rejection, access revocation and email callbacks on the final origin. Local Postgres tests exercise these policy/function boundaries, but live email and Storage API behavior remain pending.

If a tool reports a missing function/table, finish applying migration 0005 in this project, then refresh the portal. If login links redirect elsewhere, correct Auth URL Configuration. Studio settings can still use Forme’s existing cloud tools; client invitations must use the Beta workflow page, never studio-team invitations.
