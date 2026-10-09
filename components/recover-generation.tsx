"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RecoverGeneration({ id }: { id: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  return <div>
    <button className="downloadRender" disabled={busy} onClick={async () => {
      setBusy(true); setError("");
      try {
        const response = await fetch("/api/render/recover", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ generationId: id }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Recovery failed.");
        router.refresh();
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Recovery failed."); }
      finally { setBusy(false); }
    }}>{busy ? "Recovering…" : "Recover completed video"}</button>
    <small>No new generation or additional credits.</small>
    {error ? <p role="alert">{error}</p> : null}
  </div>;
}
