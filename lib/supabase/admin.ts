import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseUrl } from "./config";

export function createAdminClient(options?: { fetch?: typeof fetch }) {
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!secret) throw new Error("SUPABASE_SECRET_KEY is not configured.");
  return createClient(supabaseUrl, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: options?.fetch ? { fetch: options.fetch } : undefined,
  });
}

export function hasAdminConfiguration() {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}
