import {useEffect,useRef} from 'react'
import {initializeComparison} from '../../../src/comparison'
import '../../../src/comparison.css'
export default function ImageComparison({current,previous}:{current:string;previous:string}){
 const frame=useRef<HTMLDivElement>(null)
 useEffect(()=>{if(!frame.current)return;const control=initializeComparison(frame.current,{label:'Compare previously shared and current versions',valueText:value=>`${value}% previous version, ${100-value}% current version`});return()=>control.destroy()},[current,previous])
 return <><div className="beta-compare comparison" ref={frame} style={{'--comparison-fit':'contain'} as React.CSSProperties}><img src={current} alt="Current shared version" draggable={false}/><div className="comparison-overlay"><img src={previous} alt="Previously shared version" draggable={false}/></div><button type="button" className="comparison-handle" data-comparison-handle hidden><span className="comparison-grip" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="m8 7-5 5 5 5m8-10 5 5-5 5M3 12h18"/></svg></span></button><span className="beta-compare-previous">PREVIOUS</span><span className="beta-compare-current">CURRENT</span></div><p className="comparison-hint">Drag the divider. Use arrow keys for fine adjustment.</p></>
}
