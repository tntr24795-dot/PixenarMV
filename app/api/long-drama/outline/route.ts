import {NextResponse} from "next/server";
import {authenticatedClient,readJson} from "@/lib/api/auth";
import {createLongDramaOutline} from "@/lib/long-drama-outline";
export async function POST(request:Request){
 const {userId}=await authenticatedClient();
 if(!userId) return NextResponse.json({error:"Unauthorized"},{status:401});
 try {
  const body=await readJson(request);
  const result=createLongDramaOutline({minutes:Number(body?.minutes),premise:String(body?.premise??""),modelId:String(body?.modelId??""),resolution:String(body?.resolution??"")});
  return NextResponse.json(result,{headers:{"Cache-Control":"private, no-store"}});
 } catch(error){
  return NextResponse.json({error:error instanceof Error?error.message:"Invalid outline request"},{status:400});
 }
}
