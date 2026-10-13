begin;
-- Apply after 0001–0004. Clients remain outside studio_members and private records.
create table if not exists public.beta_client_invites (
 studio_id uuid not null references public.studios(id) on delete cascade,
 email text not null check(email=lower(trim(email)) and email like '%@%.%'),
 client_id text not null,
 expires_at timestamptz not null default now()+interval '14 days',
 primary key(studio_id,email)
);
alter table public.beta_client_invites enable row level security;
drop policy if exists "beta owner invites clients" on public.beta_client_invites;
create policy "beta owner invites clients" on public.beta_client_invites for all to authenticated
 using(public.is_owner(studio_id)) with check(public.is_owner(studio_id));
grant select,insert,update,delete on public.beta_client_invites to authenticated;
create or replace function public.beta_accept_client_invite(p_studio uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare invitation public.beta_client_invites;
begin
 if auth.uid() is null then raise exception 'Sign in first'; end if;
 select * into invitation from public.beta_client_invites where studio_id=p_studio and email=lower(auth.jwt()->>'email') and expires_at>now() for update;
 if not found then return false; end if;
 if not exists(select 1 from public.records where studio_id=p_studio and coll='clients' and id=invitation.client_id and not deleted) then raise exception 'Client record unavailable'; end if;
 insert into public.beta_client_members(studio_id,user_id,client_id) values(p_studio,auth.uid(),invitation.client_id)
 on conflict(studio_id,user_id) do update set client_id=excluded.client_id;
 delete from public.beta_client_invites where studio_id=p_studio and email=invitation.email;
 return true;
end $$;

create table if not exists public.beta_requests (
 id uuid primary key default gen_random_uuid(), studio_id uuid not null references public.studios(id) on delete cascade,
 user_id uuid not null references auth.users(id),client_id text not null,description text not null check(length(description) between 1 and 4000),
 status text not null default 'Received' check(status in ('Received','Discussing','Scheduled','Closed')),created_at timestamptz not null default now()
);
alter table public.beta_requests enable row level security;
drop policy if exists "beta studio reads requests" on public.beta_requests;
create policy "beta studio reads requests" on public.beta_requests for select to authenticated using(public.is_member(studio_id));
drop policy if exists "beta client reads own requests" on public.beta_requests;
create policy "beta client reads own requests" on public.beta_requests for select to authenticated
 using(user_id=auth.uid() and exists(select 1 from public.beta_client_members m where m.studio_id=beta_requests.studio_id and m.user_id=auth.uid() and m.client_id=beta_requests.client_id));
grant select on public.beta_requests to authenticated;

create table if not exists public.beta_attachments (
 id uuid primary key default gen_random_uuid(),studio_id uuid not null references public.studios(id) on delete cascade,
 user_id uuid not null references auth.users(id),project_id text,request_id uuid references public.beta_requests(id),
 name text not null check(length(name) between 1 and 200),blob_path text not null unique,created_at timestamptz not null default now()
);
alter table public.beta_attachments enable row level security;
drop policy if exists "beta studio reads uploads" on public.beta_attachments;
create policy "beta studio reads uploads" on public.beta_attachments for select to authenticated using(public.is_member(studio_id));
drop policy if exists "beta client reads own uploads" on public.beta_attachments;
create policy "beta client reads own uploads" on public.beta_attachments for select to authenticated using(user_id=auth.uid() and exists(select 1 from public.beta_client_members m where m.studio_id=beta_attachments.studio_id and m.user_id=auth.uid()) and (project_id is null or public.beta_has_project(studio_id,project_id)));
grant select on public.beta_attachments to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('beta-uploads','beta-uploads',false,20000000,array['image/png','image/jpeg','image/webp','application/pdf','text/plain','application/zip']) on conflict(id) do update set public=false,file_size_limit=20000000,allowed_mime_types=excluded.allowed_mime_types;
create or replace function public.beta_upload_access(p_name text,p_write boolean)
returns boolean language sql stable security definer set search_path=public as $$
 select p_name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(png|jpg|webp|pdf|txt|zip)$' and exists(
 select 1 from public.beta_client_members m where m.studio_id::text=split_part(p_name,'/',1) and m.user_id=auth.uid() and m.user_id::text=split_part(p_name,'/',2))
 or (not p_write and exists(select 1 from public.studio_members m where m.studio_id::text=split_part(p_name,'/',1) and m.user_id=auth.uid()));
$$;
drop policy if exists "beta client upload objects" on storage.objects;
create policy "beta client upload objects" on storage.objects for insert to authenticated with check(bucket_id='beta-uploads' and public.beta_upload_access(name,true));
drop policy if exists "beta read upload objects" on storage.objects;
create policy "beta read upload objects" on storage.objects for select to authenticated using(bucket_id='beta-uploads' and public.beta_upload_access(name,false));
drop policy if exists "beta remove unattached upload" on storage.objects;
create policy "beta remove unattached upload" on storage.objects for delete to authenticated using(bucket_id='beta-uploads' and public.beta_upload_access(name,true) and not exists(select 1 from public.beta_attachments a where a.blob_path=storage.objects.name));

create or replace function public.beta_register_attachment(p_studio uuid,p_project text,p_path text,p_name text)
returns uuid language plpgsql security definer set search_path=public as $$
declare aid uuid;
begin
 if auth.uid() is null or not public.beta_upload_access(p_path,true) or split_part(p_path,'/',1)<>p_studio::text then raise exception 'No upload access';end if;
 if p_project is not null and not public.beta_has_project(p_studio,p_project) then raise exception 'No project access';end if;
 if p_name is null or length(trim(p_name)) not between 1 and 200 then raise exception 'Invalid file name';end if;
 if not exists(select 1 from storage.objects where bucket_id='beta-uploads' and name=p_path) then raise exception 'Upload the file first';end if;
 insert into public.beta_attachments(studio_id,user_id,project_id,name,blob_path) values(p_studio,auth.uid(),p_project,trim(p_name),p_path) returning id into aid;
 return aid;
end $$;
create or replace function public.beta_submit_request(p_studio uuid,p_description text,p_attachments uuid[] default '{}')
returns uuid language plpgsql security definer set search_path=public as $$
declare cid text;rid uuid:=gen_random_uuid();aid uuid;
begin
 select client_id into cid from public.beta_client_members where studio_id=p_studio and user_id=auth.uid();
 if cid is null then raise exception 'No client access';end if;
 if p_description is null or length(trim(p_description)) not between 1 and 4000 then raise exception 'Invalid request';end if;
 if p_attachments is null or cardinality(p_attachments)>10 then raise exception 'Too many attachments';end if;
 foreach aid in array p_attachments loop
 perform 1 from public.beta_attachments where id=aid and studio_id=p_studio and user_id=auth.uid() and request_id is null and project_id is null for update;
 if not found then raise exception 'Invalid attachment';end if;
 end loop;
 insert into public.beta_requests(id,studio_id,user_id,client_id,description) values(rid,p_studio,auth.uid(),cid,trim(p_description));
 update public.beta_attachments set request_id=rid where id=any(p_attachments);
 insert into public.records(studio_id,coll,id,data,ord) values(p_studio,'activity',rid::text,jsonb_build_object('id',rid,'text','New project request: '||trim(p_description),'at',now(),'clientId',cid,'fromClient',true),extract(epoch from now()));
 return rid;
end $$;
create or replace function public.beta_update_request(p_request uuid,p_status text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from public.beta_requests r where r.id=p_request and public.is_member(r.studio_id)) then raise exception 'No studio access';end if;
 if p_status not in ('Received','Discussing','Scheduled','Closed') or p_status is null then raise exception 'Invalid status';end if;
 update public.beta_requests set status=p_status where id=p_request;
end $$;

create table if not exists public.beta_project_events (
 id uuid primary key default gen_random_uuid(),studio_id uuid not null references public.studios(id) on delete cascade,
 project_id text not null,label text not null check(length(label) between 1 and 300),created_at timestamptz not null default now()
);
alter table public.beta_project_events enable row level security;
drop policy if exists "beta studio shares timeline" on public.beta_project_events;
create policy "beta studio shares timeline" on public.beta_project_events for all to authenticated using(public.is_member(studio_id)) with check(public.is_member(studio_id) and exists(select 1 from public.records p where p.studio_id=beta_project_events.studio_id and p.coll='projects' and p.id=project_id and not p.deleted));
drop policy if exists "beta client reads timeline" on public.beta_project_events;
create policy "beta client reads timeline" on public.beta_project_events for select to authenticated using(public.beta_has_project(studio_id,project_id));
grant select,insert,delete on public.beta_project_events to authenticated;

create table if not exists public.beta_shared_versions (
 studio_id uuid not null references public.studios(id) on delete cascade,file_id text not null,version_id text not null,
 blob_key text not null,shared_at timestamptz not null default now(),primary key(studio_id,file_id,version_id)
);
alter table public.beta_shared_versions enable row level security;
drop policy if exists "beta owner sees version shares" on public.beta_shared_versions;
create policy "beta owner sees version shares" on public.beta_shared_versions for select to authenticated using(public.is_owner(studio_id));
grant select on public.beta_shared_versions to authenticated;
create or replace function public.beta_share_version(p_studio uuid,p_file text,p_version text,p_shared boolean)
returns void language plpgsql security definer set search_path=public as $$
declare f jsonb;v jsonb;
begin
 if not public.is_owner(p_studio) then raise exception 'Owner access required';end if;
 select data into f from public.records where studio_id=p_studio and coll='files' and id=p_file and not deleted;
 if f is null or f->>'status' not in ('In review','Approved','Changes requested') then raise exception 'File must be shared first';end if;
 if p_shared then
 select value into v from jsonb_array_elements(f->'versions') where value->>'id'=p_version;
 if v is null or v->>'src' not like 'idb:%' then raise exception 'Version unavailable';end if;
 insert into public.beta_shared_versions(studio_id,file_id,version_id,blob_key) values(p_studio,p_file,p_version,substring(v->>'src' from 5)) on conflict(studio_id,file_id,version_id) do nothing;
 else delete from public.beta_shared_versions where studio_id=p_studio and file_id=p_file and version_id=p_version;end if;
end $$;
create or replace function public.beta_file_versions(p_studio uuid,p_file text)
returns table(version_id text,blob_key text,is_current boolean) language plpgsql stable security definer set search_path=public as $$
declare f jsonb;
begin
 select data into f from public.records where studio_id=p_studio and coll='files' and id=p_file and not deleted;
 if f is null or not public.beta_has_project(p_studio,f->>'projectId') or f->>'status' not in ('In review','Approved','Changes requested') then raise exception 'No file access';end if;
 return query select f->'versions'->-1->>'id',substring(f->'versions'->-1->>'src' from 5),true where f->'versions'->-1->>'src' like 'idb:%'
 union all select s.version_id,s.blob_key,false from public.beta_shared_versions s where s.studio_id=p_studio and s.file_id=p_file and s.version_id<>f->'versions'->-1->>'id';
end $$;
create or replace function public.beta_can_read_file(p_name text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.records r where r.coll='files' and not r.deleted and public.beta_has_project(r.studio_id,r.data->>'projectId') and r.data->>'status' in ('In review','Changes requested','Approved') and (
 (r.data->'versions'->-1->>'src' like 'idb:%' and p_name=r.studio_id::text||'/'||substring(r.data->'versions'->-1->>'src' from 5))
 or exists(select 1 from public.beta_shared_versions s where s.studio_id=r.studio_id and s.file_id=r.id and p_name=s.studio_id::text||'/'||s.blob_key)));
$$;
-- Explicit RPC permissions. No anonymous onboarding, uploads, or version access.
revoke all on function public.beta_accept_client_invite(uuid),public.beta_upload_access(text,boolean),public.beta_register_attachment(uuid,text,text,text),public.beta_submit_request(uuid,text,uuid[]),public.beta_update_request(uuid,text),public.beta_share_version(uuid,text,text,boolean),public.beta_file_versions(uuid,text) from public,anon;
grant execute on function public.beta_accept_client_invite(uuid),public.beta_upload_access(text,boolean),public.beta_register_attachment(uuid,text,text,text),public.beta_submit_request(uuid,text,uuid[]),public.beta_update_request(uuid,text),public.beta_share_version(uuid,text,text,boolean),public.beta_file_versions(uuid,text) to authenticated;
notify pgrst,'reload schema';
-- File actions produce client-facing events; internal comments and notes never enter this feed.
create or replace function public.beta_file_timeline_event()
returns trigger language plpgsql security definer set search_path=public as $$
declare label text;
begin
 if new.coll<>'files' or new.deleted or new.data->>'status' not in ('In review','Approved','Changes requested') then return new;end if;
 if tg_op='INSERT' then label:='File shared: ';
 elsif new.data->>'status' is distinct from old.data->>'status' then label:=case new.data->>'status' when 'Approved' then 'File accepted: ' when 'Changes requested' then 'Changes requested: ' else 'Ready for review: ' end;
 elsif new.data->'versions'->-1->>'id' is distinct from old.data->'versions'->-1->>'id' then label:='New shared version: ';
 else return new;end if;
 if exists(select 1 from public.records p where p.studio_id=new.studio_id and p.coll='projects' and p.id=new.data->>'projectId' and not p.deleted) then
 insert into public.beta_project_events(studio_id,project_id,label) values(new.studio_id,new.data->>'projectId',left(label||coalesce(new.data->>'name','Project file'),300));
 end if;
 return new;
end $$;
drop trigger if exists beta_file_client_timeline on public.records;
create trigger beta_file_client_timeline after insert or update on public.records for each row execute function public.beta_file_timeline_event();
-- A previous approval cannot silently approve a newly uploaded version.
create or replace function public.beta_clear_stale_approval()
returns trigger language plpgsql set search_path=public as $$
begin
 if new.coll='files' and new.data->>'status'='Approved' and new.data->'versions'->-1->>'id' is distinct from old.data->'versions'->-1->>'id' then
 new.data:=(new.data-'approvedBy'-'approvedAt'-'approvedVersionId')||jsonb_build_object('status','In review');
 end if;return new;
end $$;
drop trigger if exists beta_clear_stale_approval on public.records;
create trigger beta_clear_stale_approval before update on public.records for each row execute function public.beta_clear_stale_approval();

commit;
