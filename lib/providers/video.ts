import "server-only";
import { inspectWan } from "./wan";
import RunwayML from "@runwayml/sdk";

export type RenderInput = {
  generationId: string;
  model: string;
  prompt: string;
  duration: number;
  aspectRatio: string;
  resolution: string;
};

export type ProviderState = {
  status: "queued" | "processing" | "succeeded" | "failed";
  progress: number;
  outputUrl?: string;
  error?: string;
  providerStatus: string;
  refundable?: boolean;
};

const providerModels: Record<string, string> = {
  "runway-4-5": "gen4.5",
  "wan-3-0": "wan3",
  "wan-3-0-prime": "wan3_prime",
};

function client() {
  const apiKey = process.env.RUNWAYML_API_SECRET;
  if (!apiKey) throw new Error("RUNWAYML_API_SECRET is not configured.");
  return new RunwayML({ apiKey, maxRetries: 0 });
}

function ratioFor(aspectRatio: string, resolution: string, supports1080 = true) {
  const portrait = aspectRatio === "9:16";
  if (resolution === "480p") return portrait ? "480:832" : "832:480";
  if (resolution === "1080p" && supports1080) return portrait ? "1080:1920" : "1920:1080";
  return portrait ? "720:1280" : "1280:720";
}

export function hasVideoProviderConfiguration(model = "runway-4-5") {
  return Boolean(providerModels[model] && process.env.RUNWAYML_API_SECRET);
}

export async function submitVideo(input: RenderInput) {
  const providerModel = providerModels[input.model];
  if (!providerModel) throw new Error(`Unsupported provider model: ${input.model}`);
  const promptText = input.prompt.slice(0, input.model === "runway-4-5" ? 1000 : 3500);
  const supports1080 = !["runway-4-5", "gemini-omni-flash"].includes(input.model);
  const params: Record<string, unknown> = {
    model: providerModel,
    promptText,
    duration: input.duration,
    ratio: ratioFor(input.aspectRatio, input.resolution, supports1080),
  };
  const task = await client().textToVideo.create(params as never, {
    idempotencyKey: `pixenar-${input.generationId}`,
  });
  return { taskId: task.id, providerStatus: "PENDING" };
}

export async function inspectVideo(taskId: string, provider = "runway"): Promise<ProviderState> {
  if (provider === "alibaba") return { ...await inspectWan(taskId), refundable: false };
  const task = await client().tasks.retrieve(taskId);
  if (task.status === "SUCCEEDED") {
    return {
      status: "succeeded",
      progress: 100,
      outputUrl: task.output[0],
      providerStatus: task.status,
    };
  }
  if (task.status === "FAILED" || task.status === "CANCELLED") {
    return {
      status: "failed",
      progress: 0,
      error: task.status === "FAILED" ? task.failure : "Provider task was cancelled.",
      providerStatus: task.status,
      refundable: task.status === "CANCELLED" || (typeof task.failureCode === "string" && !task.failureCode.startsWith("SAFETY.INPUT.")),
    };
  }
  return {
    status: task.status === "RUNNING" ? "processing" : "queued",
    progress:
      task.status === "RUNNING"
        ? Math.max(5, Math.min(99, Math.round(task.progress * 100)))
        : 5,
    providerStatus: task.status,
  };
}
