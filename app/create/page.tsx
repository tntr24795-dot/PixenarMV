import { videoModels } from "@/lib/models";
import { hasVideoProviderConfiguration } from "@/lib/providers/video";
import { hasVoiceProviderConfiguration } from "@/lib/providers/voice";
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
  let initialReferenceAssets: {
    id:string;
    scene_id:string;
    kind:"reference_image"|"reference_video"|"reference_audio";
    storage_path:string;
    mime_type:string|null;
    size_bytes:number|null;
    duration_seconds:number|null;
  }[] = [];

  if (project) {
    const supabase = await createClient();
    const [{ data: projectRow }, { data: sceneRows }, { data: referenceRows }] = await Promise.all([
      supabase
        .from("projects")
        .select("id,title,kind,status,concept,aspect_ratio,storyboard,song_analysis")
        .eq("id", project)
        .maybeSingle(),
      supabase
        .from("scenes")
        .select("id,position,title,duration_seconds,prompt,status,camera_direction,model")
        .eq("project_id", project)
        .order("position"),
      supabase
        .from("project_assets")
        .select("id,scene_id,kind,storage_path,mime_type,size_bytes,duration_seconds")
        .eq("project_id", project)
        .in("kind", ["reference_image","reference_video","reference_audio"])
        .not("scene_id","is",null)
        .order("created_at"),
    ]);
    if (projectRow) initialProject = { ...projectRow, scenes: sceneRows ?? [] };
    initialReferenceAssets = (referenceRows ?? []) as typeof initialReferenceAssets;
  }

  return (
    <CreateStudio
      initialMode={mode === "music-video" ? "music-video" : "film"}
      initialTemplate={initialTemplate}
      initialProject={initialProject}
      initialReferenceAssets={initialReferenceAssets}
      configuredModelIds={videoModels.filter(m => m.available && hasVideoProviderConfiguration(m.id)).map(m => m.id)}
      voiceConfigured={hasVoiceProviderConfiguration()}
    />
  );
}
