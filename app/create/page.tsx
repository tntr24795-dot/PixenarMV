import { videoModels } from "@/lib/models";
import { hasVideoProviderConfiguration } from "@/lib/providers/video";
import CreateStudio from "@/components/create-studio";
import { createClient } from "@/lib/supabase/server";
import { getShowcaseTemplate } from "@/lib/showcase";
export default async function CreatePage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; project?: string; template?: string }>;
}) {
  const { mode, project, template } = await searchParams;
  const initialTemplate = getShowcaseTemplate(template);
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
      initialTemplate={initialTemplate}
      initialProject={initialProject}
      configuredModelIds={videoModels.filter(m => m.available && hasVideoProviderConfiguration(m.id)).map(m => m.id)}
    />
  );
}
