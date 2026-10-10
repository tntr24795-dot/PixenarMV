"use client";
import {useState} from "react";
import {estimateLongDrama,longDramaSegments} from "@/lib/long-drama";
import {videoModels} from "@/lib/models";
const models=videoModels.filter(m=>m.available&&m.resolutions?.length);
export default function LongDramaEstimator(){
 const [minutes,setMinutes]=useState(30);
 const [modelId,setModelId]=useState("wan-3-0");
 const [resolution,setResolution]=useState("480p");
 const [premise,setPremise]=useState("");
 const [outline,setOutline]=useState<{chapters:{title:string;durationSeconds:number;narrativeGoal:string}[]} | null>(null);
 const [outlineError,setOutlineError]=useState("");
 const [busy,setBusy]=useState(false);
 async function previewOutline(){
  setBusy(true);setOutlineError("");setOutline(null);
  try{
   const response=await fetch("/api/long-drama/outline",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({premise,minutes,modelId,resolution})});
   const result=await response.json();
   if(!response.ok) throw new Error(result.error||"Unable to create outline");
   setOutline(result);
  }catch(error){setOutlineError(error instanceof Error?error.message:"Outline preview failed");}
  finally{setBusy(false);}
 }
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
 <label htmlFor="premise">Drama premise (40–6,000 characters)</label>
 <textarea id="premise" rows={5} maxLength={6000} value={premise} onChange={e=>{setPremise(e.target.value);setOutline(null);}} style={{display:"block",width:"100%",padding:12,color:"#111827"}} placeholder="Describe your drama, characters and central conflict..." />
 <button type="button" disabled={busy||premise.trim().length<40} onClick={previewOutline} style={{padding:16}}> {busy?"Planning…":"Preview chapter outline — no credits charged"} </button>
 {outlineError&&<p role="alert">{outlineError}</p>}
 {outline&&<div><h3>Chapter outline preview ({outline.chapters.length} chapters)</h3>{outline.chapters.map((chapter,i)=><div key={i} style={{marginBottom:10,border:"1px solid #444",padding:12}}><strong>{chapter.title}</strong><p>{chapter.durationSeconds/60} minutes — {chapter.narrativeGoal}</p></div>)}<p>Planning only. No scenes, media or export have been generated.</p></div>}
 <button disabled style={{padding:16,opacity:.6}}>Generate Long Drama — not available yet</button>
 </section>;
}