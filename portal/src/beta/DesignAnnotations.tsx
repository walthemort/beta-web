import {useEffect,useRef,useState} from 'react'
import type {PDFDocumentProxy,RenderTask} from 'pdfjs-dist'
import {supabase} from '../data/cloud/supabase'
import {BETA_STUDIO_ID} from './config'

type Pin={id:string;page:number;x:number;y:number;body:string;author_label:string;resolved:boolean;created_at:string}
type Position={x:number;y:number}
type Props={fileId:string;versionId:string;blobKey:string;name:string;readOnly?:boolean;staff?:boolean}
const clamp=(n:number)=>Math.max(0,Math.min(1,n))

/** Private storage only. Images and PDF canvases share normalized, page-specific coordinates. */
export default function DesignAnnotations({fileId,versionId,blobKey,name,readOnly=false,staff=false}:Props){
 const [open,setOpen]=useState(false),[pins,setPins]=useState<Pin[]>([]),[image,setImage]=useState(''),[pdf,setPdf]=useState<PDFDocumentProxy|null>(null)
 const [page,setPage]=useState(1),[pageImage,setPageImage]=useState(''),[selected,setSelected]=useState(''),[draft,setDraft]=useState<Position|null>(null),[body,setBody]=useState('')
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[loading,setLoading]=useState(false),[ready,setReady]=useState(false)
 const surface=useRef<HTMLDivElement>(null),textarea=useRef<HTMLTextAreaElement>(null)
 async function loadPins(){const {data,error}=await supabase().from('beta_annotations').select('id,page,x,y,body,author_label,resolved,created_at').eq('studio_id',BETA_STUDIO_ID!).eq('file_id',fileId).eq('version_id',versionId).order('created_at');if(error)throw error;return data as Pin[]}
 useEffect(()=>{
  if(!open)return
  let live=true,url='',document:PDFDocumentProxy|null=null,task:{destroy:()=>Promise<void>}|null=null
  setLoading(true);setPins([]);setReady(false);setImage('');setPdf(null);setPage(1);setDraft(null);setBody('');setMessage('')
  void (async()=>{
   try{
    const [{data,error},list]=await Promise.all([supabase().storage.from('files').download(`${BETA_STUDIO_ID}/${blobKey}`),loadPins()]);if(error||!data)throw error||Error('File unavailable');if(!live)return
    if(data.size>20_000_000)throw Error('Preview supports files up to 20 MB. Download this file to review it.')
    const bytes=new Uint8Array(await data.arrayBuffer());if(!live)return
    const signature=String.fromCharCode(...bytes.slice(0,12));const mime=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':bytes[0]===255&&bytes[1]===216?'image/jpeg':signature.startsWith('RIFF')&&signature.slice(8,12)==='WEBP'?'image/webp':null
    if(mime){url=URL.createObjectURL(new Blob([bytes],{type:mime}));setImage(url)}
    else if(signature.startsWith('%PDF-')){const pdfjs=await import('pdfjs-dist');if(!live)return;pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdfjs-dist/build/pdf.worker.min.mjs',import.meta.url).href;const loadingTask=pdfjs.getDocument({data:bytes});task=loadingTask;document=await loadingTask.promise;if(!live){await document.loadingTask.destroy();return}if(document.numPages>100)throw Error('Preview supports PDFs up to 100 pages. Download this PDF to review it.');setPdf(document)}
    else throw Error('Pin feedback supports PNG, JPEG, WebP and PDF. Download other formats to review them.')
    if(live)setPins(list)
   }catch(e){if(live)setMessage(e instanceof Error?e.message:'Unable to open feedback. Apply migrations/0006_beta_annotations.sql in Supabase, then try again.')}
   finally{if(live)setLoading(false)}
  })()
  return()=>{live=false;if(url)URL.revokeObjectURL(url);if(document)void document.loadingTask.destroy().catch(()=>{});else if(task)void task.destroy().catch(()=>{})}
 },[open,fileId,versionId,blobKey])
 useEffect(()=>{
  if(!pdf)return
  let live=true,render:RenderTask|undefined;setPageImage('');setReady(false);setDraft(null)
  void (async()=>{try{const item=await pdf.getPage(page);if(!live)return;const natural=item.getViewport({scale:1}),viewport=item.getViewport({scale:Math.min(1.6,1400/natural.width,1800/natural.height)});const canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);render=item.render({canvas,canvasContext:canvas.getContext('2d')!,viewport});await render.promise;if(live)setPageImage(canvas.toDataURL('image/jpeg',.85));item.cleanup()}catch{if(live)setMessage('This PDF page could not be displayed. Download the file to review it.')}})()
  return()=>{live=false;render?.cancel()}
 },[pdf,page])
 async function save(){if(!draft||!body.trim()||busy)return;setBusy(true);setMessage('');try{const {error}=await supabase().rpc('beta_add_annotation',{p_studio:BETA_STUDIO_ID,p_file:fileId,p_version:versionId,p_page:page,p_x:draft.x,p_y:draft.y,p_body:body.trim()});if(error){setMessage(error.message);return}setDraft(null);setBody('');setMessage('Feedback saved on this version.');setPins(await loadPins())}catch{setMessage('Unable to save feedback. Your draft is kept here.')}finally{setBusy(false)}}
 async function resolve(pin:Pin){setBusy(true);try{const {error}=await supabase().rpc('beta_resolve_annotation',{p_pin:pin.id,p_resolved:!pin.resolved});if(error){setMessage(error.message);return}setPins(await loadPins())}catch{setMessage('Unable to update feedback.')}finally{setBusy(false)}}
 const visible=pins.filter(pin=>pin.page===page),preview=image||pageImage
 return <div className="beta-annotations"><button aria-expanded={open} disabled={busy||!!body.trim()} onClick={()=>setOpen(!open)}>{open?'Close design feedback':'Open design & pin feedback →'}</button><div className="beta-annotation-panel" data-open={open} aria-hidden={!open} inert={!open}><div>
 <div className="beta-annotation-heading"><h4>{name}</h4><small>Version {versionId}{readOnly?' / Read only':''}</small></div>
 {loading&&<p role="status">Opening your private file…</p>}
 {pdf&&<nav aria-label="PDF pages"><button disabled={page===1||busy||!!body.trim()} onClick={()=>setPage(p=>p-1)}>Previous page</button><span>Page {page} / {pdf.numPages}</span><button disabled={page===pdf.numPages||busy||!!body.trim()} onClick={()=>setPage(p=>p+1)}>Next page</button></nav>}
 {preview&&<><div className="beta-pin-toolbar">{!readOnly&&<button disabled={!ready||busy} onClick={()=>{setDraft({x:.5,y:.5});setSelected('');requestAnimationFrame(()=>surface.current?.focus())}}>Add a pin</button>}{draft&&<span>Click the design or use arrow keys to position your pin. Shift moves faster.</span>}</div><div className="beta-pin-surface" ref={surface} tabIndex={draft?0:-1} aria-label="Feedback position. Arrow keys move the draft pin. Escape cancels." onClick={e=>{if(!draft||busy)return;const r=e.currentTarget.getBoundingClientRect();setDraft({x:clamp((e.clientX-r.left)/r.width),y:clamp((e.clientY-r.top)/r.height)});textarea.current?.focus({preventScroll:true})}} onKeyDown={e=>{if(e.target!==e.currentTarget||!draft||busy)return;if(e.key==='Escape'){setDraft(null);return}if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const step=e.shiftKey ? .1 : .01;setDraft({x:clamp(draft.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0)),y:clamp(draft.y+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0))})}}>
 <img src={preview} alt={`${name}, version ${versionId}${pdf?`, page ${page}`:''}`} onLoad={()=>setReady(true)} onError={()=>{setReady(false);setMessage('Preview unavailable. Download the file to review it.')}}/>
 {visible.map(pin=><button key={pin.id} className="beta-pin" data-resolved={pin.resolved} data-selected={pin.id===selected} style={{left:`${pin.x*100}%`,top:`${pin.y*100}%`}} aria-label={`Feedback ${pins.indexOf(pin)+1}: ${pin.body}`} aria-pressed={pin.id===selected} disabled={busy||!!body.trim()} onClick={e=>{e.stopPropagation();setSelected(pin.id);setDraft(null)}}>{pins.indexOf(pin)+1}</button>)}
 {draft&&<span className="beta-pin beta-pin-draft" style={{left:`${draft.x*100}%`,top:`${draft.y*100}%`}} aria-hidden="true">+</span>}
 </div></>}
 {draft&&<form className="beta-pin-draft-form" onSubmit={e=>{e.preventDefault();void save()}}><label>Feedback at {Math.round(draft.x*100)}% across, {Math.round(draft.y*100)}% down<textarea ref={textarea} required maxLength={2000} value={body} onChange={e=>setBody(e.target.value)} disabled={busy}/></label><button disabled={busy||!body.trim()}>Save feedback</button><button type="button" disabled={busy} onClick={()=>{setDraft(null);setBody('')}}>Cancel</button></form>}
 {!!pins.length&&<ol className="beta-pin-list">{pins.map((pin,i)=><li key={pin.id} data-selected={pin.id===selected}><button onClick={()=>{setPage(pin.page);setSelected(pin.id)}} disabled={busy||!!body.trim()}>#{i+1} / Page {pin.page}{pin.resolved?' / Resolved':''}</button><p>{pin.body}</p><small>{pin.author_label}</small>{staff&&<button disabled={busy} onClick={()=>resolve(pin)}>{pin.resolved?'Reopen':'Mark resolved'}</button>}</li>)}</ol>}
 <p role="status">{message}</p>
 </div></div></div>
}
