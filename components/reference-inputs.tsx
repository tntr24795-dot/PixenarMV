"use client";
import { ChangeEvent, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ReferenceAsset = {
  id: string;
  scene_id: string;
  kind: "reference_image" | "reference_video" | "reference_audio";
  storage_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  duration_seconds: number | null;
};

function mediaDuration(file: File) {
  if (!file.type.startsWith("video/") && !file.type.startsWith("audio/")) return Promise.resolve<number | null>(null);
  return new Promise<number | null>((resolve, reject) => {
    const url=URL.createObjectURL(file);
    const media=document.createElement(file.type.startsWith("video/") ? "video" : "audio");
    media.preload="metadata";
    media.onloadedmetadata=()=>{
      const value=media.duration;
      URL.revokeObjectURL(url);
      Number.isFinite(value) ? resolve(value) : resolve(null);
    };
    media.onerror=()=>{ URL.revokeObjectURL(url); reject(new Error("Unable to read reference duration.")); };
    media.src=url;
  });
}

export default function ReferenceInputs({
  projectId,
  sceneId,
  modelId,
  assets,
  onChange,
}:{
  projectId?:string;
  sceneId?:string;
  modelId:string;
  assets:ReferenceAsset[];
  onChange:(assets:ReferenceAsset[])=>void;
}) {
  const [uploading,setUploading]=useState(false);
  const [message,setMessage]=useState("");
  const sceneAssets=useMemo(()=>assets.filter(a=>a.scene_id===sceneId),[assets,sceneId]);
  const enabled=modelId==="grok-imagine-1-5" || modelId==="seedance-2-5";
  const accept=modelId==="grok-imagine-1-5"
    ? "image/jpeg,image/png,image/webp,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/flac"
    : "image/jpeg,image/png,image/webp,video/mp4,video/quicktime,audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/flac";

  if(!enabled) return null;

  async function upload(event:ChangeEvent<HTMLInputElement>) {
    const file=event.target.files?.[0];
    event.target.value="";
    if(!file || !projectId || !sceneId) {
      setMessage("Save the project and scene before adding a reference.");
      return;
    }
    const type=file.type.startsWith("image/") ? "reference_image" : file.type.startsWith("video/") ? "reference_video" : file.type.startsWith("audio/") ? "reference_audio" : null;
    if(!type) { setMessage("Choose an image, video or audio reference."); return; }
    if(modelId==="grok-imagine-1-5" && type==="reference_video") { setMessage("Grok Imagine 1.5 does not accept video references."); return; }

    const sameType=sceneAssets.filter(a=>a.kind===type);
    if(modelId==="grok-imagine-1-5" && type==="reference_image" && sameType.length>=7) { setMessage("Grok supports up to 7 image references."); return; }
    if(modelId==="grok-imagine-1-5" && type==="reference_audio" && sameType.length>=3) { setMessage("Grok supports up to 3 audio references."); return; }
    if(modelId==="seedance-2-5" && type==="reference_image" && sameType.length>=30) { setMessage("Seedance 2.5 supports up to 30 image references."); return; }
    if(modelId==="seedance-2-5" && type==="reference_video" && sameType.length>=10) { setMessage("Seedance 2.5 supports up to 10 video references."); return; }
    if(modelId==="seedance-2-5" && type==="reference_audio" && sameType.length>=10) { setMessage("Seedance 2.5 supports up to 10 audio references."); return; }

    setUploading(true); setMessage("Uploading private reference…");
    try {
      const duration=await mediaDuration(file);
      if(modelId==="grok-imagine-1-5" && type==="reference_audio" && (duration===null || duration<3 || duration>15))
        throw new Error("Grok audio references must be 3–15 seconds.");
      const nextVideoSeconds=sceneAssets.filter(a=>a.kind==="reference_video").reduce((s,a)=>s+Number(a.duration_seconds||0),0)+(type==="reference_video" ? Number(duration||0) : 0);
      const nextAudioSeconds=sceneAssets.filter(a=>a.kind==="reference_audio").reduce((s,a)=>s+Number(a.duration_seconds||0),0)+(type==="reference_audio" ? Number(duration||0) : 0);
      if(modelId==="seedance-2-5" && nextVideoSeconds+nextAudioSeconds>=30)
        throw new Error("Seedance 2.5 video + audio references must total less than 30 seconds.");

      const supabase=createClient();
      const {data:{user}}=await supabase.auth.getUser();
      if(!user) throw new Error("Please sign in again.");
      const safe=file.name.replace(/[^a-zA-Z0-9._-]/g,"-");
      const path=`${user.id}/${projectId}/references/${sceneId}/${crypto.randomUUID()}-${safe}`;
      const {error:uploadError}=await supabase.storage.from("source-media").upload(path,file,{contentType:file.type,upsert:false});
      if(uploadError) throw uploadError;
      const {data,error}=await supabase.from("project_assets").insert({
        project_id:projectId,user_id:user.id,scene_id:sceneId,kind:type,
        storage_path:path,mime_type:file.type,size_bytes:file.size,duration_seconds:duration,
      }).select("id,scene_id,kind,storage_path,mime_type,size_bytes,duration_seconds").single();
      if(error) {
        await supabase.storage.from("source-media").remove([path]);
        throw error;
      }
      onChange([...assets,data as ReferenceAsset]);
      setMessage("Reference ready. Estimated credits updated.");
    } catch(error) {
      setMessage(error instanceof Error ? error.message : "Reference upload failed.");
    } finally { setUploading(false); }
  }

  async function remove(asset:ReferenceAsset) {
    const supabase=createClient();
    const {error}=await supabase.from("project_assets").delete().eq("id",asset.id);
    if(error){ setMessage(error.message); return; }
    await supabase.storage.from("source-media").remove([asset.storage_path]);
    onChange(assets.filter(a=>a.id!==asset.id));
    setMessage("Reference removed.");
  }

  return <div className="referencePanel">
    <div className="referenceHead">
      <b>Generation references</b>
      <small>{modelId==="grok-imagine-1-5" ? "Grok · image + audio" : "Seedance 2.5 · image + video + audio"}</small>
    </div>
    <label className={`referenceUpload ${uploading ? "disabled" : ""}`}>
      <span>＋</span>
      <div><b>{uploading ? "Uploading…" : "Add reference"}</b><small>Private · priced before generation</small></div>
      <input hidden disabled={uploading || !projectId || !sceneId} type="file" accept={accept} onChange={upload}/>
    </label>
    {sceneAssets.length ? <div className="referenceList">
      {sceneAssets.map(asset=><div className="referenceItem" key={asset.id}>
        <span>{asset.kind==="reference_image" ? "IMG" : asset.kind==="reference_video" ? "VID" : "AUD"}</span>
        <small>{asset.kind.replace("reference_","")}{asset.duration_seconds ? ` · ${Number(asset.duration_seconds).toFixed(1)}s` : ""}</small>
        <button type="button" onClick={()=>remove(asset)}>Remove</button>
      </div>)}
    </div> : null}
    {message ? <small className="referenceMessage">{message}</small> : null}
  </div>;
}
