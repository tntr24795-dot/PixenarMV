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

function safeBase(name: string) {
  return name
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "showcase";
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return auth.error;
  const body = await readJson(request);
  const slug = String(body?.slug ?? "").trim().toLowerCase();
  const kind = String(body?.kind ?? "video");
  const fileName = String(body?.fileName ?? "");
  const mimeType = String(body?.mimeType ?? "");
  const sizeBytes = Number(body?.sizeBytes ?? 0);

  if (!/^[a-z0-9-]{3,80}$/.test(slug)) {
    return NextResponse.json({ error: "A valid showcase slug is required." }, { status: 400 });
  }

  const allowedVideo = ["video/mp4", "video/webm"];
  const allowedImage = ["image/jpeg", "image/png", "image/webp"];
  const allowed = kind === "thumbnail" ? allowedImage : allowedVideo;
  if (!allowed.includes(mimeType)) {
    return NextResponse.json({ error: "Unsupported showcase media type." }, { status: 415 });
  }

  const maxBytes = kind === "thumbnail" ? 15 * 1024 * 1024 : 200 * 1024 * 1024;
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxBytes) {
    return NextResponse.json({ error: "Showcase media exceeds the upload limit." }, { status: 413 });
  }

  const extension =
    mimeType === "video/webm" ? "webm" :
    mimeType === "image/jpeg" ? "jpg" :
    mimeType === "image/png" ? "png" :
    mimeType === "image/webp" ? "webp" : "mp4";
  const folder = kind === "thumbnail" ? "thumbnails" : "videos";
  const path = `${folder}/${slug}-${Date.now()}-${safeBase(fileName)}.${extension}`;

  const { data, error } = await createAdminClient().storage
    .from("showcase-media")
    .createSignedUploadUrl(path);
  if (error || !data?.token) {
    return NextResponse.json({ error: error?.message ?? "Unable to create upload URL." }, { status: 400 });
  }

  return NextResponse.json({ path, token: data.token, mimeType, sizeBytes });
}
