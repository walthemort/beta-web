import {stat} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {pipeline} from 'node:stream';
export function byteRange(header,size){
 if(!header)return null;
 const match=/^bytes=(\d*)-(\d*)$/.exec(header);if(!match||(!match[1]&&!match[2])||size<=0)return false;
 if([match[1],match[2]].some(value=>value&&!Number.isSafeInteger(Number(value))))return false;
 let start=match[1]?Number(match[1]):Math.max(0,size-Number(match[2])),end=match[1]?(match[2]?Number(match[2]):size-1):size-1;
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>=size||end<start||(!match[1]&&Number(match[2])===0))return false;
 return{start,end:Math.min(end,size-1)};
}
/** Stream only files already validated by the public asset allowlist. */
export async function serveVideo(req,res,file){
 const info=await stat(file);if(!info.isFile())throw Error('Video not found');
 const modified=info.mtime.toUTCString(),useRange=!req.headers['if-range']||req.headers['if-range']===modified;
 const range=byteRange(useRange?req.headers.range:null,info.size);
 const headers={'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'public, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Last-Modified':modified};
 if(range===false){res.writeHead(416,{...headers,'Content-Range':`bytes */${info.size}`,'Content-Length':0});res.end();return}
 const start=range?.start??0,end=range?.end??info.size-1;
 if(range)headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;
 res.writeHead(range?206:200,{...headers,'Content-Length':end-start+1});
 if(req.method==='HEAD'||!info.size){res.end();return}
 pipeline(createReadStream(file,{start,end}),res,error=>{if(error&&!res.destroyed)res.destroy()});
}
