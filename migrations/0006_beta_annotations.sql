-- Feedback belongs to the exact shared file version and PDF page.
begin;
create table if not exists public.beta_annotations (
 id uuid primary key default gen_random_uuid(),
 studio_id uuid not null references public.studios(id) on delete cascade,
 file_id text not null, version_id text not null, project_id text not null,
 page integer not null check(page between 1 and 100),
 x double precision not null check(x between 0 and 1),
 y double precision not null check(y between 0 and 1),
 body text not null check(length(trim(body)) between 1 and 2000),
 author_id uuid not null references auth.users(id), author_label text not null,
 from_client boolean not null, resolved boolean not null default false,
 resolved_by uuid references auth.users(id), created_at timestamptz not null default now()
);
create index if not exists beta_annotations_version on public.beta_annotations(studio_id,file_id,version_id,created_at);
alter table public.beta_annotations enable row level security;
create or replace function public.beta_annotation_access(p_studio uuid,p_file text,p_version text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.records f join public.records p
 on p.studio_id=f.studio_id and p.coll='projects' and p.id=f.data->>'projectId'
 where f.studio_id=p_studio and f.coll='files' and f.id=p_file and not f.deleted
 and not p.deleted and coalesce(p.data->>'archived','false')<>'true'
 and exists(select 1 from jsonb_array_elements(coalesce(f.data->'versions','[]'::jsonb)) v where v->>'id'=p_version)
 and (public.is_member(p_studio) or (
 public.beta_has_project(p_studio,p.id) and f.data->>'status' in ('In review','Changes requested','Approved')
 and (f.data->'versions'->-1->>'id'=p_version or exists(
 select 1 from public.beta_shared_versions s where s.studio_id=p_studio and s.file_id=p_file and s.version_id=p_version)))));
$$;
drop policy if exists "beta read accessible pins" on public.beta_annotations;
create policy "beta read accessible pins" on public.beta_annotations for select to authenticated
 using(public.beta_annotation_access(studio_id,file_id,version_id));
revoke all on public.beta_annotations from public,anon,authenticated;
grant select on public.beta_annotations to authenticated;

create or replace function public.beta_add_annotation(p_studio uuid,p_file text,p_version text,p_page integer,p_x double precision,p_y double precision,p_body text)
returns uuid language plpgsql security definer set search_path=public as $$
declare f jsonb; pin uuid;
begin
 select data into f from public.records where studio_id=p_studio and coll='files' and id=p_file and not deleted for update;
 if f is null or not public.beta_annotation_access(p_studio,p_file,p_version) then raise exception 'No file access';end if;
 if p_version is distinct from f->'versions'->-1->>'id' then raise exception 'File version changed. Refresh before adding feedback.';end if;
 if f->>'status' is null or f->>'status' not in ('In review','Changes requested') then raise exception 'This version is closed for feedback';end if;
 if p_body is null or length(trim(p_body)) not between 1 and 2000 or p_page is null or p_page not between 1 and 100 or p_x is null or not(p_x between 0 and 1) or p_y is null or not(p_y between 0 and 1) then raise exception 'Invalid feedback pin';end if;
 if coalesce(f->>'name','') !~* '\.pdf$' and coalesce(f->'versions'->-1->>'mime','')<>'application/pdf' and p_page<>1 then raise exception 'Images have one page';end if;
 insert into public.beta_annotations(studio_id,file_id,version_id,project_id,page,x,y,body,author_id,author_label,from_client)
 values(p_studio,p_file,p_version,f->>'projectId',p_page,p_x,p_y,trim(p_body),auth.uid(),left(coalesce(auth.jwt()->>'email','Reviewer'),200),not public.is_member(p_studio)) returning id into pin;
 return pin;
end $$;
create or replace function public.beta_resolve_annotation(p_pin uuid,p_resolved boolean)
returns void language plpgsql security definer set search_path=public as $$
declare a public.beta_annotations;
begin
 select * into a from public.beta_annotations where id=p_pin;
 if a.id is null or not public.is_member(a.studio_id) or not public.beta_annotation_access(a.studio_id,a.file_id,a.version_id) then raise exception 'Studio access required';end if;
 if p_resolved is null then raise exception 'Choose a resolution';end if;
 update public.beta_annotations set resolved=p_resolved,resolved_by=case when p_resolved then auth.uid() else null end where id=p_pin;
end $$;
revoke all on function public.beta_annotation_access(uuid,text,text),public.beta_add_annotation(uuid,text,text,integer,double precision,double precision,text),public.beta_resolve_annotation(uuid,boolean) from public,anon;
grant execute on function public.beta_annotation_access(uuid,text,text),public.beta_add_annotation(uuid,text,text,integer,double precision,double precision,text),public.beta_resolve_annotation(uuid,boolean) to authenticated;
commit;
