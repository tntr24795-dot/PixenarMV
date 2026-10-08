"use client";
import {useState} from "react";
import {estimateLongDrama,longDramaSegments} from "@/lib/long-drama";
import {videoModels} from "@/lib/models";
const models=videoModels.filter(m=>m.available&&m.resolutions?.length);
export default function LongDramaEstimator(){
 const [minutes,setMinutes]=useState(30);
 const [modelId,setModelId]=useState("wan-3-0");
 const [resolution,setResolution]=useState("480p");
 const model=models.find(m=>m.id===modelId);
 const quote=estimateLongDrama(minutes,modelId,resolution);
 const credits=quote.estimatedVideoCredits;
 const segments=longDramaSegments(minutes);
 return <section style={{maxWidth:850,margin:"auto",padding:32,color:"white"}}>
 <h1>AI Long Drama — up to 1 hour</h1><p>Estimate credits for 30–60 minutes. To plan two hours, calculate two 60-minute projects.</p>
 <p role="status" style={{border:"1px solid orange",padding:16}}>In development: full-length generation and export are NOT yet verified. This estimate does not charge credits.</p>
 <label htmlFor="minutes">Length: {minutes} minutes</label>
 <input style={{display:"block",width:"100%"}} id="minutes" type="range" min="30" max="60" step="5" value={minutes} onChange={e=>setMinutes(Number(e.target.value))}/>
 <label htmlFor="model">Model</label>
 <select id="model" value={modelId} onChange={e=>{const m=models.find(x=>x.id===e.target.value)!;setModelId(m.id);setResolution(m.resolutions![0]);}} style={{display:"block",padding:12,color:"black"}}>{models.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select>
 <label htmlFor="resolution">Resolution</label><select id="resolution" value={resolution} onChange={e=>setResolution(e.target.value)} style={{display:"block",padding:12,color:"black"}}>{model?.resolutions?.map(r=><option key={r}>{r}</option>)}</select>
 <div aria-live="polite"><h2>{credits.toLocaleString()} credits</h2><p>{quote.clipCount} generated clips estimated · {segments.length} manageable 5-minute segments</p></div>
 <h3>Credits by duration</h3><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>{[30,35,40,45,50,55,60].map(n=><div key={n} style={{padding:12,background:"#27272a",borderRadius:8}}><strong>{n} min</strong><div>{estimateLongDrama(n,modelId,resolution).estimatedVideoCredits.toLocaleString()} credits</div></div>)}</div><p>Credits for video only; extra generations, audio, references and export are not included. Final quote may change when full production is enabled.</p>
 <button disabled style={{padding:16,opacity:.6}}>Generate Long Drama — not available yet</button>
 </section>;
}