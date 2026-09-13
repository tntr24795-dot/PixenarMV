"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import CancelGeneration from "@/components/cancel-generation";

export type RenderJob = {
  id: string;
  model: string;
  status: string;
  provider_status: string | null;
  progress: number;
  credits_reserved: number;
  credits_charged: number;
  error_message: string | null;
  created_at: string;
  signed_url: string | null;
  projects: { title: string } | null;
  scenes: { title: string | null } | null;
};

export default function RenderQueue({ jobs }: { jobs: RenderJob[] }) {
  const router = useRouter();
  const hasActiveJobs = jobs.some((job) => ["queued", "processing"].includes(job.status));
  useEffect(() => {
    if (!hasActiveJobs) return;
    const timer = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [hasActiveJobs, router]);

  if (!jobs.length)
    return <div className="emptyState">No render jobs yet. Generate a scene from your studio to start the queue.</div>;

  return jobs.map((job) => (
    <article className="queueItem" key={job.id}>
      <span className={`statusDot ${job.status}`} />
      <div className="queueBody">
        <h3>{job.projects?.title || "Untitled project"}</h3>
        <p>{job.scenes?.title || "Scene"} · {job.model}</p>
        <small>{new Date(job.created_at).toLocaleString()}</small>
        {["queued", "processing"].includes(job.status) ? (
          <div className="renderProgress" aria-label={`${job.progress}% complete`}>
            <span style={{ width: `${job.progress}%` }} />
          </div>
        ) : null}
        {job.error_message ? <p className="renderError">{job.error_message}</p> : null}
        {job.signed_url ? <video className="renderPreview" controls preload="metadata" src={job.signed_url} /> : null}
      </div>
      <div className="queueMeta">
        <b>{job.status}</b>
        <span>{job.provider_status || (job.status === "queued" ? "Waiting for worker" : "")}</span>
        {["queued", "processing"].includes(job.status) ? <strong>{job.progress}%</strong> : null}
        <span>{job.credits_charged || job.credits_reserved} credits</span>
        {job.status === "queued" ? <CancelGeneration id={job.id} /> : null}
        {job.signed_url ? <a className="downloadRender" href={job.signed_url} download>Download scene</a> : null}
      </div>
    </article>
  ));
}
