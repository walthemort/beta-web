-- Aftryk's cloud: studios, who's in them, and the studio's data as one row per item.
-- Run it once in the Supabase SQL editor (or `supabase db push`). See docs/BACKEND.md.
--
-- The app keeps working without this: everything then lives in the browser. With it, a studio's
-- workspace is shared by everyone in it, live, on every device.

-- ---------- Studios and the people in them ----------

create table if not exists public.studios (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.studio_members (
  studio_id uuid not null references public.studios (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  primary key (studio_id, user_id)
);
create index if not exists studio_members_user on public.studio_members (user_id);

-- Invitations by email: accepted the first time that person signs in.
create table if not exists public.invites (
  studio_id uuid not null references public.studios (id) on delete cascade,
  email text not null check (email = lower(email)),
  role text not null default 'member' check (role in ('owner', 'member')),
  invited_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  primary key (studio_id, email)
);

-- Is the signed-in person in this studio (and is it as the owner)? Security definer, so the
-- policies below can ask without running into their own rules.
create or replace function public.is_member(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.studio_members where studio_id = s and user_id = auth.uid())
$$;

create or replace function public.is_owner(s uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.studio_members where studio_id = s and user_id = auth.uid() and role = 'owner')
$$;

-- ---------- The workspace: one row per item ----------

-- `coll` is the kind of thing (projects, clients, designs …), `id` its id in the app, `data` the
-- item itself. Deleting marks the row, so devices that were offline learn about it too.
create table if not exists public.records (
  studio_id uuid not null references public.studios (id) on delete cascade,
  coll text not null check (coll ~ '^[A-Za-z_]{1,40}$'),
  id text not null check (length(id) between 1 and 80),
  data jsonb not null default '{}'::jsonb,
  -- Where the item sits in its list; set when it's made and kept after that.
  ord double precision not null default 0,
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  -- The browser tab that wrote it, so a tab can ignore the echo of its own changes.
  client text,
  primary key (studio_id, coll, id)
);
create index if not exists records_changed on public.records (studio_id, updated_at);

create or replace function public.records_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  if tg_op = 'UPDATE' then
    new.ord := old.ord;
  end if;
  return new;
end
$$;

drop trigger if exists records_touch on public.records;
create trigger records_touch before insert or update on public.records
for each row execute function public.records_touch();

-- ---------- Who may do what ----------

alter table public.studios enable row level security;
alter table public.studio_members enable row level security;
alter table public.invites enable row level security;
alter table public.records enable row level security;

drop policy if exists "members see their studio" on public.studios;
create policy "members see their studio" on public.studios for select using (public.is_member(id));
drop policy if exists "owners rename their studio" on public.studios;
create policy "owners rename their studio" on public.studios for update using (public.is_owner(id));

drop policy if exists "members see each other" on public.studio_members;
create policy "members see each other" on public.studio_members for select using (public.is_member(studio_id));
drop policy if exists "owners remove members" on public.studio_members;
create policy "owners remove members" on public.studio_members for delete using (public.is_owner(studio_id) and user_id <> auth.uid());

drop policy if exists "members see invites" on public.invites;
create policy "members see invites" on public.invites for select
  using (public.is_member(studio_id) or email = lower(coalesce(auth.jwt() ->> 'email', '')));
drop policy if exists "owners invite" on public.invites;
create policy "owners invite" on public.invites for insert with check (public.is_owner(studio_id));
drop policy if exists "owners withdraw invites" on public.invites;
create policy "owners withdraw invites" on public.invites for delete using (public.is_owner(studio_id));

drop policy if exists "members read the workspace" on public.records;
create policy "members read the workspace" on public.records for select using (public.is_member(studio_id));
drop policy if exists "members add to the workspace" on public.records;
create policy "members add to the workspace" on public.records for insert with check (public.is_member(studio_id));
drop policy if exists "members change the workspace" on public.records;
create policy "members change the workspace" on public.records for update using (public.is_member(studio_id)) with check (public.is_member(studio_id));

-- ---------- Making a studio, and joining one ----------

-- A new studio, with the person making it as its owner.
create or replace function public.create_studio(p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  sid uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  insert into public.studios (name, created_by) values (p_name, auth.uid()) returning id into sid;
  insert into public.studio_members (studio_id, user_id, email, role)
    values (sid, auth.uid(), lower(auth.jwt() ->> 'email'), 'owner');
  return sid;
end
$$;

-- Joins every studio that has invited the signed-in person's email; returns their studios.
create or replace function public.accept_invites() returns setof uuid
language plpgsql security definer set search_path = public as $$
declare
  mail text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null or mail = '' then
    return;
  end if;
  insert into public.studio_members (studio_id, user_id, email, role)
    select studio_id, auth.uid(), mail, role from public.invites where email = mail
    on conflict (studio_id, user_id) do nothing;
  delete from public.invites where email = mail;
  return query select studio_id from public.studio_members where user_id = auth.uid();
end
$$;

revoke all on function public.create_studio(text) from public, anon;
revoke all on function public.accept_invites() from public, anon;
grant execute on function public.create_studio(text) to authenticated;
grant execute on function public.accept_invites() to authenticated;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_owner(uuid) to authenticated;

-- ---------- Live updates ----------

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'records') then
    alter publication supabase_realtime add table public.records;
  end if;
end
$$;

-- ---------- Files: <studio id>/<file key> in a private bucket ----------

insert into storage.buckets (id, name, public) values ('files', 'files', false) on conflict (id) do nothing;

drop policy if exists "members read files" on storage.objects;
create policy "members read files" on storage.objects for select
  using (bucket_id = 'files' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "members add files" on storage.objects;
create policy "members add files" on storage.objects for insert
  with check (bucket_id = 'files' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "members replace files" on storage.objects;
create policy "members replace files" on storage.objects for update
  using (bucket_id = 'files' and public.is_member(((storage.foldername(name))[1])::uuid));
drop policy if exists "members delete files" on storage.objects;
create policy "members delete files" on storage.objects for delete
  using (bucket_id = 'files' and public.is_member(((storage.foldername(name))[1])::uuid));
