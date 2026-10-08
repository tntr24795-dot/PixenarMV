import { NextResponse } from "next/server";
import { authenticatedClient, readJson } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";

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

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const { data, error } = await createAdminClient()
    .from("showcase_videos")
    .select("*")
    .order("featured_order", { ascending: true })
    .order("created_at", { ascending: false });
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  const slug = String(body?.slug ?? "").trim().toLowerCase();
  const title = String(body?.title ?? "").trim();
  const prompt = String(body?.prompt ?? "").trim();
  if (!/^[a-z0-9-]{3,80}$/.test(slug) || !title || !prompt) {
    return NextResponse.json(
      { error: "Slug, title and prompt are required." },
      { status: 400 },
    );
  }
  const payload = {
    slug,
    title: title.slice(0, 120),
    category: String(body?.category ?? "Showcase").slice(0, 80),
    description: String(body?.description ?? "").slice(0, 500),
    prompt: prompt.slice(0, 6000),
    style: String(body?.style ?? "cinematic-realism").slice(0, 80),
    aspect_ratio: body?.aspectRatio === "9:16" ? "9:16" : "16:9",
    duration_seconds: Math.max(2, Math.min(600, Number(body?.durationSeconds ?? 8))),
    model_id: String(body?.modelId ?? "wan-3-0").slice(0, 100),
    video_path: String(body?.videoPath ?? "").trim() || null,
    thumbnail_path: String(body?.thumbnailPath ?? "").trim() || null,
    is_featured: body?.isFeatured !== false,
    published: body?.published === true && Boolean(String(body?.videoPath ?? "").trim()),
    featured_order: Math.max(0, Number(body?.featuredOrder ?? 0)),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await createAdminClient()
    .from("showcase_videos")
    .insert(payload)
    .select("*")
    .single();
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ error: "Item id is required." }, { status: 400 });
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("showcase_videos")
    .select("video_path")
    .eq("id", id)
    .maybeSingle();
  if (currentError || !current) {
    return NextResponse.json({ error: currentError?.message ?? "Showcase item not found." }, { status: 404 });
  }
  const nextVideoPath =
    body?.videoPath !== undefined ? String(body.videoPath).trim() || null : current.video_path;
  if (body?.published === true && !nextVideoPath) {
    return NextResponse.json(
      { error: "Upload a showcase video before publishing this item." },
      { status: 400 },
    );
  }

  const values: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body?.title !== undefined) values.title = String(body.title).slice(0, 120);
  if (body?.category !== undefined) values.category = String(body.category).slice(0, 80);
  if (body?.description !== undefined) values.description = String(body.description).slice(0, 500);
  if (body?.prompt !== undefined) values.prompt = String(body.prompt).slice(0, 6000);
  if (body?.style !== undefined) values.style = String(body.style).slice(0, 80);
  if (body?.aspectRatio !== undefined) values.aspect_ratio = body.aspectRatio === "9:16" ? "9:16" : "16:9";
  if (body?.durationSeconds !== undefined) values.duration_seconds = Math.max(2, Math.min(600, Number(body.durationSeconds)));
  if (body?.modelId !== undefined) values.model_id = String(body.modelId).slice(0, 100);
  if (body?.videoPath !== undefined) values.video_path = String(body.videoPath).trim() || null;
  if (body?.thumbnailPath !== undefined) values.thumbnail_path = String(body.thumbnailPath).trim() || null;
  if (body?.isFeatured !== undefined) values.is_featured = Boolean(body.isFeatured);
  if (body?.published !== undefined) values.published = Boolean(body.published);
  if (body?.featuredOrder !== undefined) values.featured_order = Math.max(0, Number(body.featuredOrder));
  const { data, error } = await createAdminClient()
    .from("showcase_videos")
    .update(values)
    .eq("id", id)
    .select("*")
    .single();
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json(data);
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  const id = String(body?.id ?? "");
  if (!id) return NextResponse.json({ error: "Item id is required." }, { status: 400 });
  const { error } = await createAdminClient().from("showcase_videos").delete().eq("id", id);
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ deleted: true });
}
