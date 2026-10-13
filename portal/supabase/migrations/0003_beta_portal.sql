-- Optional Beta client accounts. Clients are never added to studio_members.
-- Only a studio owner can assign an existing authenticated user to a client record.
create table if not exists public.beta_client_members (
 studio_id uuid not null references public.studios(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 client_id text not null,
 primary key(studio_id,user_id)
);
alter table public.beta_client_members enable row level security;
create policy "beta owners manage client access" on public.beta_client_members for all to authenticated
 using(public.is_owner(studio_id)) with check(public.is_owner(studio_id));
create policy "beta clients see their own access" on public.beta_client_members for select to authenticated using(user_id=auth.uid());
grant select,insert,update,delete on public.beta_client_members to authenticated;

-- Deliberately project only client-safe fields. Never expose full project JSON, tasks or notes.
create or replace function public.beta_client_projects(p_studio uuid)
returns table(id text,name text,due text)
language plpgsql stable security definer set search_path=public as $$
declare cid text;
begin
 select client_id into cid from public.beta_client_members where studio_id=p_studio and user_id=auth.uid();
 if cid is null then raise exception 'No client access'; end if;
 return query select r.id,r.data->>'name',r.data->>'due' from public.records r
 where r.studio_id=p_studio and r.coll='projects' and not r.deleted
 and r.data->>'clientId'=cid and coalesce(r.data->>'archived','false') <> 'true'
 order by r.ord;
end $$;

-- Requests appear in the existing studio inbox/outbox data, without client write access to records.
create or replace function public.beta_request_project(p_studio uuid,p_description text)
returns void language plpgsql security definer set search_path=public as $$
declare cid text; rid text := gen_random_uuid()::text;
begin
 select client_id into cid from public.beta_client_members where studio_id=p_studio and user_id=auth.uid();
 if cid is null then raise exception 'No client access'; end if;
 if length(trim(p_description)) not between 1 and 4000 or p_description is null then raise exception 'Invalid request'; end if;
 insert into public.records(studio_id,coll,id,data,ord) values(p_studio,'activity',rid,
 jsonb_build_object('id',rid,'text','New project request: ' || trim(p_description),'at',now(),'clientId',cid,'fromClient',true),extract(epoch from now()));
end $$;
revoke all on function public.beta_client_projects(uuid) from public,anon;
revoke all on function public.beta_request_project(uuid,text) from public,anon;
grant execute on function public.beta_client_projects(uuid) to authenticated;
grant execute on function public.beta_request_project(uuid,text) to authenticated;
