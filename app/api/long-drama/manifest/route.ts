import {NextResponse} from "next/server";
import {authenticatedClient,readJson} from "@/lib/api/auth";
import {createAdminClient,hasAdminConfiguration} from "@/lib/supabase/admin";
import {createLongDramaOutline} from "@/lib/long-drama-outline";
import {createShotManifest,inspectProduction} from "@/lib/long-drama-progress";
import {videoModels} from "@/lib/models";
export const dynamic="force-dynamic";

export async function GET(request:Request){
 const {supabase,userId}=await authenticatedClient();
 if(!userId) return NextResponse.json({error:"Unauthorized"},{status:401});
 const projectId=new URL(request.url).searchParams.get("projectId");
 if(!projectId) return NextResponse.json({error:"Project ID required"},{status:400});
 const {data,error}=await supabase.from("long_drama_manifests").select("manifest,updated_at").eq("project_id",projectId).maybeSingle();
 if(error) return NextResponse.json({error:error.message},{status:400});
 if(!data)return NextResponse.json({error:"Manifest not found"},{status:404});
 return NextResponse.json({manifest:data.manifest,updatedAt:data.updated_at,progress:inspectProduction(data.manifest)},{headers:{"Cache-Control":"private, no-store"}});
}

export async function POST(request:Request){
 const {supabase,userId}=await authenticatedClient();
 if(!userId)return NextResponse.json({error:"Unauthorized"},{status:401});
 if(!hasAdminConfiguration())return NextResponse.json({error:"Persistence not configured"},{status:503});
 try{
  const body=await readJson(request);
  const projectId=String(body?.projectId??"");
  const {data:project,error:projectError}=await supabase.from("projects").select("id,kind").eq("id",projectId).eq("user_id",userId).single();
  if(projectError||!project||project.kind!=="short_film") return NextResponse.json({error:"Owned drama project required"},{status:403});
  const {count,error:genError}=await supabase.from("generations").select("id",{count:"exact",head:true}).eq("project_id",projectId);
  if(genError)return NextResponse.json({error:genError.message},{status:400});
  if(count) return NextResponse.json({error:"Cannot replace an already rendered project"},{status:409});
  const outline=createLongDramaOutline({minutes:Number(body?.minutes),premise:String(body?.premise??""),modelId:String(body?.modelId??""),resolution:String(body?.resolution??"")});
  const model=videoModels.find(item=>item.id===outline.modelId && item.available);
  if(!model) return NextResponse.json({error:"Model unavailable"},{status:400});
  const manifest=createShotManifest(projectId,outline.chapters,Math.max(...model.durations));
  const admin=createAdminClient();
  // INSERT-only: concurrent attempts cannot overwrite or reset existing progress.
  const {error}=await admin.from("long_drama_manifests").insert({project_id:projectId,user_id:userId,manifest:{...manifest,outline,stage:"planning_only"}});
  if(error){
   if(error.code==="23505")return NextResponse.json({error:"Manifest already exists. Load it instead of restarting production."},{status:409});
   return NextResponse.json({error:error.message},{status:400});
  }
  return NextResponse.json({status:"saved",projectId,shotCount:manifest.shots.length,progress:inspectProduction(manifest),renderingEnabled:false},{status:201});
 }catch(error){return NextResponse.json({error:error instanceof Error?error.message:"Unable to save plan"},{status:400});}
}
