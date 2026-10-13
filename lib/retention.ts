import type { SupabaseClient } from "@supabase/supabase-js";

export class RetentionError extends Error {
  readonly stage: string;
  readonly code: string;
  constructor(stage: string, code: string) {
    super("Retention maintenance failed.");
    this.name = "RetentionError";
    this.stage = stage;
    this.code = code;
  }
}

function check(stage: string, error: { message: string; code?: string; statusCode?: string | number } | null) {
  if (error) throw new RetentionError(stage, error.code ?? String(error.statusCode ?? "SUPABASE_ERROR"));
}

export async function runRetention(admin: SupabaseClient, dryRun = false) {
  const now = new Date().toISOString();
  // Do not delete anything until BOTH inventories have been read successfully.
  const { data: generations, error: generationError } = await admin
    .from("generations").select("id,output_path,project_id")
    .eq("status", "succeeded").not("output_path", "is", null)
    .is("media_deleted_at", null).lte("expires_at", now).limit(200);
  check("query.generations", generationError);
  const { data: exports, error: exportError } = await admin
    .from("exports").select("id,storage_path,project_id")
    .eq("status", "succeeded").not("storage_path", "is", null)
    .is("media_deleted_at", null).lte("expires_at", now).limit(200);
  check("query.exports", exportError);
  const paths = [...new Set([
    ...(generations ?? []).map((item) => item.output_path),
    ...(exports ?? []).map((item) => item.storage_path),
  ].filter((value): value is string => Boolean(value)))];
  const summary = { sceneVideos: generations?.length ?? 0, finalExports: exports?.length ?? 0 };
  if (dryRun) return { ...summary, dryRun: true, expiredObjects: paths.length, deletedObjects: 0 };
  if (paths.length) {
    const { error } = await admin.storage.from("generated-media").remove(paths);
    check("storage.remove", error);
  }
  const deletedAt = new Date().toISOString();
  if (generations?.length) {
    const { error } = await admin.from("generations")
      .update({ output_path: null, media_deleted_at: deletedAt }).in("id", generations.map((item) => item.id));
    check("update.generations", error);
  }
  if (exports?.length) {
    // Keep the export paths available for the next cron run until all project
    // pointers are cleared. Storage.remove is safe to repeat for missing files.
    for (const item of exports) {
      if (!item.storage_path) continue;
      const { error: projectError } = await admin.from("projects")
        .update({ final_output_path: null, updated_at: deletedAt })
        .eq("id", item.project_id).eq("final_output_path", item.storage_path);
      check("update.projects", projectError);
    }
    const { error } = await admin.from("exports")
      .update({ storage_path: null, media_deleted_at: deletedAt }).in("id", exports.map((item) => item.id));
    check("update.exports", error);
  }
  return { deletedAt, deletedObjects: paths.length, ...summary };
}
