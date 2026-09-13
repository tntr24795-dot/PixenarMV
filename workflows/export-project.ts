import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createAdminClient } from "@/lib/supabase/admin";
import { supabaseUrl } from "@/lib/supabase/config";

type ExportBundle = {
  exportId: string;
  projectId: string;
  userId: string;
  audioPath: string | null;
  durationSeconds: number;
  scenes: {
    id: string;
    position: number;
    durationSeconds: number;
    outputPath: string;
  }[];
};

const MAX_OUTPUT_BYTES = 1024 * 1024 * 1024;

async function updateExport(
  exportId: string,
  values: Record<string, string | number | null>,
) {
  "use step";
  const { error } = await createAdminClient()
    .from("exports")
    .update({ ...values, last_polled_at: new Date().toISOString() })
    .eq("id", exportId)
    .neq("status", "cancelled");
  if (error) throw new Error(error.message);
}
updateExport.maxRetries = 4;

async function loadExport(exportId: string): Promise<ExportBundle> {
  "use step";
  const admin = createAdminClient();
  const { data: exportJob, error: exportError } = await admin
    .from("exports")
    .select("id,project_id,user_id,status")
    .eq("id", exportId)
    .single();
  if (exportError || !exportJob) {
    throw new Error(exportError?.message ?? "Export job was not found.");
  }
  if (exportJob.status === "cancelled") throw new Error("Export was cancelled.");

  const [{ data: project, error: projectError }, { data: scenes, error: scenesError }] =
    await Promise.all([
      admin
        .from("projects")
        .select("id,user_id,kind,audio_path,duration_seconds")
        .eq("id", exportJob.project_id)
        .eq("user_id", exportJob.user_id)
        .single(),
      admin
        .from("scenes")
        .select("id,position,duration_seconds,status,active_generation_id")
        .eq("project_id", exportJob.project_id)
        .eq("user_id", exportJob.user_id)
        .order("position", { ascending: true }),
    ]);
  if (projectError || !project) {
    throw new Error(projectError?.message ?? "Project was not found.");
  }
  if (scenesError) throw new Error(scenesError.message);
  if (!scenes?.length) throw new Error("Add and render at least one scene before export.");
  if (project.kind === "music_video" && !project.audio_path) {
    throw new Error("Upload the master track before exporting a music video.");
  }
  if (scenes.some((scene) => scene.status !== "succeeded" || !scene.active_generation_id)) {
    throw new Error("Every scene must finish rendering before final export.");
  }

  const generationIds = scenes.map((scene) => String(scene.active_generation_id));
  const { data: generations, error: generationError } = await admin
    .from("generations")
    .select("id,status,output_path")
    .in("id", generationIds);
  if (generationError) throw new Error(generationError.message);
  const outputByGeneration = new Map(
    (generations ?? []).map((generation) => [generation.id, generation]),
  );
  const timeline = scenes.map((scene) => {
    const generation = outputByGeneration.get(String(scene.active_generation_id));
    if (generation?.status !== "succeeded" || !generation.output_path) {
      throw new Error(`Scene ${scene.position + 1} has no completed video output.`);
    }
    return {
      id: scene.id,
      position: scene.position,
      durationSeconds: scene.duration_seconds,
      outputPath: generation.output_path,
    };
  });

  return {
    exportId: exportJob.id,
    projectId: exportJob.project_id,
    userId: exportJob.user_id,
    audioPath: project.audio_path,
    durationSeconds:
      Number(project.duration_seconds) ||
      timeline.reduce((sum, scene) => sum + scene.durationSeconds, 0),
    scenes: timeline,
  };
}
loadExport.maxRetries = 3;

async function createPrivateMediaUrl(
  bucket: "generated-media" | "source-media",
  storagePath: string,
) {
  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60 * 60);
  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? `Unable to read ${bucket} object.`);
  }
  const url = new URL(data.signedUrl);
  if (url.protocol !== "https:") throw new Error("Storage returned an unsafe media URL.");
  return url.toString();
}

function ffconcatPath(path: string) {
  return `'${path.replaceAll("'", "'\\''")}'`;
}

async function runFfmpeg(
  executable: string,
  args: string[],
  onProgress: (seconds: number) => Promise<void>,
) {
  await new Promise<void>((resolve, reject) => {
    const process = spawn(executable, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let progressWrites = Promise.resolve();
    process.stdout.setEncoding("utf8");
    process.stderr.setEncoding("utf8");
    process.stdout.on("data", (chunk: string) => {
      stdout += chunk;
      const lines = stdout.split("\n");
      stdout = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("out_time_us=")) continue;
        const seconds = Number(line.slice("out_time_us=".length)) / 1_000_000;
        if (Number.isFinite(seconds)) {
          progressWrites = progressWrites.then(() => onProgress(seconds));
        }
      }
    });
    process.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-12_000);
    });
    process.on("error", reject);
    process.on("close", (code) => {
      progressWrites
        .then(() => {
          if (code === 0) resolve();
          else reject(new Error(`FFmpeg exited with code ${code}: ${stderr.slice(-1500)}`));
        })
        .catch(reject);
    });
  });
}

async function composeExport(bundle: ExportBundle) {
  "use step";
  const workDir = await mkdtemp(join(tmpdir(), `pixenar-export-${bundle.exportId}-`));
  try {
    const { default: staticFfmpegPath } = await import("ffmpeg-static");
    const ffmpegPath = process.env.FFMPEG_PATH || staticFfmpegPath;
    if (!ffmpegPath) throw new Error("FFmpeg is unavailable in the render worker.");

    const sceneUrls: string[] = [];
    for (let index = 0; index < bundle.scenes.length; index += 1) {
      const scene = bundle.scenes[index];
      sceneUrls.push(await createPrivateMediaUrl("generated-media", scene.outputPath));
      await updateExport(bundle.exportId, {
        progress: 8 + Math.round(((index + 1) / bundle.scenes.length) * 7),
        provider_status: `Securing scene ${index + 1} of ${bundle.scenes.length}`,
      });
    }

    const audioUrl = bundle.audioPath
      ? await createPrivateMediaUrl("source-media", bundle.audioPath)
      : null;

    const concatFile = join(workDir, "timeline.ffconcat");
    await writeFile(
      concatFile,
      `ffconcat version 1.0\n${sceneUrls.map((url) => `file ${ffconcatPath(url)}`).join("\n")}\n`,
      "utf8",
    );
    const outputFile = join(workDir, "final.mp4");
    const inputArgs = [
      "-protocol_whitelist",
      "file,http,https,tcp,tls,crypto",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatFile,
    ];
    if (audioUrl) inputArgs.push("-i", audioUrl);
    const outputArgs = audioUrl
      ? [
          "-map", "0:v:0", "-map", "1:a:0", "-c:v", "libx264", "-preset", "veryfast",
          "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
          "-shortest", "-movflags", "+faststart",
        ]
      : [
          "-map", "0:v:0", "-map", "0:a:0?", "-c:v", "libx264", "-preset", "veryfast",
          "-crf", "20", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "192k",
          "-movflags", "+faststart",
        ];
    let lastProgress = 14;
    await updateExport(bundle.exportId, {
      progress: 15,
      provider_status: "Composing timeline and mastering audio",
    });
    await runFfmpeg(
      ffmpegPath,
      ["-y", ...inputArgs, ...outputArgs, "-progress", "pipe:1", "-nostats", outputFile],
      async (seconds) => {
        const nextProgress = Math.min(
          90,
          15 + Math.round((seconds / Math.max(bundle.durationSeconds, 1)) * 75),
        );
        if (nextProgress >= lastProgress + 4) {
          lastProgress = nextProgress;
          await updateExport(bundle.exportId, {
            progress: nextProgress,
            provider_status: "Composing timeline and mastering audio",
          });
        }
      },
    );

    const outputSize = (await stat(outputFile)).size;
    if (!outputSize) throw new Error("FFmpeg produced an empty export.");
    if (outputSize > MAX_OUTPUT_BYTES) throw new Error("Final export exceeds 1 GB.");
    await updateExport(bundle.exportId, {
      progress: 94,
      provider_status: "Uploading final master",
    });
    const secret = process.env.SUPABASE_SECRET_KEY;
    if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured.");
    const outputPath = `${bundle.userId}/${bundle.projectId}/exports/${bundle.exportId}.mp4`;
    const encodedPath = outputPath.split("/").map(encodeURIComponent).join("/");
    const upload = await fetch(`${supabaseUrl}/storage/v1/object/generated-media/${encodedPath}`, {
      method: "POST",
      headers: {
        apikey: secret,
        authorization: `Bearer ${secret}`,
        "content-type": "video/mp4",
        "content-length": String(outputSize),
        "x-upsert": "true",
      },
      body: createReadStream(outputFile) as unknown as BodyInit,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    if (!upload.ok) throw new Error(`Final master upload failed (${upload.status}).`);
    return outputPath;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
composeExport.maxRetries = 2;

async function completeExport(bundle: ExportBundle, outputPath: string) {
  "use step";
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { error: exportError } = await admin
    .from("exports")
    .update({
      status: "succeeded",
      storage_path: outputPath,
      output_mime_type: "video/mp4",
      progress: 100,
      provider_status: "Final master ready",
      completed_at: now,
      last_polled_at: now,
    })
    .eq("id", bundle.exportId)
    .neq("status", "cancelled");
  if (exportError) throw new Error(exportError.message);
  const { error: projectError } = await admin
    .from("projects")
    .update({ status: "completed", final_output_path: outputPath, updated_at: now })
    .eq("id", bundle.projectId)
    .eq("user_id", bundle.userId);
  if (projectError) throw new Error(projectError.message);
}
completeExport.maxRetries = 4;

async function failExport(exportId: string, projectId: string | null, message: string) {
  "use step";
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: current } = await admin
    .from("exports")
    .select("status")
    .eq("id", exportId)
    .maybeSingle();
  if (current?.status === "cancelled") return;
  await admin
    .from("exports")
    .update({
      status: "failed",
      error_message: message.slice(0, 1000),
      provider_status: "Export failed",
      completed_at: now,
      last_polled_at: now,
    })
    .eq("id", exportId);
  if (projectId) {
    await admin
      .from("projects")
      .update({ status: "failed", updated_at: now })
      .eq("id", projectId);
  }
}
failExport.maxRetries = 5;

export async function exportProjectWorkflow(exportId: string) {
  "use workflow";
  let projectId: string | null = null;
  try {
    const bundle = await loadExport(exportId);
    projectId = bundle.projectId;
    await updateExport(exportId, {
      status: "processing",
      progress: 5,
      provider_status: "Preparing private project media",
      started_at: new Date().toISOString(),
      error_message: null,
    });
    const outputPath = await composeExport(bundle);
    await completeExport(bundle, outputPath);
    return { status: "succeeded" as const, outputPath };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected export failure.";
    await failExport(exportId, projectId, message);
    return { status: "failed" as const };
  }
}
