"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export type FinalExportJob = {
  id: string;
  project_id: string;
  status: string;
  progress: number;
  provider_status: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
  signed_url: string | null;
  projects: { title: string; kind: string } | null;
  timeline: { id: string; title: string; duration: number; position: number }[];
};

export default function ExportQueue({ jobs }: { jobs: FinalExportJob[] }) {
  const router = useRouter();
  const active = jobs.some((job) => ["queued", "processing"].includes(job.status));
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => router.refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [active, router]);

  if (!jobs.length) {
    return (
      <div className="emptyState">
        No final exports yet. Render every scene, then choose Export in the studio.
      </div>
    );
  }
  return jobs.map((job) => {
    const totalDuration = job.timeline.reduce((sum, scene) => sum + scene.duration, 0);
    return (
      <article className="finalExport" key={job.id}>
        <div className="exportHeading">
          <span className={`statusDot ${job.status}`} />
          <div>
            <p className="eyebrow">FINAL MASTER</p>
            <h3>{job.projects?.title || "Untitled project"}</h3>
            <small>
              {job.timeline.length} scenes · {Math.round(totalDuration)}s · MP4
            </small>
          </div>
          <div className="queueMeta">
            <b>{job.status}</b>
            <strong>{job.progress}%</strong>
          </div>
        </div>
        <div className="exportTimeline" aria-label="Final video timeline">
          {job.timeline.map((scene) => (
            <span
              key={scene.id}
              style={{ flex: Math.max(scene.duration, 1) }}
              title={`${scene.title} · ${scene.duration}s`}
            >
              <b>{scene.position + 1}</b>
              <small>{scene.duration}s</small>
            </span>
          ))}
        </div>
        {["queued", "processing"].includes(job.status) ? (
          <>
            <div className="renderProgress" aria-label={`${job.progress}% complete`}>
              <span style={{ width: `${job.progress}%` }} />
            </div>
            <p className="exportStatus">{job.provider_status || "Waiting for export worker"}</p>
          </>
        ) : null}
        {job.error_message ? <p className="renderError">{job.error_message}</p> : null}
        {job.signed_url ? (
          <div className="exportResult">
            <video controls preload="metadata" src={job.signed_url} />
            <a className="primary" href={job.signed_url} download>
              Download final MP4
            </a>
          </div>
        ) : null}
      </article>
    );
  });
}
