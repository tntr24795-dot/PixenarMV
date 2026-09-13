import Link from "next/link";
import RenderQueue, { type RenderJob } from "@/components/render-queue";
import SignOutButton from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
export default async function RendersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("generations")
    .select(
      "id,model,status,provider_status,progress,credits_reserved,credits_charged,error_message,output_path,created_at,projects(title),scenes(title)",
    )
    .order("created_at", { ascending: false })
    .limit(50);
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
          Every generation is addressable, credit-safe and tied to its original
          project and scene.
        </p>
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
