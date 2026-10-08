import { redirect } from "next/navigation";
import ShowcaseAdminManager from "@/components/showcase-admin-manager";
import { createClient } from "@/lib/supabase/server";

export default async function AdminShowcasePage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub as string | undefined;
  if (!userId) redirect("/login");
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("user_id", userId)
    .maybeSingle();
  if (profile?.role !== "admin") redirect("/studio");
  return <ShowcaseAdminManager />;
}
