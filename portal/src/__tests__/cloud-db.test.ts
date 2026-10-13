/**
 * The cloud database (supabase/migrations): run for real in PGlite – Postgres in WebAssembly – with
 * Supabase's auth and storage stubbed the way Supabase defines them, then checked as three people:
 * the owner, a teammate who was invited, and a stranger.
 */
import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const MIGRATION = readFileSync(new URL('../../supabase/migrations/0001_formlar.sql', import.meta.url), 'utf8')
const BETA_ANNOTATIONS=readFileSync(new URL('../../supabase/migrations/0006_beta_annotations.sql',import.meta.url),'utf8')
const BETA_WORKFLOWS = readFileSync(new URL('../../supabase/migrations/0005_beta_workflows.sql', import.meta.url), 'utf8')
const BETA_FILES = readFileSync(new URL('../../supabase/migrations/0004_beta_file_review.sql', import.meta.url), 'utf8')
const BETA_PORTAL = readFileSync(new URL('../../supabase/migrations/0003_beta_portal.sql', import.meta.url), 'utf8')
const SUBSCRIPTIONS = readFileSync(new URL('../../supabase/migrations/0002_subscriptions.sql', import.meta.url), 'utf8')

// What Supabase provides before any migration runs: the auth schema, roles and storage.
const SUPABASE = `
  create schema auth;
  create table auth.users (id uuid primary key, email text);
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
  create role authenticated nologin;
  create role anon nologin;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1]
  $$;
`
const GRANTS = `
  grant usage on schema public, auth, storage to authenticated, anon;
  grant select, insert, update, delete on all tables in schema public to authenticated;
  grant select, insert, update, delete on storage.objects to authenticated;
  grant execute on all functions in schema auth to authenticated, anon;
  grant execute on all functions in schema storage to authenticated, anon;
`

const OWNER = { id: '00000000-0000-4000-8000-000000000001', email: 'ann@studio.dk' }
const MATE = { id: '00000000-0000-4000-8000-000000000002', email: 'bo@studio.dk' }
const STRANGER = { id: '00000000-0000-4000-8000-000000000003', email: 'eve@elsewhere.dk' }

let db: PGlite
let studio: string

/** Runs `sql` as a signed-in person (or as nobody), with row-level security in force. */
async function as<T = Record<string, unknown>>(who: { id: string; email: string } | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claims', '${who ? JSON.stringify({ sub: who.id, email: who.email, role: 'authenticated' }) : ''}', false);`)
  await db.exec(who ? 'set role authenticated' : 'set role anon')
  try {
    return (await db.query<T>(sql, params)).rows
  } finally {
    await db.exec('reset role')
  }
}

beforeAll(async () => {
  db = new PGlite()
  await db.exec(SUPABASE)
  await db.exec(MIGRATION)
  await db.exec(SUBSCRIPTIONS)
  await db.exec(BETA_PORTAL)
  await db.exec(BETA_FILES)
  await db.exec(BETA_WORKFLOWS)
  await db.exec(BETA_WORKFLOWS) // repeatable migration, with all named policies recreated atomically
  await db.exec(BETA_ANNOTATIONS)
  await db.exec(BETA_ANNOTATIONS)
  await db.exec(GRANTS)
  for (const u of [OWNER, MATE, STRANGER]) await db.query('insert into auth.users (id, email) values ($1, $2)', [u.id, u.email])
  const [row] = await as<{ create_studio: string }>(OWNER, `select public.create_studio('BETA_01')`)
  studio = row.create_studio
})

describe('The cloud database', () => {
  it('makes the person who creates a studio its owner', async () => {
    const members = await as(OWNER, 'select user_id, role from public.studio_members where studio_id = $1', [studio])
    expect(members).toEqual([{ user_id: OWNER.id, role: 'owner' }])
    expect(await as(OWNER, 'select name from public.studios')).toEqual([{ name: 'BETA_01' }])
  })

  it('keeps each item as a row, stamps who changed it, and keeps its place in the list', async () => {
    await as(OWNER, `insert into public.records (studio_id, coll, id, data, ord, client) values ($1, 'projects', 'p1', '{"name":"RAY"}', 5, 'tab-a')`, [studio])
    await as(OWNER, `insert into public.records (studio_id, coll, id, data, ord) values ($1, 'projects', 'p1', '{"name":"RAY – identity"}', 99)
      on conflict (studio_id, coll, id) do update set data = excluded.data, ord = excluded.ord`, [studio])
    const [row] = await as<{ data: { name: string }; ord: number; updated_by: string }>(OWNER, `select data, ord, updated_by from public.records where id = 'p1'`)
    expect(row.data.name).toBe('RAY – identity')
    expect(row.ord).toBe(5)
    expect(row.updated_by).toBe(OWNER.id)
  })

  it('shows a stranger nothing, and lets them change nothing', async () => {
    expect(await as(STRANGER, 'select * from public.records')).toEqual([])
    expect(await as(STRANGER, 'select * from public.studios')).toEqual([])
    await expect(as(STRANGER, `insert into public.records (studio_id, coll, id, data) values ($1, 'projects', 'x', '{}')`, [studio])).rejects.toThrow()
    await as(STRANGER, `update public.records set data = '{"name":"hacked"}' where id = 'p1'`)
    const [row] = await as<{ data: { name: string } }>(OWNER, `select data from public.records where id = 'p1'`)
    expect(row.data.name).toBe('RAY – identity')
    expect(await as(null, 'select * from public.records').catch(() => [])).toEqual([])
  })

  it('lets only the owner invite, and brings the invited person in when they sign in', async () => {
    await expect(as(STRANGER, `insert into public.invites (studio_id, email) values ($1, 'eve@elsewhere.dk')`, [studio])).rejects.toThrow()
    await as(OWNER, `insert into public.invites (studio_id, email) values ($1, $2)`, [studio, MATE.email])
    // The invited person can see their invitation before accepting it.
    expect(await as(MATE, 'select email from public.invites')).toEqual([{ email: MATE.email }])
    const joined = await as<{ accept_invites: string }>(MATE, 'select public.accept_invites()')
    expect(joined.map((r) => r.accept_invites)).toEqual([studio])
    expect(await as(MATE, 'select id from public.records')).toEqual([{ id: 'p1' }])
    expect(await as(OWNER, 'select * from public.invites')).toEqual([])
  })

  it('lets teammates work in the workspace but not remove people', async () => {
    await as(MATE, `insert into public.records (studio_id, coll, id, data) values ($1, 'clients', 'c1', '{"name":"RAY"}')`, [studio])
    await as(MATE, `delete from public.studio_members where user_id = $1`, [OWNER.id])
    expect((await as(OWNER, 'select * from public.studio_members')).length).toBe(2)
    await as(OWNER, `delete from public.studio_members where user_id = $1`, [MATE.id])
    expect(await as(MATE, 'select * from public.records')).toEqual([])
  })

  it('keeps files to the studio they belong to', async () => {
    await as(OWNER, `insert into storage.objects (bucket_id, name) values ('files', $1)`, [`${studio}/logo.svg`])
    await expect(as(STRANGER, `insert into storage.objects (bucket_id, name) values ('files', $1)`, [`${studio}/evil.svg`])).rejects.toThrow()
    expect(await as(STRANGER, 'select name from storage.objects')).toEqual([])
    expect(await as(OWNER, 'select name from storage.objects')).toEqual([{ name: `${studio}/logo.svg` }])
  })

  it('won’t make a studio for someone who isn’t signed in', async () => {
    await expect(as(null, `select public.create_studio('Nope')`)).rejects.toThrow()
  })
})

/**
 * What a studio pays for. The whole point is that the studio can read this and never write it:
 * with the plan in the browser's own state, anyone can set it to "studio" from the console.
 */
describe('What the studio pays for', () => {
  /** Stripe's webhook writes with the service-role key, which skips row-level security. */
  const asStripe = <T = Record<string, unknown>>(sql: string, params: unknown[] = []) => db.query<T>(sql, params).then((r) => r.rows)

  it('is the free plan until something says otherwise', async () => {
    const [row] = await as<{ plan_of: string }>(OWNER, 'select public.plan_of($1)', [studio])
    expect(row.plan_of).toBe('free')
  })

  it('lets the studio read what the webhook wrote', async () => {
    await asStripe(
      `insert into public.subscriptions (studio_id, plan, period, extra_storage, stripe_customer_id, stripe_subscription_id)
       values ($1, 'studio', 'yearly', 2, 'cus_1', 'sub_1')`,
      [studio],
    )
    const rows = await as<{ plan: string; period: string; extra_storage: number }>(OWNER, 'select plan, period, extra_storage from public.subscriptions')
    expect(rows).toEqual([{ plan: 'studio', period: 'yearly', extra_storage: 2 }])
    const [p] = await as<{ plan_of: string }>(OWNER, 'select public.plan_of($1)', [studio])
    expect(p.plan_of).toBe('studio')
  })

  it('will not let the studio give itself a plan', async () => {
    // No insert, update or delete policy exists, so every one of these is refused or does nothing.
    await expect(as(OWNER, `insert into public.subscriptions (studio_id, plan) values ($1, 'studio')`, [STRANGER.id])).rejects.toThrow()
    await as(OWNER, `update public.subscriptions set plan = 'studio', extra_storage = 20 where studio_id = $1`, [studio])
    await as(OWNER, `delete from public.subscriptions where studio_id = $1`, [studio])
    const rows = await as<{ plan: string; extra_storage: number }>(OWNER, 'select plan, extra_storage from public.subscriptions')
    expect(rows).toEqual([{ plan: 'studio', extra_storage: 2 }])
  })

  it('drops back to free when the subscription is cancelled, without losing the record', async () => {
    await asStripe(`update public.subscriptions set status = 'canceled' where studio_id = $1`, [studio])
    const [p] = await as<{ plan_of: string }>(OWNER, 'select public.plan_of($1)', [studio])
    expect(p.plan_of).toBe('free')
    await asStripe(`update public.subscriptions set status = 'past_due' where studio_id = $1`, [studio])
    // A card being retried keeps the studio working.
    const [still] = await as<{ plan_of: string }>(OWNER, 'select public.plan_of($1)', [studio])
    expect(still.plan_of).toBe('studio')
  })

  it('shows a stranger nothing', async () => {
    expect(await as(STRANGER, 'select * from public.subscriptions')).toEqual([])
    expect(await as(null, 'select * from public.subscriptions').catch(() => [])).toEqual([])
  })

  it('refuses a plan or a status it does not know', async () => {
    await expect(asStripe(`update public.subscriptions set plan = 'enterprise' where studio_id = $1`, [studio])).rejects.toThrow()
    await expect(asStripe(`update public.subscriptions set extra_storage = 99 where studio_id = $1`, [studio])).rejects.toThrow()
  })
})


describe('Beta client isolation', () => {
  it('only returns explicitly assigned client projects, without internal notes', async () => {
    await db.query("insert into public.beta_client_members(studio_id,user_id,client_id) values($1,$2,'beta-client')", [studio, STRANGER.id])
    await as(OWNER, `insert into public.records(studio_id,coll,id,data) values
      ($1,'projects','beta-visible','{"name":"Visible","clientId":"beta-client","notes":"SECRET","tasks":[{"text":"internal"}]}'),
      ($1,'projects','beta-other','{"name":"Other client","clientId":"other"}'),
      ($1,'projects','beta-archived','{"name":"Archived","clientId":"beta-client","archived":true}')`, [studio])
    expect(await as(STRANGER,'select * from public.beta_client_projects($1)',[studio])).toEqual([{id:'beta-visible',name:'Visible',due:null}])
    expect(await as(STRANGER,'select * from public.records')).toEqual([])
    await expect(as(MATE,'select * from public.beta_client_projects($1)',[studio])).rejects.toThrow('No client access')
    await expect(as(null,'select * from public.beta_client_projects($1)',[studio])).rejects.toThrow()
    await expect(as(STRANGER,'select * from public.beta_client_projects($1)',["00000000-0000-4000-8000-000000000099"])).rejects.toThrow('No client access')
  })
  it('does not let a client assign themselves or become staff', async () => {
    await expect(as(STRANGER,"insert into public.beta_client_members(studio_id,user_id,client_id) values($1,$2,'other')",[studio,MATE.id])).rejects.toThrow()
    await as(STRANGER,"update public.beta_client_members set client_id='other' where user_id=$1",[STRANGER.id])
    expect(await as(STRANGER,'select * from public.beta_client_projects($1)',[studio])).toEqual([{id:'beta-visible',name:'Visible',due:null}])
    expect(await as(STRANGER,'select * from public.studio_members')).toEqual([])
  })
  it('records a scoped request visible to staff and rejects unauthorized requests', async () => {
    await as(STRANGER,"select public.beta_request_project($1,'A new website')",[studio])
    const rows=await as<{data:{text:string;clientId:string}}>(OWNER,"select data from public.records where coll='activity' and data->>'clientId'='beta-client'",[ ])
    expect(rows).toHaveLength(1)
    expect(rows[0].data.text).toBe('New project request: A new website')
    await expect(as(MATE,"select public.beta_request_project($1,'Unauthorized')",[studio])).rejects.toThrow('No client access')
    await expect(as(STRANGER,"select public.beta_request_project($1,'')",[studio])).rejects.toThrow('Invalid request')
    await expect(as(STRANGER,"select public.beta_request_project($1,null)",[studio])).rejects.toThrow('Invalid request')
  })
})


describe('Beta file reviews', () => {
  it('only lists shared files in assigned projects and scopes private downloads', async () => {
    await as(OWNER, `insert into public.records(studio_id,coll,id,data) values
      ($1,'files','beta-file','{"name":"Logo.svg","projectId":"beta-visible","status":"In review","versions":[{"id":"v1","src":"idb:old"},{"id":"v2","src":"idb:current"}],"comments":[]}'),
      ($1,'files','beta-hidden','{"name":"Draft.svg","projectId":"beta-visible","status":"Not shared"}'),
      ($1,'files','beta-other-file','{"name":"Private.svg","projectId":"beta-other","status":"In review","versions":[{"id":"v1","src":"idb:other"}]}')`, [studio])
    expect(await as(STRANGER,'select * from public.beta_project_files($1,$2)',[studio,'beta-visible'])).toEqual([{id:'beta-file',name:'Logo.svg',status:'In review',version_id:'v2',blob_key:'current'}])
    await expect(as(STRANGER,'select * from public.beta_project_files($1,$2)',[studio,'beta-other'])).rejects.toThrow('No project access')
    for(const key of ['current','old','other']) {
      await db.query("insert into storage.objects(bucket_id,name) values('files',$1)",[studio+'/'+key])
    }
    expect(await as(STRANGER,'select name from storage.objects')).toEqual([{name:studio+'/current'}])
    await expect(as(STRANGER,"insert into storage.objects(bucket_id,name) values('files',$1)",[studio+'/client-upload'])).rejects.toThrow()
  })
  it('rejects cross-client and stale-version reviews and requires change feedback', async () => {
    await expect(as(STRANGER,"select public.beta_review_file($1,'beta-other-file','v1','Approved','')",[studio])).rejects.toThrow('No file access')
    await expect(as(STRANGER,"select public.beta_review_file($1,'beta-file','v1','Approved','')",[studio])).rejects.toThrow('File version changed')
    await expect(as(STRANGER,"select public.beta_review_file($1,'beta-file','v2','Changes requested','')",[studio])).rejects.toThrow('Please provide feedback')
    await expect(as(MATE,"select public.beta_review_file($1,'beta-file','v2','Approved','')",[studio])).rejects.toThrow('No file access')
    await as(STRANGER,"select public.beta_review_file($1,'beta-file','v2','Changes requested','Make the logo larger')",[studio])
    const [row]=await as<{data:{status:string;comments:{text:string;fromClient:boolean}[]}}>(OWNER,"select data from public.records where id='beta-file'",[])
    expect(row.data.status).toBe('Changes requested')
    expect(row.data.comments[0]).toMatchObject({text:'Make the logo larger',fromClient:true})
  })
  it('accepts the current version once and records the authenticated client', async () => {
    await as(OWNER,"update public.records set data=jsonb_set(data,'{status}','\"In review\"') where id='beta-file'")
    await as(STRANGER,"select public.beta_review_file($1,'beta-file','v2','Approved','Looks good')",[studio])
    const [row]=await as<{data:{status:string;approvedBy:string;approvedAt:string}}>(OWNER,"select data from public.records where id='beta-file'")
    expect(row.data.status).toBe('Approved')
    expect(row.data.approvedBy).toBe(STRANGER.email)
    expect(row.data.approvedAt).toBeTruthy()
    await expect(as(STRANGER,"select public.beta_review_file($1,'beta-file','v2','Approved','')",[studio])).rejects.toThrow('not awaiting review')
  })
})


describe('Beta onboarding, attachments, timelines and history',()=>{
 const CLIENT={id:'00000000-0000-4000-8000-000000000004',email:'client@beta.test'}
 const OTHER={id:'00000000-0000-4000-8000-000000000005',email:'other@beta.test'}
 let attachment:string,request:string
 const objectId='11111111-1111-4111-8111-111111111111'
 it('accepts only an owner-created invitation for the authenticated email',async()=>{
  for(const u of [CLIENT,OTHER])await db.query('insert into auth.users(id,email) values($1,$2)',[u.id,u.email])
  await as(OWNER,`insert into public.records(studio_id,coll,id,data) values($1,'clients','beta-client','{"name":"Client A"}'),($1,'clients','client-b','{"name":"Client B"}')`,[studio])
  await expect(as(STRANGER,"insert into public.beta_client_invites(studio_id,email,client_id) values($1,$2,'beta-client')",[studio,CLIENT.email])).rejects.toThrow()
  await as(OWNER,"insert into public.beta_client_invites(studio_id,email,client_id) values($1,$2,'beta-client')",[studio,CLIENT.email])
  expect(await as(OTHER,'select public.beta_accept_client_invite($1)',[studio])).toEqual([{beta_accept_client_invite:false}])
  expect(await as(CLIENT,'select public.beta_accept_client_invite($1)',[studio])).toEqual([{beta_accept_client_invite:true}])
  expect(await as(CLIENT,'select * from public.records')).toEqual([])
  expect(await as(CLIENT,'select * from public.studio_members')).toEqual([])
  expect(await as(CLIENT,'select * from public.beta_client_invites')).toEqual([])
  await expect(as(null,'select public.beta_accept_client_invite($1)',[studio])).rejects.toThrow()
  await as(OWNER,"insert into public.beta_client_invites(studio_id,email,client_id,expires_at) values($1,$2,'client-b',now()-interval '1 day')",[studio,OTHER.email])
  expect(await as(OTHER,'select public.beta_accept_client_invite($1)',[studio])).toEqual([{beta_accept_client_invite:false}])
 })
 it('requires authenticated ownership of the upload path and an existing object',async()=>{
  const path=studio+'/'+CLIENT.id+'/'+objectId+'.pdf'
  await expect(as(OTHER,"insert into storage.objects(bucket_id,name) values('beta-uploads',$1)",[path])).rejects.toThrow()
  await expect(as(CLIENT,"insert into storage.objects(bucket_id,name) values('beta-uploads',$1)",[studio+'/'+STRANGER.id+'/'+objectId+'.pdf'])).rejects.toThrow()
  await expect(as(CLIENT,"select public.beta_register_attachment($1,null,$2,'Brief.pdf')",[studio,path])).rejects.toThrow('Upload the file first')
  await as(CLIENT,"insert into storage.objects(bucket_id,name) values('beta-uploads',$1)",[path])
  const [r]=await as<{beta_register_attachment:string}>(CLIENT,"select public.beta_register_attachment($1,null,$2,'Brief.pdf')",[studio,path]);attachment=r.beta_register_attachment
  expect(await as(OTHER,"select name from storage.objects where bucket_id='beta-uploads'")).toEqual([])
  expect(await as(CLIENT,"select name from storage.objects where bucket_id='beta-uploads'")).toEqual([{name:path}])
  expect(await as(OWNER,"select name from storage.objects where bucket_id='beta-uploads'")).toEqual([{name:path}])
  await expect(as(CLIENT,"select public.beta_register_attachment($1,'beta-other',$2,'Brief.pdf')",[studio,path])).rejects.toThrow('No project access')
  await expect(as(OTHER,"select public.beta_register_attachment($1,null,$2,'Brief.pdf')",[studio,path])).rejects.toThrow('No upload access')
 })
 it('attaches only own pending files to a request and separates clients and staff',async()=>{
  await expect(as(STRANGER,"select public.beta_submit_request($1,'A request',$2)",[studio,[attachment]])).rejects.toThrow('Invalid attachment')
  const [r]=await as<{beta_submit_request:string}>(CLIENT,"select public.beta_submit_request($1,'New campaign',$2)",[studio,[attachment]]);request=r.beta_submit_request
  expect(await as(CLIENT,'select description,status from public.beta_requests')).toEqual([{description:'New campaign',status:'Received'}])
  expect(await as(STRANGER,'select * from public.beta_requests')).toEqual([])
  expect(await as(OTHER,'select * from public.beta_attachments')).toEqual([])
  await expect(as(CLIENT,"select public.beta_update_request($1,'Scheduled')",[request])).rejects.toThrow('No studio access')
  await as(OWNER,"select public.beta_update_request($1,'Discussing')",[request])
  expect(await as(CLIENT,'select status from public.beta_requests')).toEqual([{status:'Discussing'}])
  await expect(as(CLIENT,"select public.beta_submit_request($1,'Duplicate',$2)",[studio,[attachment]])).rejects.toThrow('Invalid attachment')
  await as(CLIENT,"delete from storage.objects where bucket_id='beta-uploads'")
  expect(await as(CLIENT,"select name from storage.objects where bucket_id='beta-uploads'")).toHaveLength(1)
 })
 it('shares only deliberate client milestones and denies forged project updates',async()=>{
  await as(OWNER,"insert into public.beta_project_events(studio_id,project_id,label) values($1,'beta-visible','Direction approved'),($1,'beta-other','Other client update')",[studio])
  const clientEvents=await as<{label:string}>(CLIENT,'select label from public.beta_project_events');expect(clientEvents).toContainEqual({label:'Direction approved'});expect(clientEvents.some(e=>e.label.includes('Other client'))).toBe(false);expect(clientEvents).toContainEqual({label:'File accepted: Logo.svg'})
  expect(await as(OTHER,'select label from public.beta_project_events')).toEqual([])
  await expect(as(CLIENT,"insert into public.beta_project_events(studio_id,project_id,label) values($1,'beta-visible','Forged approval')",[studio])).rejects.toThrow()
 })
 it('requires explicit owner sharing of history, and still rejects stale approvals',async()=>{
  expect(await as(CLIENT,"select * from public.beta_file_versions($1,'beta-file')",[studio])).toEqual([{version_id:'v2',blob_key:'current',is_current:true}])
  await expect(as(CLIENT,"select public.beta_share_version($1,'beta-file','v1',true)",[studio])).rejects.toThrow('Owner access required')
  await as(OWNER,"select public.beta_share_version($1,'beta-file','v1',true)",[studio])
  expect(await as(CLIENT,"select * from public.beta_file_versions($1,'beta-file')",[studio])).toEqual([{version_id:'v2',blob_key:'current',is_current:true},{version_id:'v1',blob_key:'old',is_current:false}])
  expect((await as(CLIENT,"select name from storage.objects where bucket_id='files'")).map(r=>r.name)).toEqual([studio+'/current',studio+'/old'])
  await expect(as(OTHER,"select * from public.beta_file_versions($1,'beta-file')",[studio])).rejects.toThrow('No file access')
  await expect(as(CLIENT,"select public.beta_review_file($1,'beta-file','v1','Approved','')",[studio])).rejects.toThrow('File version changed')
  await as(OWNER,"select public.beta_share_version($1,'beta-file','v1',false)",[studio])
  expect((await as(CLIENT,"select name from storage.objects where bucket_id='files'")).map(r=>r.name)).toEqual([studio+'/current'])
  await as(OWNER,`update public.records set data=jsonb_set(data,'{versions}',data->'versions'||'[{"id":"v3","src":"idb:new"}]'::jsonb) where id='beta-file'`)
  const [changed]=await as<{data:{status:string;approvedBy?:string}}>(OWNER,"select data from public.records where id='beta-file'");expect(changed.data.status).toBe('In review');expect(changed.data.approvedBy).toBeUndefined()
  const clientEvents=await as<{label:string}>(CLIENT,'select label from public.beta_project_events');expect(clientEvents).toContainEqual({label:'Ready for review: Logo.svg'})
 })
})


describe('Version-specific feedback pins',()=>{
 const CLIENT={id:'00000000-0000-4000-8000-000000000004',email:'client@beta.test'}
 const OTHER={id:'00000000-0000-4000-8000-000000000005',email:'other@beta.test'}
 let pin:string
 it('derives author and project from authenticated access and bounds the coordinates',async()=>{
  await as(OWNER,`insert into public.records(studio_id,coll,id,data) values($1,'files','pin-file','{"name":"Design","projectId":"beta-visible","status":"In review","versions":[{"id":"pin-v1","src":"idb:pin-image","mime":"application/pdf"}]}')`,[studio])
  for(const coords of [[-0.1,.5],[.5,1.1],[null,.5],['NaN',.5]])await expect(as(CLIENT,"select public.beta_add_annotation($1,'pin-file','pin-v1',1,$2,$3,'Invalid')",[studio,...coords])).rejects.toThrow('Invalid feedback pin')
  await expect(as(CLIENT,"select public.beta_add_annotation($1,'pin-file','pin-v1',101,.5,.5,'Invalid')",[studio])).rejects.toThrow()
  await expect(as(CLIENT,"select public.beta_add_annotation($1,'pin-file','pin-v1',1,.5,.5,'   ')",[studio])).rejects.toThrow()
  const [r]=await as<{beta_add_annotation:string}>(CLIENT,"select public.beta_add_annotation($1,'pin-file','pin-v1',2,.25,.75,'Make this heading clearer')",[studio]);pin=r.beta_add_annotation
  expect(await as(CLIENT,'select project_id,version_id,page,x,y,author_id,author_label,from_client,resolved from public.beta_annotations where id=$1',[pin])).toEqual([{project_id:'beta-visible',version_id:'pin-v1',page:2,x:.25,y:.75,author_id:CLIENT.id,author_label:CLIENT.email,from_client:true,resolved:false}])
 })
 it('denies unassigned clients, anonymous writes and direct impersonation',async()=>{
  expect(await as(OTHER,'select * from public.beta_annotations')).toEqual([])
  await expect(as(OTHER,"select public.beta_add_annotation($1,'pin-file','pin-v1',1,.5,.5,'Intrusion')",[studio])).rejects.toThrow('No file access')
  await expect(as(null,"select public.beta_add_annotation($1,'pin-file','pin-v1',1,.5,.5,'Intrusion')",[studio])).rejects.toThrow()
  await expect(as(CLIENT,`insert into public.beta_annotations(studio_id,file_id,version_id,project_id,page,x,y,body,author_id,author_label,from_client) values($1,'pin-file','pin-v1','beta-visible',1,.5,.5,'Fake',$2,'Owner',false)`,[studio,OWNER.id])).rejects.toThrow()
  await as(CLIENT,"update public.beta_annotations set body='Changed',resolved=true where id=$1",[pin])
  expect(await as(OWNER,'select body,resolved from public.beta_annotations where id=$1',[pin])).toEqual([{body:'Make this heading clearer',resolved:false}])
 })
 it('allows studio resolution without granting that action to a client',async()=>{
  await expect(as(CLIENT,'select public.beta_resolve_annotation($1,true)',[pin])).rejects.toThrow('Studio access required')
  await as(OWNER,'select public.beta_resolve_annotation($1,true)',[pin]);expect(await as(CLIENT,'select resolved,resolved_by from public.beta_annotations where id=$1',[pin])).toEqual([{resolved:true,resolved_by:OWNER.id}])
  await as(OWNER,'select public.beta_resolve_annotation($1,false)',[pin])
 })
 it('keeps old pins private after a revision unless that version is explicitly shared',async()=>{
  await as(OWNER,`update public.records set data=jsonb_set(data,'{versions}',data->'versions'||'[{"id":"pin-v2","src":"idb:pin-new"}]') where id='pin-file'`)
  expect(await as(CLIENT,'select * from public.beta_annotations')).toEqual([])
  await expect(as(CLIENT,"select public.beta_add_annotation($1,'pin-file','pin-v1',1,.5,.5,'Old')",[studio])).rejects.toThrow()
  await as(OWNER,"select public.beta_share_version($1,'pin-file','pin-v1',true)",[studio])
  expect(await as(CLIENT,'select id from public.beta_annotations')).toEqual([{id:pin}])
  await expect(as(CLIENT,"select public.beta_add_annotation($1,'pin-file','pin-v1',1,.5,.5,'Old')",[studio])).rejects.toThrow('File version changed')
  await as(OWNER,"select public.beta_share_version($1,'pin-file','pin-v1',false)",[studio]);expect(await as(CLIENT,'select * from public.beta_annotations')).toEqual([])
 })
 it('closes approved versions and prevents multi-page image pins',async()=>{
  await as(OWNER,`update public.records set data=data||'{"status":"Approved"}' where id='pin-file'`)
  await expect(as(CLIENT,"select public.beta_add_annotation($1,'pin-file','pin-v2',1,.5,.5,'Closed')",[studio])).rejects.toThrow('closed for feedback')
  await as(OWNER,`update public.records set data=data||'{"status":"In review","name":"Design.png"}' where id='pin-file'`)
  await expect(as(CLIENT,"select public.beta_add_annotation($1,'pin-file','pin-v2',2,.5,.5,'Wrong page')",[studio])).rejects.toThrow('Images have one page')
  await as(CLIENT,"select public.beta_add_annotation($1,'pin-file','pin-v2',1,.5,.5,'New version pin')",[studio]);expect((await as(CLIENT,'select version_id from public.beta_annotations')).map(r=>r.version_id)).toEqual(['pin-v2'])
 })
 it('removes access when the project is archived or client membership revoked',async()=>{
  await as(OWNER,`update public.records set data=data||'{"archived":true}' where id='beta-visible'`);expect(await as(CLIENT,'select * from public.beta_annotations')).toEqual([])
  await as(OWNER,`update public.records set data=data||'{"archived":false}' where id='beta-visible'`)
  await as(OWNER,'delete from public.beta_client_members where studio_id=$1 and user_id=$2',[studio,CLIENT.id]);expect(await as(CLIENT,'select * from public.beta_annotations')).toEqual([])
  await expect(as(CLIENT,"select public.beta_add_annotation($1,'pin-file','pin-v2',1,.5,.5,'Revoked')",[studio])).rejects.toThrow('No file access')
 })
})
