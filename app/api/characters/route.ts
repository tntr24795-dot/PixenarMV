import { NextResponse } from "next/server";
import { authenticatedClient, readJson } from "@/lib/api/auth";

export async function GET() {
  const { supabase, userId } = await authenticatedClient();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabase
    .from("characters")
    .select("id,name,role,description,identity_lock,wardrobe_lock,thumbnail_path,created_at")
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
  if (!id) return NextResponse.json({ error: "Character id is required." }, { status: 400 });

  const { supabase, userId } = await authenticatedClient();
  if (!userId)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: character, error: readError } = await supabase
    .from("characters")
    .select("id,reference_paths,thumbnail_path")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 400 });
  if (!character) return NextResponse.json({ error: "Character not found." }, { status: 404 });

  const paths = new Set<string>();
  if (Array.isArray(character.reference_paths)) {
    for (const path of character.reference_paths) {
      if (typeof path === "string" && path) paths.add(path);
    }
  }
  if (typeof character.thumbnail_path === "string" && character.thumbnail_path) {
    paths.add(character.thumbnail_path);
  }
  if (paths.size) {
    const { error: storageError } = await supabase.storage
      .from("source-media")
      .remove([...paths]);
    if (storageError) {
      return NextResponse.json(
        { error: `Unable to remove character media: ${storageError.message}` },
        { status: 400 },
      );
    }
  }

  const { error } = await supabase
    .from("characters")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ deleted: true });
}
