import { NextResponse } from "next/server";
import { authenticatedClient, readJson } from "@/lib/api/auth";

export async function GET() {
  const { supabase, userId } = await authenticatedClient();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase
    .from("characters")
    .select("id,name,role,description,identity_lock,wardrobe_lock,created_at")
    .order("updated_at", { ascending: false });
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ characters: data });
}
export async function POST(request: Request) {
  const body = await readJson(request);
  const name = String(body?.name ?? "").trim();
  if (!name || name.length > 80)
    return NextResponse.json(
      { error: "Character name must be 1–80 characters." },
      { status: 400 },
    );
  const { supabase, userId } = await authenticatedClient();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase
    .from("characters")
    .insert({
      user_id: userId,
      name,
      role: String(body?.role ?? "").slice(0, 80) || null,
      description: String(body?.description ?? "").slice(0, 1000) || null,
      identity_lock: {
        enabled: true,
        notes: String(body?.identityNotes ?? "").slice(0, 1000),
      },
      wardrobe_lock: {
        enabled: true,
        notes: String(body?.wardrobeNotes ?? "").slice(0, 1000),
      },
    })
    .select("id,name,role,description,identity_lock,wardrobe_lock,created_at")
    .single();
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json(data, { status: 201 });
}
export async function DELETE(request: Request) {
  const body = await readJson(request);
  const id = String(body?.id ?? "");
  const { supabase, userId } = await authenticatedClient();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error } = await supabase.from("characters").delete().eq("id", id);
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ deleted: true });
}
