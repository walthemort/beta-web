-- Client-safe file listing, private downloads, and version-aware review decisions.
create or replace function public.beta_has_project(p_studio uuid,p_project text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.beta_client_members m join public.records p
 on p.studio_id=m.studio_id and p.coll='projects' and p.data->>'clientId'=m.client_id
 where m.studio_id=p_studio and m.user_id=auth.uid() and p.id=p_project and not p.deleted
 and coalesce(p.data->>'archived','false') <> 'true');
$$;
create or replace function public.beta_project_files(p_studio uuid,p_project text)
returns table(id text,name text,status text,version_id text,blob_key text)
language plpgsql stable security definer set search_path=public as $$
begin
 if not public.beta_has_project(p_studio,p_project) then raise exception 'No project access'; end if;
 return query select r.id,r.data->>'name',r.data->>'status',r.data->'versions'->-1->>'id',
 case when r.data->'versions'->-1->>'src' like 'idb:%' then substring(r.data->'versions'->-1->>'src' from 5) else null end
 from public.records r where r.studio_id=p_studio and r.coll='files' and not r.deleted
 and r.data->>'projectId'=p_project and r.data->>'status' in ('In review','Changes requested','Approved') order by r.ord;
end $$;
create or replace function public.beta_can_read_file(p_name text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.records r where r.coll='files' and not r.deleted
 and public.beta_has_project(r.studio_id,r.data->>'projectId')
 and r.data->>'status' in ('In review','Changes requested','Approved')
 and p_name=r.studio_id::text || '/' || substring(r.data->'versions'->-1->>'src' from 5)
 and r.data->'versions'->-1->>'src' like 'idb:%');
$$;
drop policy if exists "beta clients download shared files" on storage.objects;
create policy "beta clients download shared files" on storage.objects for select to authenticated
 using(bucket_id='files' and public.beta_can_read_file(name));

create or replace function public.beta_review_file(p_studio uuid,p_file text,p_version text,p_decision text,p_feedback text default '')
returns void language plpgsql security definer set search_path=public as $$
declare f jsonb; author text := coalesce(auth.jwt()->>'email','Client'); stamp text := now()::text;
begin
 select data into f from public.records where studio_id=p_studio and coll='files' and id=p_file and not deleted for update;
 if f is null or not public.beta_has_project(p_studio,f->>'projectId') then raise exception 'No file access'; end if;
 if p_version is null or p_version is distinct from (f->'versions'->-1->>'id') then raise exception 'File version changed. Refresh before reviewing.'; end if;
 if f->>'status' is distinct from 'In review' then raise exception 'This file is not awaiting review'; end if;
 if p_decision is null or p_decision not in ('Approved','Changes requested') then raise exception 'Invalid decision'; end if;
 if p_feedback is null or length(p_feedback)>4000 or (p_decision='Changes requested' and length(trim(p_feedback))=0) then raise exception 'Please provide feedback'; end if;
 f := f || jsonb_build_object('status',p_decision);
 if p_decision='Approved' then f := f || jsonb_build_object('approvedBy',author,'approvedAt',stamp);
 else f := f || jsonb_build_object('changesRequestedBy',author,'roundsUsed',coalesce((f->>'roundsUsed')::int,0)+1); end if;
 if length(trim(p_feedback))>0 then
 f := jsonb_set(f,'{comments}',coalesce(f->'comments','[]'::jsonb) || jsonb_build_array(jsonb_build_object('id',gen_random_uuid()::text,'versionId',p_version,'author',author,'fromClient',true,'text',trim(p_feedback),'at',stamp)));
 end if;
 update public.records set data=f where studio_id=p_studio and coll='files' and id=p_file;
end $$;
revoke all on function public.beta_has_project(uuid,text) from public,anon;
revoke all on function public.beta_project_files(uuid,text) from public,anon;
revoke all on function public.beta_can_read_file(text) from public,anon;
revoke all on function public.beta_review_file(uuid,text,text,text,text) from public,anon;
grant execute on function public.beta_has_project(uuid,text) to authenticated;
grant execute on function public.beta_project_files(uuid,text) to authenticated;
grant execute on function public.beta_can_read_file(text) to authenticated;
grant execute on function public.beta_review_file(uuid,text,text,text,text) to authenticated;
