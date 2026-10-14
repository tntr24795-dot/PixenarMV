import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import SignOutButton from "@/components/sign-out-button";
import { mainSiteUrl } from "@/lib/brand-links";

export default async function AccountPage(){
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  const [{data:wallet},{data:profile},{data:projects}]=await Promise.all([
    supabase.from("credit_wallets").select("balance,reserved").maybeSingle(),
    user ? supabase.from("profiles").select("role,display_name,created_at").eq("user_id",user.id).maybeSingle() : Promise.resolve({data:null}),
    supabase.from("projects").select("id,status").order("updated_at",{ascending:false}).limit(100),
  ]);
  const active=(projects??[]).filter((p:any)=>p.status!=="completed").length;
  return <main className="memberDash">
    <header className="memberTopbar">
      <Link className="memberBrand" href="/studio"><span className="memberBrandMark">P</span><span>PIXENAR <b>STUDIO</b></span></Link>
      <nav className="memberTopnav"><Link href="/create">Create</Link><Link href="/studio">Showcase</Link><Link href="/my-videos">My Videos</Link><Link href="/characters">Characters</Link><Link className="active" href="/account">Account</Link></nav>
      <div className="memberTopActions"><span className="memberCredits">◉ <b>{(wallet?.balance??0).toLocaleString()}</b> credits</span><button>?</button><button>♢</button><span className="memberAvatar">D</span></div>
    </header>
    <aside className="memberSidebar">
      <nav><Link className="memberSide" href="/studio"><span>▣</span>Showcase</Link><Link className="memberSide" href="/create"><span>＋</span>Create</Link><Link className="memberSide" href="/characters"><span>♙</span>Characters</Link><Link className="memberSide" href="/my-videos"><span>▤</span>My Videos</Link><Link className="memberSide active" href="/account"><span>◉</span>Account</Link></nav>
      <div className="memberSideGroup"><small>AI TOOLS</small><Link className="memberSide" href="/create?mode=film"><span>▧</span>Image to Video</Link><Link className="memberSide" href="/create?mode=film"><span>▧</span>Video to Video</Link><Link className="memberSide" href="/create?mode=film"><span>▦</span>AI Short Drama</Link><Link className="memberSide" href="/create?mode=film"><span>▦</span>AI Long Drama</Link><Link className="memberSide" href="/create?mode=music-video"><span>♫</span>Music Video</Link></div>
      <div className="memberSideGroup"><small>LIBRARY</small><Link className="memberSide" href="/studio"><span>▧</span>Templates</Link><Link className="memberSide" href="/my-videos"><span>▱</span>Assets</Link><Link className="memberSide" href="/characters"><span>♩</span>Voices</Link></div>
    </aside>
    <section className="memberContent">
      <div className="memberContentHead"><div><h1>Account Overview</h1><p>Plan access, credits and Studio account details.</p></div></div>
      <div className="stats">
        <article><span>Available credits</span><strong>{(wallet?.balance??0).toLocaleString()}</strong><em>{(wallet?.reserved??0).toLocaleString()} reserved</em></article>
        <article><span>Active projects</span><strong>{active}</strong><em>{(projects??[]).length} total saved</em></article>
        <article><span>Account role</span><strong>{profile?.role==="admin"?"Admin":"Member"}</strong><em>{user?.email??""}</em></article>
      </div>
      <div className="memberFooterActions"><a href={mainSiteUrl}>Main website</a><SignOutButton/></div>
    </section>
  </main>;
}