import "server-only";
import { inspectWan } from "./wan";
import RunwayML from "@runwayml/sdk";
import { gateway } from "@ai-sdk/gateway";

export type RenderReference = { uri: string; type: "image" | "video" | "audio" };

export type RenderInput = {
  generationId: string;
  model: string;
  prompt: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
  references?: RenderReference[];
};

export type ProviderState = {
  status: "queued" | "processing" | "succeeded" | "failed";
  progress: number;
  outputUrl?: string;
  error?: string;
  providerStatus: string;
  refundable?: boolean;
};

const gatewayModels: Record<string,string> = {
  "veo-3-1-fast": "google/veo-3.1-fast-generate-001",
};

const providerModels: Record<string, string> = {
  "runway-4-5": "gen4.5",
  "wan-3-0": "wan3",
  "wan-3-0-prime": "wan3_prime",
  "grok-imagine-1-5": "grok_imagine_1_5",
  "seedance-2-0": "seedance2",
  "seedance-2-5": "seedance2_5",
};

function client() {
  const apiKey = process.env.RUNWAYML_API_SECRET;
  if (!apiKey) throw new Error("RUNWAYML_API_SECRET is not configured.");
  return new RunwayML({ apiKey, maxRetries: 0 });
}

function pixelRatio(aspectRatio: string, resolution: string) {
  const portrait = aspectRatio === "9:16";
  if (resolution === "480p") return portrait ? "480:854" : "854:480";
  if (resolution === "1080p") return portrait ? "1080:1920" : "1920:1080";
  return portrait ? "720:1280" : "1280:720";
}

function runwayParams(input: RenderInput, providerModel: string) {
  const promptText = input.prompt.slice(0, input.model === "runway-4-5" ? 1000 : 3500);
  const images=(input.references ?? []).filter(r=>r.type==="image").map(r=>({uri:r.uri}));
  const videos=(input.references ?? []).filter(r=>r.type==="video").map(r=>({type:"video" as const,uri:r.uri}));
  const audio=(input.references ?? []).filter(r=>r.type==="audio").map(r=>({type:"audio" as const,uri:r.uri}));

  if (input.model === "grok-imagine-1-5") {
    return {
      model: providerModel,
      promptText,
      duration: input.duration,
      ratio: input.aspectRatio === "9:16" ? "9:16" : "16:9",
      resolution: input.resolution,
      ...(images.length ? { references: images } : {}),
      ...(audio.length ? { referenceAudio: audio } : {}),
    };
  }

  if (input.model === "seedance-2-5") {
    return {
      model: providerModel,
      promptText,
      duration: input.duration,
      ratio: pixelRatio(input.aspectRatio, input.resolution),
      ...(images.length ? { references: images } : {}),
      ...(videos.length ? { referenceVideos: videos } : {}),
      ...(audio.length ? { referenceAudio: audio } : {}),
    };
  }

  if (input.model === "seedance-2-0") {
    return {
      model: providerModel,
      promptText,
      duration: input.duration,
      ratio: pixelRatio(input.aspectRatio, input.resolution),
    };
  }

  const portrait = input.aspectRatio === "9:16";
  const supports1080 = input.model !== "runway-4-5";
  const ratio =
    input.resolution === "480p"
      ? portrait ? "480:832" : "832:480"
      : input.resolution === "1080p" && supports1080
        ? portrait ? "1080:1920" : "1920:1080"
        : portrait ? "720:1280" : "1280:720";

  return { model: providerModel, promptText, duration: input.duration, ratio };
}

export function hasVideoProviderConfiguration(model = "runway-4-5") {
  if (gatewayModels[model]) return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN);
  return Boolean(providerModels[model] && process.env.RUNWAYML_API_SECRET);
}

export async function submitVideo(input: RenderInput) {
  const gatewayModelId = gatewayModels[input.model];
  if (gatewayModelId) {
    const started = await gateway.videoModel(gatewayModelId).doStart({
      prompt: input.prompt.slice(0,3500),
      duration: input.duration,
      aspectRatio: input.aspectRatio === "9:16" ? "9:16" : "16:9",
      resolution: "1280x720",
      generateAudio: false,
    });
    const taskId = Buffer.from(JSON.stringify(started.operation)).toString("base64url");
    return { taskId: `gateway:${input.model}:${taskId}`, providerStatus: "PENDING" };
  }
  const providerModel = providerModels[input.model];
  if (!providerModel) throw new Error(`Unsupported provider model: ${input.model}`);
  const task = await client().textToVideo.create(runwayParams(input, providerModel) as never, {
    idempotencyKey: `pixenar-${input.generationId}`,
  });
  return { taskId: task.id, providerStatus: "PENDING" };
}

export async function inspectVideo(taskId: string, provider = "runway"): Promise<ProviderState> {
  if (provider === "gateway") {
    const [, modelId, encoded] = taskId.split(":", 3);
    const gatewayModelId = gatewayModels[modelId];
    if (!gatewayModelId || !encoded) throw new Error("Invalid AI Gateway task handle.");
    const operation = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    const state = await gateway.videoModel(gatewayModelId).doStatus({ operation });
    if (state.status === "completed") {
      const video = state.videos?.find((item) => item.type === "url");
      return video?.url
        ? { status:"succeeded",progress:100,outputUrl:video.url,providerStatus:"COMPLETED" }
        : { status:"failed",progress:0,error:"AI Gateway completed without a downloadable video URL.",providerStatus:"COMPLETED",refundable:false };
    }
    if (state.status === "failed") {
      return { status:"failed",progress:0,error:"AI Gateway video generation failed.",providerStatus:"FAILED",refundable:true };
    }
    return { status:"processing",progress:20,providerStatus:String(state.status).toUpperCase() };
  }
  if (provider === "alibaba") return { ...await inspectWan(taskId), refundable: false };
  const task = await client().tasks.retrieve(taskId);
  if (task.status === "SUCCEEDED") {
    return { status:"succeeded",progress:100,outputUrl:task.output[0],providerStatus:task.status };
  }
  if (task.status === "FAILED" || task.status === "CANCELLED") {
    return {
      status:"failed",progress:0,
      error: task.status === "FAILED" ? task.failure : "Provider task was cancelled.",
      providerStatus:task.status,
      refundable: task.status === "CANCELLED" || (typeof task.failureCode === "string" && !task.failureCode.startsWith("SAFETY.INPUT.")),
    };
  }
  return {
    status: task.status === "RUNNING" ? "processing" : "queued",
    progress: task.status === "RUNNING" ? Math.max(5, Math.min(99, Math.round(task.progress * 100))) : 5,
    providerStatus: task.status,
  };
}
