"use client";
import { FormEvent, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { mainSiteUrl } from "@/lib/brand-links";

export default function AuthForm() {
  const params = useSearchParams();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const supabase = createClient();
    const result =
      mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({
            email,
            password,
            options: { emailRedirectTo: `${location.origin}/studio` },
          });
    if (result.error) {
      setMessage(result.error.message);
      setBusy(false);
      return;
    }
    if (mode === "signup" && !result.data.session) {
      setMessage("Check your email to confirm your account.");
      setBusy(false);
      return;
    }
    const destination = params.get("next");
    location.href =
      destination?.startsWith("/") && !destination.startsWith("//")
        ? destination
        : "/studio";
  }
  return (
    <div className="authCard">
      <a className="brand" href="/">
        <span className="brandMark">P</span>
        <span>
          PIXENAR<span>MV</span>
        </span>
      </a>
      <p className="eyebrow">PIXENAR CREATIVE CLOUD</p>
      <h1>{mode === "login" ? "Welcome back" : "Create your studio"}</h1>
      <p>
        Save projects, private media and characters securely in your account.
      </p>
      <form onSubmit={submit}>
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            minLength={8}
            required
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
          />
        </label>
        {message && <p className="authMessage">{message}</p>}
        <button className="primary" disabled={busy}>
          {busy
            ? "Please wait…"
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>
      </form>
      <button
        className="authSwitch"
        onClick={() => {
          setMode(mode === "login" ? "signup" : "login");
          setMessage("");
        }}
      >
        {mode === "login"
          ? "New to PixenarMV? Create an account"
          : "Already have an account? Sign in"}
      </button>
      <small>
        By continuing, you confirm that uploaded media is yours or licensed for
        use.
      </small>
      <a className="authHomeLink" href={mainSiteUrl}>
        ← Back to PixenarMV main website
      </a>
    </div>
  );
}
