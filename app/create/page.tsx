import CreateStudio from "@/components/create-studio";
import { createClient } from "@/lib/supabase/server";
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; project?: string }>;
}) {
  const { mode, project } = await searchParams;
  let initialProject;
  if (project) {
    const supabase = await createClient();
    const [{ data: projectRow }, { data: sceneRows }] = await Promise.all([
      supabase
        .from("projects")
        .select("id,title,kind,song_analysis")
        .eq("id", project)
        .maybeSingle(),
      supabase
        .from("scenes")
        .select("id,position,title,duration_seconds,prompt,status")
        .eq("project_id", project)
        .order("position"),
    ]);
    if (projectRow) initialProject = { ...projectRow, scenes: sceneRows ?? [] };
  }
  return (
    <CreateStudio
      initialMode={mode === "music-video" ? "music-video" : "film"}
      initialProject={initialProject}
    />
  );
}
