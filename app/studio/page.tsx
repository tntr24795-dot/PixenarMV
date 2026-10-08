import Dashboard from "@/components/dashboard";
import type { VideoLibraryItem } from "@/components/video-library";
import { createClient } from "@/lib/supabase/server";

export default async function StudioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const [{ data: projects }, { data: wallet }, { data: profile }, { data: generations }, { data: exports }] =
    await Promise.all([
      supabase.from("projects").select("id,title,kind,status,updated_at,duration_seconds").order("updated_at",{ascending:false}).limit(12),
      supabase.from("credit_wallets").select("balance").maybeSingle(),
      user ? supabase.from("profiles").select("role").eq("user_id",user.id).maybeSingle() : Promise.resolve({data:null}),
      supabase
        .from("generations")
        .select("id,status,output_path,created_at,completed_at,expires_at,media_deleted_at,projects(title),scenes(title)")
        .eq("status","succeeded")
        .order("completed_at",{ascending:false})
        .limit(24),
      supabase
        .from("exports")
        .select("id,status,storage_path,created_at,completed_at,expires_at,media_deleted_at,projects(title,kind)")
        .eq("status","succeeded")
        .order("completed_at",{ascending:false})
        .limit(12),
    ]);

  const sceneVideos: VideoLibraryItem[] = await Promise.all(
    ((generations ?? []) as any[]).map(async (item) => {
      let signedUrl: string | null = null;
      if (item.output_path && !item.media_deleted_at) {
        const { data: signed } = await supabase.storage
          .from("generated-media")
          .createSignedUrl(item.output_path, 60 * 60);
        signedUrl = signed?.signedUrl ?? null;
      }
      return {
        id: item.id,
        kind: "scene",
        title: item.scenes?.title || "Generated scene",
        subtitle: item.projects?.title || "Untitled project",
        createdAt: item.completed_at || item.created_at,
        expiresAt: item.expires_at,
        signedUrl,
        mediaDeletedAt: item.media_deleted_at,
      };
    }),
  );

  const finalVideos: VideoLibraryItem[] = await Promise.all(
    ((exports ?? []) as any[]).map(async (item) => {
      let signedUrl: string | null = null;
      if (item.storage_path && !item.media_deleted_at) {
        const { data: signed } = await supabase.storage
          .from("generated-media")
          .createSignedUrl(item.storage_path, 60 * 60);
        signedUrl = signed?.signedUrl ?? null;
      }
      return {
        id: item.id,
        kind: "final",
        title: item.projects?.title || "Final export",
        subtitle: item.projects?.kind === "music_video" ? "Music video master" : "Final film master",
        createdAt: item.completed_at || item.created_at,
        expiresAt: item.expires_at,
        signedUrl,
        mediaDeletedAt: item.media_deleted_at,
      };
    }),
  );

  const videos = [...finalVideos, ...sceneVideos]
    .sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);

  return (
    <Dashboard
      savedProjects={projects ?? []}
      credits={wallet?.balance ?? 0}
      role={profile?.role === "admin" ? "admin" : "user"}
      videos={videos}
    />
  );
}
