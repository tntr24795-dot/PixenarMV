import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(){
  const supabase=await createClient(); const {data:claims}=await supabase.auth.getClaims(); if(!claims?.claims?.sub)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {data,error}=await supabase.from("projects").select("id,title,kind,status,updated_at,duration_seconds").order("updated_at",{ascending:false}).limit(12);
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json({projects:data});
}
export async function POST(request:NextRequest){
  const body = await request.json();
  if(!body?.title || !["film","music-video"].includes(body?.type)) return NextResponse.json({error:"A title and valid project type are required."},{status:400});
  const supabase=await createClient(); const {data:claims}=await supabase.auth.getClaims(); const userId=claims?.claims?.sub as string|undefined; if(!userId)return NextResponse.json({error:"Unauthorized"},{status:401});
  const {data,error}=await supabase.from("projects").insert({user_id:userId,title:String(body.title).slice(0,120),kind:body.type==="music-video"?"music_video":"short_film",concept:body.concept||null,aspect_ratio:body.aspectRatio||"16:9"}).select("id,title,kind,status,created_at").single();
  return error?NextResponse.json({error:error.message},{status:400}):NextResponse.json(data,{status:201});
}
