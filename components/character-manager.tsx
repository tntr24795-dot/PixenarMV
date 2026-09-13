"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export type Character = {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  identity_lock: { notes?: string };
  wardrobe_lock: { notes?: string };
  created_at: string;
};
export default function CharacterManager({
  initialCharacters,
}: {
  initialCharacters: Character[];
}) {
  const [characters, setCharacters] = useState(initialCharacters);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  async function createCharacter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = event.currentTarget;
    const values = new FormData(form);
    const reference = values.get("reference");
    values.delete("reference");
    if (reference instanceof File && reference.size) {
      const allowed = ["image/jpeg", "image/png", "image/webp"];
      if (
        !allowed.includes(reference.type) ||
        reference.size > 10 * 1024 * 1024
      ) {
        setMessage("Reference must be a JPG, PNG or WebP image under 10 MB.");
        setBusy(false);
        return;
      }
    }
    const response = await fetch("/api/characters", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(values)),
    });
    const data = await response.json();
    if (response.ok) {
      if (reference instanceof File && reference.size) {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const safe = reference.name.replace(/[^a-zA-Z0-9._-]/g, "-");
          const path = `${user.id}/characters/${data.id}/${crypto.randomUUID()}-${safe}`;
          const { error: uploadError } = await supabase.storage
            .from("source-media")
            .upload(path, reference, {
              contentType: reference.type,
              upsert: false,
            });
          if (!uploadError)
            await supabase
              .from("characters")
              .update({ reference_paths: [path], thumbnail_path: path })
              .eq("id", data.id);
          else
            setMessage(
              `Character saved, but reference upload failed: ${uploadError.message}`,
            );
        }
      }
      setCharacters((current) => [data, ...current]);
      form.reset();
      router.refresh();
    } else setMessage(data.error || "Unable to create character.");
    setBusy(false);
  }
  async function remove(id: string) {
    if (!confirm("Delete this character profile?")) return;
    const response = await fetch("/api/characters", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (response.ok)
      setCharacters((current) => current.filter((item) => item.id !== id));
  }
  return (
    <section className="libraryGrid">
      <form className="libraryForm" onSubmit={createCharacter}>
        <p className="eyebrow">IDENTITY LOCK</p>
        <h2>Build a character</h2>
        <label>
          Name
          <input
            name="name"
            required
            maxLength={80}
            placeholder="Lead artist"
          />
        </label>
        <label>
          Role
          <input
            name="role"
            maxLength={80}
            placeholder="Singer, detective, hero…"
          />
        </label>
        <label>
          Approved reference image
          <input
            name="reference"
            type="file"
            accept="image/jpeg,image/png,image/webp"
          />
        </label>
        <label>
          Visual description
          <textarea
            name="description"
            maxLength={1000}
            placeholder="Face, hair, age range, defining features…"
          />
        </label>
        <label>
          Identity notes
          <textarea
            name="identityNotes"
            maxLength={1000}
            placeholder="Features that must remain identical in every shot"
          />
        </label>
        <label>
          Wardrobe lock
          <textarea
            name="wardrobeNotes"
            maxLength={1000}
            placeholder="Outfit, colors and accessories"
          />
        </label>
        {message ? <p className="authMessage">{message}</p> : null}
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Save character"}
        </button>
      </form>
      <div className="characterList">
        <div className="sectionHead">
          <div>
            <h2>Your Character Library</h2>
            <p>Reusable private profiles for continuity across projects</p>
          </div>
          <strong>{characters.length}</strong>
        </div>
        {characters.length ? (
          characters.map((character) => (
            <article className="characterCard" key={character.id}>
              <span className="characterAvatar">
                {character.name.slice(0, 1).toUpperCase()}
              </span>
              <div>
                <h3>{character.name}</h3>
                <p>{character.role || "Unassigned role"}</p>
                <small>
                  {character.description ||
                    "Add visual details when you are ready."}
                </small>
                <div className="lockTags">
                  <span>✓ Identity locked</span>
                  <span>✓ Wardrobe locked</span>
                </div>
              </div>
              <button
                className="dots"
                aria-label={`Delete ${character.name}`}
                onClick={() => remove(character.id)}
              >
                •••
              </button>
            </article>
          ))
        ) : (
          <div className="emptyState">
            No characters yet. Create the first approved identity profile.
          </div>
        )}
      </div>
    </section>
  );
}
