import { createClient } from "@/lib/supabase/server";

export async function authenticatedClient(){
  const supabase=await createClient();
  const {data,error}=await supabase.auth.getClaims();
  const userId=data?.claims?.sub as string|undefined;
  return {supabase,userId,error};
}

export async function readJson(request:Request){
  try{return await request.json() as Record<string,unknown>;}catch{return null;}
}
