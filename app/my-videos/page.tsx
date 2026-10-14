import Link from "next/link";
import VideoLibrary, { type VideoLibraryItem } from "@/components/video-library";
import SignOutButton from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { mainSiteUrl } from "@/lib/brand-links";

export default async function MyVideosPage(){
  const supabase=await createClient();
  const [{data:wallet},{data:generations},{data:exports}]=await Promise.all([
    supabase.from("credit_wallets").select("balance").maybeSingle(),
    supabase.from("generations").select("id,status,output_path,created_at,completed_at,expires_at,media_deleted_at,projects(title),scenes(title)").eq("status","succeeded").order("completed_at",{ascending:false}).limit(30),
    supabase.from("exports").select("id,status,storage_path,created_at,completed_at,expires_at,media_deleted_at,projects(title,kind)").eq("status","succeeded").order("completed_at",{ascending:false}).limit(20),
  ]);
  const sceneVideos:VideoLibraryItem[]=await Promise.all(((generations??[]) as any[]).map(async item=>{
    let signedUrl:null|string=null;
    if(item.output_path&&!item.media_deleted_at){const {data:signed}=await supabase.storage.from("generated-media").createSignedUrl(item.output_path,3600);signedUrl=signed?.signedUrl??null;}
    return {id:item.id,kind:"scene",title:item.scenes?.title||"Generated scene",subtitle:item.projects?.title||"Untitled project",createdAt:item.completed_at||item.created_at,expiresAt:item.expires_at,signedUrl,mediaDeletedAt:item.media_deleted_at};
  }));
  const finalVideos:VideoLibraryItem[]=await Promise.all(((exports??[]) as any[]).map(async item=>{
    let signedUrl:null|string=null;
    if(item.storage_path&&!item.media_deleted_at){const {data:signed}=await supabase.storage.from("generated-media").createSignedUrl(item.storage_path,3600);signedUrl=signed?.signedUrl??null;}
    return {id:item.id,kind:"final",title:item.projects?.title||"Final export",subtitle:item.projects?.kind==="music_video"?"Music video master":"Final film master",createdAt:item.completed_at||item.created_at,expiresAt:item.expires_at,signedUrl,mediaDeletedAt:item.media_deleted_at};
  }));
  const videos=[...finalVideos,...sceneVideos].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,40);
  return (
    <main className="memberDash">
      <header className="memberTopbar">
        <Link className="memberBrand" href="/studio"><span className="memberBrandMark">P</span><span>PIXENAR <b>STUDIO</b></span></Link>
        <nav className="memberTopnav"><Link href="/create">Create</Link><Link href="/studio">Showcase</Link><Link className="active" href="/my-videos">My Videos</Link><Link href="/characters">Characters</Link><Link href="/account">Account</Link></nav>
        <div className="memberTopActions"><span className="memberCredits">◉ <b>{(wallet?.balance??0).toLocaleString()}</b> credits</span><button>?</button><button>♢</button><span className="memberAvatar">D</span></div>
      </header>
      <aside className="memberSidebar">
        <nav><Link className="memberSide" href="/studio"><span>▣</span>Showcase</Link><Link className="memberSide" href="/create"><span>＋</span>Create</Link><Link className="memberSide" href="/characters"><span>♙</span>Characters</Link><Link className="memberSide active" href="/my-videos"><span>▤</span>My Videos</Link><Link className="memberSide" href="/account"><span>◉</span>Account</Link></nav>
        <div className="memberSideGroup"><small>AI TOOLS</small><Link className="memberSide" href="/create?mode=film"><span>▧</span>Image to Video</Link><Link className="memberSide" href="/create?mode=film"><span>▧</span>Video to Video</Link><Link className="memberSide" href="/create?mode=film"><span>▦</span>AI Short Drama</Link><Link className="memberSide" href="/create?mode=film"><span>▦</span>AI Long Drama</Link><Link className="memberSide" href="/create?mode=music-video"><span>♫</span>Music Video</Link></div>
        <div className="memberSideGroup"><small>LIBRARY</small><Link className="memberSide" href="/studio"><span>▧</span>Templates</Link><Link className="memberSide active" href="/my-videos"><span>▱</span>Assets</Link><Link className="memberSide" href="/characters"><span>♩</span>Voices</Link></div>
      </aside>
      <section className="memberContent"><div className="memberContentHead"><div><h1>My Videos</h1><p>Your generated videos are kept separate from Showcase.</p></div></div><VideoLibrary items={videos}/><div className="memberFooterActions"><a href={mainSiteUrl}>Main website</a><SignOutButton/></div></section>
    </main>
  );
}