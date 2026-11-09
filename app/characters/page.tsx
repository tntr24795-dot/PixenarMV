import MemberNavigation from "@/components/member-navigation";
import Link from "next/link";
import CharacterManager, { Character } from "@/components/character-manager";
import SignOutButton from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import { mainSiteUrl } from "@/lib/brand-links";
export default async function CharactersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("characters")
    .select("id,name,role,description,identity_lock,wardrobe_lock,thumbnail_path,created_at")
    .order("updated_at", { ascending: false });
  const characters = await Promise.all(
    (data ?? []).map(async (character) => {
      let signed_url: string | null = null;
      if (character.thumbnail_path) {
        const { data: signed } = await supabase.storage
          .from("source-media")
          .createSignedUrl(character.thumbnail_path, 60 * 60);
        signed_url = signed?.signedUrl ?? null;
      }
      const { thumbnail_path: _thumbnailPath, ...safeCharacter } = character;
      return { ...safeCharacter, signed_url };
    }),
  );

  return (
    <main className="memberDash charactersMemberPage">
      <MemberNavigation active="characters" />
      <div className="memberContent">
      <div className="phaseContent">
        <p className="eyebrow">CHARACTER CONTINUITY</p>
        <h1>Keep every character recognizable.</h1>
        <p className="phaseLead">
          Create an approved identity once, then reuse the same face, wardrobe
          and visual notes throughout your film or music video.
        </p>
        <CharacterManager initialCharacters={characters as Character[]} />
      </div>
      </div>
      <footer className="appCopyright">
        © 2026 Pixenar Studio. All rights reserved.
      </footer>
    </main>
  );
}
