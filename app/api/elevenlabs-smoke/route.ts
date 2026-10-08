import { NextResponse } from "next/server";

export async function GET() {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({configured:false,ok:false,status:0});
  try {
    const response = await fetch("https://api.elevenlabs.io/v2/voices?page_size=1&include_total_count=false", {
      headers: { "xi-api-key": key },
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    return NextResponse.json({configured:true,ok:response.ok,status:response.status});
  } catch {
    return NextResponse.json({configured:true,ok:false,status:0});
  }
}
