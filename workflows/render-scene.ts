import { sleep } from "workflow";
import { createAdminClient } from "@/lib/supabase/admin";
import { persistProviderOutput } from "@/lib/providers/output";
import { inspectVideo, submitVideo } from "@/lib/providers/video";

type GenerationRecord = {
  id: string;
  user_id: string;
  model: string;
  provider: string;
  request_payload: { prompt?: string; duration?: number; resolution?: string; aspectRatio?: string; referenceAssetIds?: string[] };
  provider_task_id: string | null;
  projects: { aspect_ratio: string; resolution: string } | null;
};

async function loadGeneration(generationId: string) {
  "use step";
  const { data, error } = await createAdminClient()
    .from("generations")
    .select("id,user_id,model,provider,provider_task_id,request_payload,projects(aspect_ratio,resolution)")
    .eq("id", generationId)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as GenerationRecord;
}

async function submitGeneration(generation: GenerationRecord) {
  "use step";
  if (generation.provider_task_id) return generation.provider_task_id;
  const admin=createAdminClient();
  const {data: claimed,error: claimError}=await admin.rpc("claim_generation_submission",{p_generation_id:generation.id});
  if(claimError || !claimed) throw new Error("Generation cannot be submitted twice.");
  const payload = generation.request_payload ?? {};
  const referenceIds = Array.isArray(payload.referenceAssetIds) ? payload.referenceAssetIds : [];
  let references: {uri:string;type:"image"|"video"|"audio"}[] = [];
  if(referenceIds.length) {
    const {data:assets,error:assetError}=await admin
      .from("project_assets")
      .select("id,kind,storage_path")
      .in("id",referenceIds)
      .eq("user_id",generation.user_id);
    if(assetError) throw new Error(assetError.message);
    if((assets ?? []).length !== referenceIds.length) throw new Error("Reference assets are missing.");
    references = await Promise.all((assets ?? []).map(async asset => {
      const {data:signed,error:signedError}=await admin.storage
        .from("source-media")
        .createSignedUrl(asset.storage_path,3600);
      if(signedError || !signed?.signedUrl) throw new Error("Unable to sign a private reference asset.");
      const type = asset.kind === "reference_image" ? "image" : asset.kind === "reference_video" ? "video" : "audio";
      return {uri:signed.signedUrl,type};
    }));
  }
  const submitted = await submitVideo({
    generationId: generation.id,
    model: generation.model,
    prompt: String(payload.prompt ?? ""),
    duration: Number(payload.duration ?? 8),
    aspectRatio: payload.aspectRatio ?? generation.projects?.aspect_ratio ?? "16:9",
    resolution: payload.resolution ?? generation.projects?.resolution ?? "720p",
    references,
  });
  const { error } = await createAdminClient().rpc("mark_generation_processing", {
    p_generation_id: generation.id,
    p_provider_task_id: submitted.taskId,
    p_provider_status: submitted.providerStatus,
  });
  if (error) throw new Error(error.message);
  return submitted.taskId;
}
submitGeneration.maxRetries = 0;

async function pollGeneration(generation: GenerationRecord, taskId: string) {
  "use step";
  const state = await inspectVideo(taskId, generation.provider);
  if (state.status === "succeeded") {
    const output = await persistProviderOutput(generation.user_id, generation.id, state);
    const { data: completed, error } = await createAdminClient().rpc("complete_generation", {
      p_generation_id: generation.id, p_output_path: output.path, p_output_mime_type: output.mimeType,
    });
    if (error || !completed) throw new Error(error?.message || "Unable to finalize generation.");
    // Keep binary media out of durable workflow step results.
    return { status: "succeeded" as const, progress: 100, providerStatus: state.providerStatus, outputPath: output.path };
  }
  if (state.status === "queued" || state.status === "processing") {
    const { error } = await createAdminClient().rpc("update_generation_progress", {
      p_generation_id: generation.id, p_progress: state.progress, p_provider_status: state.providerStatus,
    });
    if (error) throw new Error(error.message);
  }
  return state;
}
pollGeneration.maxRetries = 4;

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
      const state = await pollGeneration(generation, taskId);
      if (state.status === "failed") {
        await failGeneration(generationId, state.error ?? "Video provider failed.", state.refundable ? "confirmed_refundable" : "billed_failure");
        return { status: "failed" as const };
      }
      if (state.status === "succeeded" && "outputPath" in state) {
        return { status: "succeeded" as const, outputPath: state.outputPath };
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
