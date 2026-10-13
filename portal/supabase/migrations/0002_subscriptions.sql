-- What each studio is paying for. The point of this table is where it can be written from:
-- the studio's own browser may read its subscription and may never change it. Only Stripe's
-- webhook writes here, through the service-role key, which skips row-level security entirely.
--
-- Until this exists the plan lives in the browser's own saved state, where anyone can set it to
-- "studio" from the console. Run it once in the Supabase SQL editor (or `supabase db push`),
-- after 0001. See docs/PAYMENTS.md.

create table if not exists public.subscriptions (
  studio_id uuid primary key references public.studios (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'pro', 'studio')),
  period text check (period in ('monthly', 'yearly')),
  -- `past_due` keeps the plan working while a card is retried; `canceled` drops it to free.
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  extra_storage integer not null default 0 check (extra_storage between 0 and 20),
  renews_at timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  updated_at timestamptz not null default now()
);

-- The webhook finds the row by what Stripe sends it.
create index if not exists subscriptions_stripe_sub on public.subscriptions (stripe_subscription_id);

create or replace function public.subscriptions_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end
$$;

drop trigger if exists subscriptions_touch on public.subscriptions;
create trigger subscriptions_touch before insert or update on public.subscriptions
for each row execute function public.subscriptions_touch();

alter table public.subscriptions enable row level security;

-- Read-only to the studio, and only to its own row. There is deliberately no insert, update or
-- delete policy: with row-level security on, that means nobody holding the anon key can write
-- here at all, however the request is shaped.
drop policy if exists "members see what the studio pays for" on public.subscriptions;
create policy "members see what the studio pays for" on public.subscriptions
  for select using (public.is_member(studio_id));

-- A studio with no row has never paid, which is the free plan.
create or replace function public.plan_of(s uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select case when status = 'canceled' then 'free' else plan end from public.subscriptions where studio_id = s),
    'free'
  )
$$;
