import { NextResponse } from "next/server";
import { authenticatedClient, readJson } from "@/lib/api/auth";

export async function GET() {
  const { supabase, userId } = await authenticatedClient();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase
    .from("generations")
    .select(
      "id,project_id,scene_id,model,status,credits_reserved,credits_charged,error_message,created_at,completed_at,projects(title),scenes(title)",
    )
    .order("created_at", { ascending: false })
    .limit(50);
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ generations: data });
}
export async function DELETE(request: Request) {
  const body = await readJson(request);
  const id = String(body?.id ?? "");
  const { supabase, userId } = await authenticatedClient();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase.rpc("cancel_generation", {
    p_generation_id: id,
  });
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ cancelled: data });
}
