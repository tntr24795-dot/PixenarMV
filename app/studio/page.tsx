import Dashboard from "@/components/dashboard";
import { createClient } from "@/lib/supabase/server";
export default async function StudioPage(){const supabase=await createClient();const [{data:projects},{data:wallet}]=await Promise.all([supabase.from("projects").select("id,title,kind,status,updated_at,duration_seconds").order("updated_at",{ascending:false}).limit(12),supabase.from("credit_wallets").select("balance").maybeSingle()]);return <Dashboard savedProjects={projects??[]} credits={wallet?.balance??0}/>}
