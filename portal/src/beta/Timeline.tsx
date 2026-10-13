import { useEffect,useState } from 'react'
import {BETA_STUDIO_ID} from './config'
type Event={id:string;label:string;created_at:string}
export default function Timeline({projectId}:{projectId:string}){
 const [events,setEvents]=useState<Event[]>([]),[message,setMessage]=useState('Loading project updates…')
 useEffect(()=>{let live=true;import('../data/cloud/supabase').then(async({supabase})=>{const {data,error}=await supabase().from('beta_project_events').select('id,label,created_at').eq('studio_id',BETA_STUDIO_ID!).eq('project_id',projectId).order('created_at');if(!live)return;if(error)setMessage('Timeline updates are not available yet.');else{setEvents(data as Event[]);setMessage(data.length?'':'Beta will share the next milestones here.')}}).catch(()=>{if(live)setMessage('Unable to load updates.')});return()=>{live=false}},[projectId]);
 return <section className="beta-timeline"><h3>Project timeline</h3><ol>{events.map(e=><li key={e.id}><time dateTime={e.created_at}>{new Date(e.created_at).toLocaleDateString()}</time><p>{e.label}</p></li>)}</ol><p role="status">{message}</p></section>
}
