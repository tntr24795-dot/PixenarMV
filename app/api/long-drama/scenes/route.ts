import {NextResponse} from "next/server";
import {authenticatedClient,readJson} from "@/lib/api/auth";
import {createAdminClient,hasAdminConfiguration} from "@/lib/supabase/admin";
import {inspectProduction,type ProductionManifest} from "@/lib/long-drama-progress";
import {videoModels} from "@/lib/models";
export async function POST(request:Request){
 const {supabase,userId}=await authenticatedClient();
 if(!userId)return NextResponse.json({error:"Unauthorized"},{status:401});
 if(!hasAdminConfiguration())return NextResponse.json({error:"Server not configured"},{status:503});
 const body=await readJson(request);const projectId=String(body?.projectId??"");
 const {data:project}=await supabase.from("projects").select("id,kind").eq("id",projectId).eq("user_id",userId).maybeSingle();
 if(!project||project.kind!=="short_film")return NextResponse.json({error:"Owned drama project required"},{status:403});
 const admin=createAdminClient();
 const {data:stored}=await admin.from("long_drama_manifests").select("manifest").eq("project_id",projectId).eq("user_id",userId).maybeSingle();
 if(!stored)return NextResponse.json({error:"Manifest missing"},{status:404});
 const manifest=stored.manifest as ProductionManifest & {outline?:{modelId:string;resolution:string;premise:string}};
 try{inspectProduction(manifest)}catch{return NextResponse.json({error:"Invalid timeline"},{status:409})}
 const model=videoModels.find(m=>m.id===manifest.outline?.modelId&&m.available);
 if(!model||!model.resolutions?.includes(manifest.outline?.resolution)||manifest.shots.some(s=>!model.durations.includes(s.durationSeconds)))return NextResponse.json({error:"Unsupported shot durations; review plan before materialization"},{status:409});
 const [{count:g},{count:sc}]=await Promise.all([
 admin.from("generations").select("id",{count:"exact",head:true}).eq("project_id",projectId),
 admin.from("scenes").select("id",{count:"exact",head:true}).eq("project_id",projectId)]);
 if(g||sc)return NextResponse.json({error:"Scenes or render history already exist; refusing duplicate creation"},{status:409});
 const rows=manifest.shots.map(shot=>({project_id:projectId,user_id:userId,position:shot.position,start_seconds:shot.startSeconds,duration_seconds:shot.durationSeconds,title:`Shot ${shot.position+1}`,section_name:`Chapter ${shot.chapterIndex+1}`,prompt:`Production placeholder; EDIT BEFORE RENDER. ${manifest.outline?.premise?.slice(0,850)??""}`,model:model.id,resolution:manifest.outline!.resolution,status:"queued",continuity:{longDrama:true,shotId:shot.id,chapterIndex:shot.chapterIndex,needsEditorialApproval:true}}));
 const {error}=await admin.from("scenes").insert(rows);
 if(error)return NextResponse.json({error:error.message},{status:409});
 const {error:updateError}=await admin.from("projects").update({storyboard:{source:"long-drama",rendering_enabled:false,shot_count:rows.length},duration_seconds:manifest.targetSeconds,status:"storyboarding"}).eq("id",projectId).eq("user_id",userId);
 if(updateError)return NextResponse.json({error:"Scene records saved, project metadata needs reconciliation"},{status:500});
 return NextResponse.json({status:"scenes_saved",count:rows.length,renderingEnabled:false},{status:201});
}