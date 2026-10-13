# The cloud (backend)

Without it, Aftryk keeps everything in the browser. With it:

- **Sign-in** by email link – no passwords.
- **One workspace per studio**, shared by everyone in it, **live** on every device.
- **Files** (logos, uploads, generated images) stored in the cloud, fetched when needed.
- **Offline still works**: the browser keeps a copy; changes made offline are queued and sent later.

It runs on [Supabase](https://supabase.com) (Postgres, Auth, Storage and Realtime in one). The free
tier is enough to start.

## Switching it on

1. **Make a Supabase project** at supabase.com (pick an EU region, e.g. Frankfurt, for Danish clients).
2. **Create the tables**: open *SQL Editor* → paste `supabase/migrations/0001_formlar.sql` → Run.
   (Or with the Supabase CLI: `supabase link` then `supabase db push`.)
3. **Auth settings** (*Authentication → URL Configuration*):
   - *Site URL*: `https://aftryk.app` (or wherever it's hosted)
   - *Redirect URLs*: add `https://aftryk.app/app/settings/cloud` and `http://localhost:5173/app/settings/cloud`
4. **Email**: Supabase's built-in email sends only a few messages an hour – fine for testing. For real
   use, add your own SMTP (*Authentication → Emails → SMTP*), e.g. Resend or Postmark, and put the
   Aftryk name and logo in the *Magic link* template.
5. **The two settings** (*Project settings → API*), in `.env.local` for `npm run dev` and in Vercel
   (*Settings → Environment Variables*):
   ```
   VITE_SUPABASE_URL=https://<project>.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=<the public publishable key>
   ```
   Both are public on purpose – the database's row-level security decides what anyone can see.
   Never put the `service_role` key in the app.
6. Restart `npm run dev` (or redeploy). **Settings → Cloud** now offers sign-in.

## Using it

- The first person signs in and presses **Move to the cloud**: the workspace in their browser –
  projects, clients, designs, files – goes up and becomes the studio.
- They **invite** the team from the same page. An invitee gets a sign-in link and joins the studio
  when they use it. Owners can remove people and withdraw invitations.
- A browser that joins a studio shows the studio's workspace. What was in it before is kept, and
  can be downloaded from Settings → Cloud.
- The dot next to the studio name in the sidebar shows the sync: green saved, amber saving, grey
  offline (changes wait and go when you're back), red refused.

## How it works

- `supabase/migrations/0001_formlar.sql` – the tables: `studios`, `studio_members`, `invites`,
  `records` (one row per item: `coll` + `id` + `data`), the `files` bucket, and the row-level
  security: only members of a studio can read or change it; only owners invite and remove people.
- `src/data/cloud/records.ts` – the workspace as rows, and exactly which items changed between two
  states (the store only makes new objects for what an action touched).
- `src/data/cloud/sync.ts` – the sync engine: loads the studio, sends changes in batches, queues them
  offline (the queue survives a reload), applies teammates' changes live, and doesn't echo its own.
  The last save of an item wins.
- `src/data/cloud/supabase.ts` – the Supabase side (loaded only when the settings are there).
- `src/data/cloud/CloudProvider.tsx` – sign-in, the studio, invites; `features/cloud/CloudSettings.tsx`
  is the page.
- Tests: `cloud-db.test.ts` runs the migration in PGlite (Postgres in WebAssembly) and checks the
  security as an owner, a teammate and a stranger; `cloud-sync.test.ts` runs two devices against a
  pretend cloud (live changes, deletions, offline and reload).

## Not yet (next steps)

- **Clients**: the client portal (`/p/…`), public Pages (`/site/…`) and the Brand Assistant still read
  from the studio's browser. Next: client sign-in with access to their own project, and a server
  function that serves published pages to anyone.
- **Automations** (reminder emails, the weekly summary) run in every open browser – move them to a
  scheduled server function so they happen once.
- **Emails** in the outbox are drafts; sending them needs an email provider (Resend/Postmark).
- **Storage use** per studio (the plan's file space) should be counted in the cloud, not the browser.
