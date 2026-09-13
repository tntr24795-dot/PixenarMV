import { sleep } from "workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseUrl } from "@/lib/supabase/config";
import { inspectVideo, submitVideo } from "@/lib/providers/video";

type GenerationRecord = {
  id: string;
  user_id: string;
  model: string;
  request_payload: { prompt?: string; duration?: number };
  projects: { aspect_ratio: string; resolution: string } | null;
};

async function loadGeneration(generationId: string) {
  "use step";
  const { data, error } = await createAdminClient()
    .from("generations")
    .select("id,user_id,model,request_payload,projects(aspect_ratio,resolution)")
    .eq("id", generationId)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as GenerationRecord;
}

async function submitGeneration(generation: GenerationRecord) {
  "use step";
  const payload = generation.request_payload ?? {};
  const submitted = await submitVideo({
    generationId: generation.id,
    model: generation.model,
    prompt: String(payload.prompt ?? ""),
    duration: Number(payload.duration ?? 8),
    aspectRatio: generation.projects?.aspect_ratio ?? "16:9",
    resolution: generation.projects?.resolution ?? "720p",
  });
  const { error } = await createAdminClient().rpc("mark_generation_processing", {
    p_generation_id: generation.id,
    p_provider_task_id: submitted.taskId,
    p_provider_status: submitted.providerStatus,
  });
  if (error) throw new Error(error.message);
  return submitted.taskId;
}
submitGeneration.maxRetries = 2;

async function pollGeneration(generationId: string, taskId: string) {
  "use step";
  const state = await inspectVideo(taskId);
  if (state.status === "queued" || state.status === "processing") {
    const { error } = await createAdminClient().rpc("update_generation_progress", {
      p_generation_id: generationId,
      p_progress: state.progress,
      p_provider_status: state.providerStatus,
    });
    if (error) throw new Error(error.message);
  }
  return state;
}
pollGeneration.maxRetries = 4;

async function storeOutput(generation: GenerationRecord, outputUrl: string) {
  "use step";
  const url = new URL(outputUrl);
  if (url.protocol !== "https:") throw new Error("Provider returned an unsafe output URL.");
  const output = await fetch(url, { redirect: "follow" });
  if (!output.ok || !output.body) throw new Error("Unable to download provider output.");
  const length = Number(output.headers.get("content-length") ?? 0);
  if (length > 1024 * 1024 * 1024) throw new Error("Provider output exceeds the 1 GB limit.");
  const mimeType = output.headers.get("content-type")?.split(";")[0] || "video/mp4";
  const extension = mimeType === "video/quicktime" ? "mov" : "mp4";
  const path = `${generation.user_id}/${generation.id}/final.${extension}`;
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured.");
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const upload = await fetch(`${supabaseUrl}/storage/v1/object/generated-media/${encodedPath}`, {
    method: "POST",
    headers: {
      apikey: secret,
      authorization: `Bearer ${secret}`,
      "content-type": mimeType,
      "x-upsert": "true",
    },
    body: output.body,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
  if (!upload.ok) throw new Error(`Private output upload failed (${upload.status}).`);
  const { error } = await createAdminClient().rpc("complete_generation", {
    p_generation_id: generation.id,
    p_output_path: path,
    p_output_mime_type: mimeType,
  });
  if (error) throw new Error(error.message);
  return path;
}
storeOutput.maxRetries = 3;

async function failGeneration(generationId: string, message: string, providerStatus = "failed") {
  "use step";
  const { error } = await createAdminClient().rpc("fail_generation", {
    p_generation_id: generationId,
    p_error_message: message.slice(0, 1000),
    p_provider_status: providerStatus,
  });
  if (error) throw new Error(error.message);
}
failGeneration.maxRetries = 5;

export async function renderSceneWorkflow(generationId: string) {
  "use workflow";
  try {
    const generation = await loadGeneration(generationId);
    const taskId = await submitGeneration(generation);
    for (let attempt = 0; attempt < 180; attempt += 1) {
      await sleep("10s");
      const state = await pollGeneration(generationId, taskId);
      if (state.status === "failed") {
        await failGeneration(generationId, state.error ?? "Video provider failed.", state.providerStatus);
        return { status: "failed" as const };
      }
      if (state.status === "succeeded" && state.outputUrl) {
        const outputPath = await storeOutput(generation, state.outputUrl);
        return { status: "succeeded" as const, outputPath };
      }
    }
    await failGeneration(generationId, "Video provider timed out after 30 minutes.", "timeout");
    return { status: "failed" as const };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected render failure.";
    await failGeneration(generationId, message);
    return { status: "failed" as const };
  }
}
