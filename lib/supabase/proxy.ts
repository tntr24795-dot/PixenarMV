import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabasePublishableKey, supabaseUrl } from "./config";

export async function updateSession(request:NextRequest){
  let response=NextResponse.next({request});
  const supabase=createServerClient(supabaseUrl,supabasePublishableKey,{cookies:{
    getAll:()=>request.cookies.getAll(),
    setAll(items){items.forEach(({name,value})=>request.cookies.set(name,value));response=NextResponse.next({request});items.forEach(({name,value,options})=>response.cookies.set(name,value,options));}
  }});
  const {data}=await supabase.auth.getClaims();
  const signedIn=Boolean(data?.claims?.sub);
  const protectedPath=["/studio","/create","/characters","/renders"].some(path=>request.nextUrl.pathname.startsWith(path));
  if(protectedPath&&!signedIn){const url=request.nextUrl.clone();url.pathname="/login";url.searchParams.set("next",request.nextUrl.pathname+request.nextUrl.search);return NextResponse.redirect(url);}
  if(request.nextUrl.pathname==="/login"&&signedIn){const url=request.nextUrl.clone();url.pathname="/studio";url.search="";return NextResponse.redirect(url);}
  return response;
}
