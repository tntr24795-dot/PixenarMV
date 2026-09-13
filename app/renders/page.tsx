import Link from "next/link";
import RenderQueue, { type RenderJob } from "@/components/render-queue";
import ExportQueue, { type FinalExportJob } from "@/components/export-queue";
import SignOutButton from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
export default async function RendersPage() {
  const supabase = await createClient();
  const [{ data }, { data: exportData }] = await Promise.all([
    supabase
      .from("generations")
      .select(
        "id,model,status,provider_status,progress,credits_reserved,credits_charged,error_message,output_path,created_at,projects(title),scenes(title)",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("exports")
      .select(
        "id,project_id,status,progress,provider_status,error_message,storage_path,created_at,completed_at,projects(title,kind)",
      )
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const jobs = await Promise.all(
    ((data ?? []) as unknown as (Omit<RenderJob, "signed_url"> & { output_path: string | null })[]).map(async (job) => {
      let signedUrl: string | null = null;
      if (job.output_path) {
        const { data: signed } = await supabase.storage.from("generated-media").createSignedUrl(job.output_path, 3600);
        signedUrl = signed?.signedUrl ?? null;
      }
      const { output_path: _outputPath, ...safeJob } = job;
      return { ...safeJob, signed_url: signedUrl };
    }),
  );
  const projectIds = [...new Set((exportData ?? []).map((job) => job.project_id))];
  const { data: timelineData } = projectIds.length
    ? await supabase
        .from("scenes")
        .select("id,project_id,position,title,duration_seconds")
        .in("project_id", projectIds)
        .order("position", { ascending: true })
    : { data: [] };
  const exportJobs = await Promise.all(
    ((exportData ?? []) as unknown as (Omit<FinalExportJob, "signed_url" | "timeline"> & {
      storage_path: string | null;
    })[]).map(async (job) => {
      let signedUrl: string | null = null;
      if (job.storage_path) {
        const { data: signed } = await supabase.storage
          .from("generated-media")
          .createSignedUrl(job.storage_path, 3600);
        signedUrl = signed?.signedUrl ?? null;
      }
      const timeline = (timelineData ?? [])
        .filter((scene) => scene.project_id === job.project_id)
        .map((scene) => ({
          id: scene.id,
          title: scene.title ?? `Scene ${scene.position + 1}`,
          duration: scene.duration_seconds,
          position: scene.position,
        }));
      const { storage_path: _storagePath, ...safeJob } = job;
      return { ...safeJob, timeline, signed_url: signedUrl };
    }),
  );
  return (
    <main className="phasePage">
      <header className="phaseTop">
        <Link className="brand" href="/studio">
          <span className="brandMark">P</span>
          <span>
            PIXENAR<span>MV</span>
          </span>
        </Link>
        <nav>
          <Link href="/studio">Projects</Link>
          <Link href="/characters">Characters</Link>
          <Link className="active" href="/renders">
            Render queue
          </Link>
        </nav>
        <SignOutButton />
      </header>
      <div className="phaseContent">
        <p className="eyebrow">LIVE PRODUCTION</p>
        <h1>Render queue</h1>
        <p className="phaseLead">
          Follow scene renders and final timeline exports from one production queue.
        </p>
        <div className="sectionHead exportSectionHead">
          <div>
            <h2>Final exports</h2>
            <p>All scenes, synchronized with the original master track.</p>
          </div>
        </div>
        <div className="queueList finalQueue">
          <ExportQueue jobs={exportJobs} />
        </div>
        <div className="sectionHead">
          <div>
            <h2>Scene renders</h2>
            <p>Individual source clips used by the final timeline.</p>
          </div>
        </div>
        <div className="queueList">
          <RenderQueue jobs={jobs} />
        </div>
      </div>
      <footer className="appCopyright">
        © 2026 PixenarMV. All rights reserved.
      </footer>
    </main>
  );
}
