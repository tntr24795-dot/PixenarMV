import "server-only";
import type { ProviderState, RenderInput } from "./video";

function baseUrl() {
  const workspace = process.env.ALIBABA_WORKSPACE_ID;
  if (!workspace || !/^[a-zA-Z0-9-]+$/.test(workspace)) throw new Error("ALIBABA_WORKSPACE_ID is not configured.");
  // Rates are verified for Virginia. Changing region requires a pricing review.
  return `https://${workspace}.us-east-1.maas.aliyuncs.com/api/v1`;
}
export function hasWanConfiguration() {
  return Boolean(process.env.ALIBABA_API_KEY && process.env.ALIBABA_WORKSPACE_ID);
}
async function call(path: string, body?: object) {
  if (!hasWanConfiguration()) throw new Error("Alibaba video generation is not configured.");
  const response = await fetch(baseUrl() + path, {
    method: body ? "POST" : "GET",
    headers: { authorization: `Bearer ${process.env.ALIBABA_API_KEY}`, "content-type": "application/json", ...(body ? { "X-DashScope-Async": "enable" } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(60_000),
    cache: "no-store",
  });
  const data = await response.json();
  if (!response.ok || data.code) throw new Error(`Alibaba request failed (${data.code || response.status}).`);
  return data;
}
export async function submitWan(input: RenderInput) {
  const data = await call("/services/aigc/video-generation/video-synthesis", {
    model: input.model === "wan-3-0-prime" ? "wan3.0-video-prime" : "wan3.0-video",
    input: { prompt: input.prompt },
    parameters: { duration: input.duration, resolution: input.resolution.toUpperCase(), ratio: input.aspectRatio, prompt_extend: true },
  });
  if (!data.output?.task_id) throw new Error("Alibaba did not return a task ID.");
  return { taskId: String(data.output.task_id), providerStatus: "PENDING" };
}
export async function inspectWan(taskId: string): Promise<ProviderState> {
  const data = await call(`/tasks/${encodeURIComponent(taskId)}`);
  const output = data.output;
  const status = String(output?.task_status || "UNKNOWN");
  if (status === "SUCCEEDED" && output.video_url) return { status: "succeeded", progress: 100, outputUrl: output.video_url, providerStatus: status };
  if (["FAILED", "CANCELED", "UNKNOWN", "SUCCEEDED"].includes(status)) return { status: "failed", progress: 0, error: output?.message || "Alibaba task failed or returned no video.", providerStatus: status };
  return { status: status === "RUNNING" ? "processing" : "queued", progress: status === "RUNNING" ? 50 : 5, providerStatus: status };
}
