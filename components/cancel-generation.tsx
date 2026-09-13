"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function CancelGeneration({ id }: { id: string }) {
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  return (
    <button
      className="ghost"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const response = await fetch("/api/generations", {
          method: "DELETE",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id }),
        });
        if (!response.ok) {
          const data = await response.json();
          alert(data.error || "Unable to cancel.");
        }
        router.refresh();
        setBusy(false);
      }}
    >
      {busy ? "Cancelling…" : "Cancel & refund"}
    </button>
  );
}
