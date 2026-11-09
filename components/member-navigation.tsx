import Link from "next/link";

export default function MemberNavigation({ active = "showcase", role = "user", credits }: { active?: "showcase" | "characters" | "create"; role?: "user" | "admin"; credits?: number }) {
  return <>
      <header className="memberTopbar">
        <Link className="memberBrand" href="/">
          <span className="memberBrandMark">P</span>
          <span>PIXENAR <b>STUDIO</b></span>
        </Link>
        <nav className="memberTopnav" aria-label="Studio sections">
          <Link className={active === "create" ? "active" : undefined} href="/create">Create</Link>
          <Link href="/#examples">Showcase</Link>
          <Link href="/my-videos">My Videos</Link>
          <Link className={active === "characters" ? "active" : undefined} href="/characters">Characters</Link><Link href="/account">Account</Link>
        </nav>
        <div className="memberTopActions">
          <span className="memberCredits">◉ <b>{credits?.toLocaleString() ?? "0"}</b> credits</span>
          <button type="button" aria-label="Help">?</button>
          <button type="button" aria-label="Notifications">♢</button>
          <span className="memberAvatar">D</span>
        </div>
      </header>

      <aside className="memberSidebar">
        <nav>
          <Link className={`memberSide${active === "showcase" ? " active" : ""}`} href="/#examples"><span>▣</span>Showcase</Link>
          <Link className="memberSide" href="/create"><span>＋</span>Create</Link>
          <Link className={`memberSide${active === "characters" ? " active" : ""}`} href="/characters"><span>♙</span>Characters</Link>
          <Link className="memberSide" href="/my-videos"><span>▤</span>My Videos</Link><Link className="memberSide" href="/account"><span>◉</span>Account</Link>
        </nav>

        <div className="memberSideGroup">
          <small>AI TOOLS</small>
          <Link className="memberSide" href="/create?mode=film"><span>▧</span>Image to Video</Link>
          <Link className="memberSide" href="/create?mode=film"><span>▧</span>Video to Video</Link>
          <Link className="memberSide" href="/create?mode=film"><span>▦</span>AI Short Drama</Link>
          <Link className="memberSide" href="/create?mode=film"><span>▦</span>AI Long Drama</Link>
          <Link className="memberSide" href="/create?mode=music-video"><span>♫</span>Music Video</Link>
        </div>

        <div className="memberSideGroup">
          <small>LIBRARY</small>
          <Link className="memberSide" href="/#examples"><span>▧</span>Templates</Link>
          <Link className="memberSide" href="/my-videos"><span>▱</span>Assets</Link>
          <Link className="memberSide" href="/characters"><span>♩</span>Voices</Link><Link className="memberSide" href="/account"><span>◉</span>Account</Link>
        </div>

        {role === "admin" ? <Link className="memberSide memberAdmin" href="/admin/showcase"><span>▤</span>Admin</Link> : null}
      </aside>

  </>;
}
