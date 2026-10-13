import { useEffect,useState } from 'react'
import { BETA_STUDIO_ID } from './config'
type Attachment={id:string;name:string;blob_path:string;project_id:string|null;request_id:string|null}
export default function Uploads({projectId=null,onAttachments}:{projectId?:string|null;onAttachments?:(ids:string[])=>void}){
 const [files,setFiles]=useState<Attachment[]>([]),[busy,setBusy]=useState(false),[message,setMessage]=useState('')
 async function load(){const {supabase}=await import('../data/cloud/supabase');const {data,error}=await supabase().from('beta_attachments').select('id,name,blob_path,project_id,request_id').eq('studio_id',BETA_STUDIO_ID!).order('created_at');if(error){setMessage('Uploads need the Beta workflows database update.');return}const visible=(data as Attachment[]).filter(f=>f.project_id===projectId&&(projectId!==null||!f.request_id));setFiles(visible);onAttachments?.(visible.map(f=>f.id))}
 useEffect(()=>{void load()},[projectId])
 async function upload(file:File){setBusy(true);setMessage('');let path:string|undefined;try{
  const allowed:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','application/pdf':'pdf','text/plain':'txt','application/zip':'zip','application/x-zip-compressed':'zip'};
  const ext=allowed[file.type];if(!ext||file.size>20_000_000||file.size===0)throw Error('Choose PNG, JPEG, WebP, PDF, TXT or ZIP files below 20 MB.');
  const {supabase}=await import('../data/cloud/supabase');const sb=supabase(),{data:auth}=await sb.auth.getUser();if(!auth.user)throw Error('Sign in again');
  if(files.length>=10&&projectId===null)throw Error('Up to 10 attachments per request');
  path=`${BETA_STUDIO_ID}/${auth.user.id}/${crypto.randomUUID()}.${ext}`;
  const sent=await sb.storage.from('beta-uploads').upload(path,file,{upsert:false,contentType:ext==='zip'?'application/zip':file.type});if(sent.error)throw sent.error;
  const result=await sb.rpc('beta_register_attachment',{p_studio:BETA_STUDIO_ID,p_project:projectId,p_path:path,p_name:file.name.slice(0,200)});if(result.error){await sb.storage.from('beta-uploads').remove([path]);throw result.error}await load();setMessage('File securely uploaded to Beta.')
 }catch(e){setMessage(e instanceof Error?e.message:'Upload failed. Please try again.')}finally{setBusy(false)}}
 async function download(file:Attachment){setBusy(true);try{const {supabase}=await import('../data/cloud/supabase');const {data,error}=await supabase().storage.from('beta-uploads').download(file.blob_path);if(error||!data)throw error;const url=URL.createObjectURL(data),a=document.createElement('a');a.href=url;a.download=file.name;a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}catch{setMessage('Unable to download. Check your access and try again.')}finally{setBusy(false)}}
 return <section className="beta-uploads"><h3>{projectId?'Your project attachments':'Add files to your request'}</h3><label>Upload an attachment<input type="file" disabled={busy} accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.zip" onChange={e=>{const file=e.target.files?.[0];if(file)void upload(file);e.target.value=''}}/></label><small>Private files, up to 20 MB. Uploads go directly to your authenticated Beta workspace.</small>{files.map(f=><div className="beta-upload-item" key={f.id}><span>{f.name}</span><button type="button" disabled={busy} onClick={()=>download(f)}>Download ↓</button></div>)}<p role="status">{busy?'Working…':message}</p></section>
}
