import { NextResponse } from "next/server";
import { authenticatedClient } from "@/lib/api/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { showcaseTemplates } from "@/lib/showcase";

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

export async function POST() {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const rows = showcaseTemplates.map((item, index) => ({
    slug: item.slug,
    title: item.title,
    category: item.category,
    description: item.description,
    prompt: item.prompt,
    style: item.style,
    aspect_ratio: item.aspectRatio,
    duration_seconds: item.durationSeconds,
    model_id: item.modelId,
    is_featured: true,
    published: false,
    featured_order: index + 1,
    updated_at: new Date().toISOString(),
  }));
  const { data, error } = await createAdminClient()
    .from("showcase_videos")
    .upsert(rows, { onConflict: "slug" })
    .select("id,slug");
  return error
    ? NextResponse.json({ error: error.message }, { status: 400 })
    : NextResponse.json({ imported: data?.length ?? 0 });
}
