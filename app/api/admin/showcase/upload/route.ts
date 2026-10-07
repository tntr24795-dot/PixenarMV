import { NextResponse } from "next/server";
import { authenticatedClient } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedTypes = new Set([
  "video/mp4",
  "video/webm",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

async function requireAdmin() {
  const { supabase, userId } = await authenticatedClient();
  if (!userId) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access required." }, { status: 403 }) };
  }
  return { userId };
}

function safeName(name: string) {
  const cleaned = name
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned.slice(0, 120) || "asset";
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;

  const form = await request.formData();
  const file = form.get("file");
  const slug = String(form.get("slug") ?? "").trim().toLowerCase();
  const kind = String(form.get("kind") ?? "video");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Select a file to upload." }, { status: 400 });
  }
  if (!/^[a-z0-9-]{3,80}$/.test(slug)) {
    return NextResponse.json({ error: "A valid showcase slug is required." }, { status: 400 });
  }
  if (!allowedTypes.has(file.type)) {
    return NextResponse.json({ error: "Unsupported showcase media type." }, { status: 415 });
  }
  if (file.size > 200 * 1024 * 1024) {
    return NextResponse.json({ error: "Showcase media must be 200 MB or smaller." }, { status: 413 });
  }

  const ext = safeName(file.name).split(".").pop() || (file.type.startsWith("video/") ? "mp4" : "webp");
  const folder = kind === "thumbnail" ? "thumbnails" : "videos";
  const path = `${folder}/${slug}-${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error } = await createAdminClient().storage
    .from("showcase-media")
    .upload(path, bytes, {
      contentType: file.type,
      upsert: false,
      cacheControl: "31536000",
    });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    path,
    kind,
    sizeBytes: file.size,
    mimeType: file.type,
  }, { status: 201 });
}
