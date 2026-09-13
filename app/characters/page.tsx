import Link from "next/link";
import CharacterManager, { Character } from "@/components/character-manager";
import SignOutButton from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
export default async function CharactersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("characters")
    .select("id,name,role,description,identity_lock,wardrobe_lock,created_at")
    .order("updated_at", { ascending: false });
  return (
    <main className="phasePage">
      <header className="phaseTop">
        <Link className="brand" href="/studio">
          <span className="brandMark">P</span>
          <span>
            PIXENAR<span>MV</span>
          </span>
        </Link>
        <nav>
          <Link href="/studio">Projects</Link>
          <Link className="active" href="/characters">
            Characters
          </Link>
          <Link href="/renders">Render queue</Link>
        </nav>
        <SignOutButton />
      </header>
      <div className="phaseContent">
        <p className="eyebrow">CHARACTER CONTINUITY</p>
        <h1>Keep every character recognizable.</h1>
        <p className="phaseLead">
          Create an approved identity once, then reuse the same face, wardrobe
          and visual notes throughout your film or music video.
        </p>
        <CharacterManager initialCharacters={(data ?? []) as Character[]} />
      </div>
      <footer className="appCopyright">
        © 2026 PixenarMV. All rights reserved.
      </footer>
    </main>
  );
}
