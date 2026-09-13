import { Suspense } from "react";
import AuthForm from "@/components/auth-form";
export default function LoginPage() {
  return (
    <main className="authPage">
      <Suspense fallback={<div className="authCard">Loading…</div>}>
        <AuthForm />
      </Suspense>
      <footer className="authCopyright">
        © 2026 PixenarMV. All rights reserved.
      </footer>
    </main>
  );
}
