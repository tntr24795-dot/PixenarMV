import "server-only";
import { supabaseUrl } from "@/lib/supabase/config";
import type { ProviderState } from "./video";

export async function persistProviderOutput(userId: string, generationId: string, state: ProviderState) {
  const maxBytes = 1024 * 1024 * 1024;
  let mimeType: string;
  let body: BodyInit;
  if (state.outputBase64) {
    mimeType = state.outputMediaType || "video/mp4";
    if (!["video/mp4", "video/quicktime"].includes(mimeType)) throw new Error("Unsupported provider video format.");
    if (state.outputBase64.length > Math.ceil(maxBytes * 4 / 3)) throw new Error("Provider output exceeds the 1 GB limit.");
    const bytes = Buffer.from(state.outputBase64, "base64");
    if (!bytes.length || bytes.length > maxBytes) throw new Error("Invalid provider video output.");
    body = new Uint8Array(bytes);
  } else {
    if (!state.outputUrl) throw new Error("Provider completed without video output.");
    const url = new URL(state.outputUrl);
    if (url.protocol !== "https:") throw new Error("Provider returned an unsafe output URL.");
    const output = await fetch(url, { redirect: "follow" });
    if (!output.ok || !output.body) throw new Error("Unable to download provider output.");
    const length = Number(output.headers.get("content-length") ?? 0);
    if (length > maxBytes) throw new Error("Provider output exceeds the 1 GB limit.");
    mimeType = output.headers.get("content-type")?.split(";")[0] || "video/mp4";
    body = output.body;
  }
  const extension = mimeType === "video/quicktime" ? "mov" : "mp4";
  const path = `${userId}/${generationId}/final.${extension}`;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured.");
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const upload = await fetch(`${supabaseUrl}/storage/v1/object/generated-media/${encodedPath}`, {
    method: "POST",
    headers: { apikey: secret, authorization: `Bearer ${secret}`, "content-type": mimeType, "x-upsert": "true" },
    body, duplex: "half",
  } as RequestInit & { duplex: "half" });
  if (!upload.ok) throw new Error(`Private output upload failed (${upload.status}).`);
  return { path, mimeType };
}
