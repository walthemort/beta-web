import { useEffect, useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { cloudConfigured } from '../data/cloud/config'
import { BETA_STUDIO_ID, BETA_WEBSITE_URL } from './config'
import './beta.css'
import ProjectFiles from './ProjectFiles'
import Uploads from './Uploads'
import Timeline from './Timeline'
import Requests from './Requests'
import { ArrowUpRight } from 'lucide-react'

type Project = { id: string; name: string; due: string | null }
type Access = { kind: 'loading' } | { kind: 'signed-out' } | { kind: 'staff' } | { kind: 'client'; projects: Project[] } | { kind: 'blocked'; message: string }
export function BetaLoading() {
 return <div className="beta-screen" role="status"><div className="beta-wordmark"><img src="/logos/b-white.svg" alt="Beta" /></div><div className="beta-loader" /><p>Getting your workspace ready.</p></div>
}

/** This routing gate is backed by Supabase membership checks, never by a selectable UI role. */
export default function BetaPortal({ children }: { children: ReactNode }) {
 const [access,setAccess] = useState<Access>({kind:'loading'})
 const [email,setEmail] = useState('')
 const [message,setMessage] = useState('')
 const [busy,setBusy] = useState(false)
 const location = useLocation()
 useEffect(()=>{
  document.title='Beta — Client portal'
  if(!cloudConfigured() || !BETA_STUDIO_ID){setAccess({kind:'blocked',message:'The Beta workspace is not connected yet. Please contact Beta for project access.'});return}
  let live=true,version=0,stop=()=>{}
  import('../data/cloud/supabase').then(async({supabase})=>{
   const sb=supabase()
   const refresh=async()=>{
    const request=++version
    if(live)setAccess({kind:'loading'})
    try{
     const {data,error}=await sb.auth.getSession();if(error)throw error
     if(!live||request!==version)return
     if(!data.session){setAccess({kind:'signed-out'});return}
     const membership=await sb.from('studio_members').select('role').eq('studio_id',BETA_STUDIO_ID!).eq('user_id',data.session.user.id).maybeSingle()
     if(membership.error)throw membership.error
     if(!live||request!==version)return
     if(membership.data){setAccess({kind:'staff'});return}
     const invitation=await sb.rpc('beta_accept_client_invite',{p_studio:BETA_STUDIO_ID});if(invitation.error&&!/function.*schema cache/i.test(invitation.error.message))throw invitation.error
     const projects=await sb.rpc('beta_client_projects',{p_studio:BETA_STUDIO_ID})
     if(projects.error)throw projects.error
     if(live&&request===version)setAccess({kind:'client',projects:projects.data as Project[]})
    }catch{if(live&&request===version)setAccess({kind:'blocked',message:'We could not verify your workspace access. Ask Beta to check your invitation and try again.'})}
   }
   const sub=sb.auth.onAuthStateChange(()=>{setTimeout(()=>{if(live)void refresh()},0)})
   stop=()=>sub.data.subscription.unsubscribe()
   if(!live){stop();return}await refresh()
  }).catch(()=>{if(live)setAccess({kind:'blocked',message:'Unable to connect. Please try again.'})})
  return()=>{live=false;version++;stop()}
 },[])
 async function signIn(e: React.FormEvent){
  e.preventDefault();setBusy(true);setMessage('')
  try{
   const {supabase}=await import('../data/cloud/supabase')
   const {error}=await supabase().auth.signInWithOtp({email:email.trim().toLowerCase(),options:{emailRedirectTo:`${window.location.origin}/portal`,shouldCreateUser:true}})
   if(error)throw error
   setMessage('Check your email for your secure sign-in link.')
  }catch{setMessage('Unable to send a sign-in link. Check that you have been invited, or contact Beta.')}
  finally{setBusy(false)}
 }
 async function signOut(){try{const {supabase}=await import('../data/cloud/supabase');const {error}=await supabase().auth.signOut();if(error)throw error;setAccess({kind:'signed-out'})}catch{setMessage('Unable to sign out. Please try again.')}}
 if(access.kind==='loading')return <BetaLoading />
 if(access.kind==='staff'){
  if(location.pathname.startsWith('/app')||location.pathname.startsWith('/print/'))return <>{children}</>
  return <Navigate to="/app" replace />
 }
 return <div className="beta-portal"><header><a className="beta-wordmark" href={BETA_WEBSITE_URL}><img src="/logos/beta-black.svg" alt="Beta" /></a><span>YOUR CREATIVE WORKSPACE</span></header><main>
  {access.kind==='signed-out'?<><span className="beta-eyebrow">BETTER, TOGETHER.</span><h1>Every project.<br />One <em>place.</em></h1><p>Files, feedback, and what comes next.<br />Sign in with the email Beta invited you with.</p><form onSubmit={signIn}><label htmlFor="beta-email">Your email</label><input id="beta-email" type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@company.com"/><button disabled={busy}>{busy?'Sending…':'Send me a sign-in link'} {!busy&&<ArrowUpRight size={15} aria-hidden="true"/>}</button></form><small>Access is by invitation. Need a hand? Contact Beta.</small></>:access.kind==='blocked'?<><h1>A little<br /><em>connection.</em></h1><p role="alert">{access.message}</p>{cloudConfigured()&&<button onClick={signOut}>Back to sign in</button>}</>:<ClientProjects projects={access.projects} />}
  <p role="status">{message}</p>{access.kind==='client'&&<button className="beta-signout" onClick={signOut}>Sign out</button>}
 </main><footer>ALWAYS MOVING FORWARD. <span>BETA / CLIENT PORTAL</span></footer></div>
}
function ClientProjects({projects}:{projects:Project[]}){
 const [selected,setSelected]=useState<string|null>(null),[expanded,setExpanded]=useState(false)
 const [attachments,setAttachments]=useState<string[]>([]),[requestKey,setRequestKey]=useState(0)
 const [description,setDescription]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false)
 async function request(e:React.FormEvent){e.preventDefault();setBusy(true);setMessage('');try{const {supabase}=await import('../data/cloud/supabase');const {error}=await supabase().rpc('beta_submit_request',{p_studio:BETA_STUDIO_ID,p_description:description.trim(),p_attachments:attachments});if(error)throw error;setDescription('');setAttachments([]);setRequestKey(k=>k+1);setMessage('Your project request has been sent to Beta.')}catch{setMessage('Your request could not be sent. Please try again.')}finally{setBusy(false)}}
 return <><span className="beta-eyebrow">YOUR PROJECTS</span><h1>Good to have<br />you <em>here.</em></h1><p>Your projects with Beta, together in one place.</p><div className="beta-projects">{projects.length?projects.map(p=><article key={p.id}><span>↗</span><h2>{p.name}</h2><p>{p.due?`Due ${p.due}`:'We’ll keep you posted on the next step.'}</p><button aria-expanded={expanded&&selected===p.id} onClick={()=>{if(selected===p.id)setExpanded(!expanded);else{setSelected(p.id);setExpanded(true)}}}>{expanded&&selected===p.id?'Close project':'Open project →'}</button></article>):<p>No active projects yet. Your access is ready for what comes next.</p>}</div>{selected&&<section className="beta-project-open" data-open={expanded} aria-hidden={!expanded} inert={!expanded}><div key={selected}><Timeline projectId={selected}/><ProjectFiles projectId={selected}/><Uploads projectId={selected}/></div></section>}<Requests key={`requests-${requestKey}`}/><h2>What’s next?</h2><Uploads key={requestKey} onAttachments={setAttachments}/><form onSubmit={request}><label htmlFor="beta-request">Request a new project</label><textarea id="beta-request" required maxLength={4000} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Tell us what you have in mind…"/><button disabled={busy}>{busy?'Sending…':'Send project request →'}</button></form><p role="status">{message}</p></>
}
