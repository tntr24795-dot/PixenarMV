"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { supabaseUrl } from "@/lib/supabase/config";

type Item = {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  prompt: string;
  style: string;
  aspect_ratio: "16:9" | "9:16";
  duration_seconds: number;
  model_id: string;
  video_path: string | null;
  thumbnail_path: string | null;
  published: boolean;
  is_featured: boolean;
  featured_order: number;
};

const emptyForm = {
  slug: "",
  title: "",
  category: "Showcase",
  description: "",
  prompt: "",
  style: "cinematic-realism",
  aspectRatio: "16:9",
  durationSeconds: 8,
  modelId: "wan-3-0",
  videoPath: "",
  thumbnailPath: "",
  published: false,
  isFeatured: true,
  featuredOrder: 0,
};

export default function ShowcaseAdminManager() {
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    const response = await fetch("/api/admin/showcase", { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to load showcase.");
    setItems(data.items ?? []);
  }

  useEffect(() => {
    load().catch((error) => setNotice(error instanceof Error ? error.message : "Unable to load showcase."));
  }, []);

  async function uploadMedia(file: File, kind: "video" | "thumbnail") {
    const slug = form.slug.trim();
    if (!slug) {
      setNotice("Enter the showcase slug before uploading media.");
      return;
    }
    setUploading(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/showcase/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug,
          kind,
          fileName: file.name,
          mimeType: file.type,
          sizeBytes: file.size,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to prepare showcase upload.");

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("showcase-media")
        .uploadToSignedUrl(data.path, data.token, file, {
          contentType: file.type,
          upsert: false,
        });
      if (uploadError) throw uploadError;

      setForm((current) => ({
        ...current,
        ...(kind === "video"
          ? { videoPath: data.path }
          : { thumbnailPath: data.path }),
      }));
      setNotice(`${kind === "video" ? "Video" : "Thumbnail"} uploaded successfully.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to upload showcase media.");
    } finally {
      setUploading(false);
    }
  }

  async function importStarterTemplates() {
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/showcase/seed", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to import starter templates.");
      await load();
      setNotice(`${data.imported} starter showcase templates are ready to edit.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to import starter templates.");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(item: Item) {
    setEditingId(item.id);
    setForm({
      slug: item.slug,
      title: item.title,
      category: item.category,
      description: item.description,
      prompt: item.prompt,
      style: item.style,
      aspectRatio: item.aspect_ratio,
      durationSeconds: item.duration_seconds,
      modelId: item.model_id,
      videoPath: item.video_path ?? "",
      thumbnailPath: item.thumbnail_path ?? "",
      published: item.published,
      isFeatured: item.is_featured,
      featuredOrder: item.featured_order,
    });
    setNotice(`Editing ${item.title}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setNotice("");
  }

  async function createItem(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/showcase", {
        method: editingId ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(editingId ? { id: editingId, ...form } : form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || (editingId ? "Unable to update showcase item." : "Unable to create showcase item."));
      setForm(emptyForm);
      setEditingId(null);
      await load();
      setNotice(editingId ? "Showcase item updated." : "Showcase item created.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to create showcase item.");
    } finally {
      setSaving(false);
    }
  }

  async function patch(id: string, values: Record<string, unknown>) {
    const response = await fetch("/api/admin/showcase", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, ...values }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to update showcase item.");
    await load();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this showcase item?")) return;
    const response = await fetch("/api/admin/showcase", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Unable to delete showcase item.");
    await load();
  }

  return (
    <main className="showcaseAdmin">
      <header>
        <div>
          <p className="eyebrow">PIXENARMV ADMIN</p>
          <h1>Showcase manager</h1>
          <p>Publish example videos and attach the exact prompt users can reuse in Studio.</p>
        </div>
        <div className="showcaseAdminHeaderActions"><button className="ghost" onClick={importStarterTemplates} disabled={saving}>Import 20 starter templates</button><a className="ghost" href="/studio">Back to studio</a></div>
      </header>

      <form className="showcaseAdminForm" onSubmit={createItem}>
        <div className="showcaseAdminGrid">
          <label>Title<input value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} required /></label>
          <label>Slug<input value={form.slug} onChange={(e)=>setForm({...form,slug:e.target.value.toLowerCase().replace(/[^a-z0-9-]/g,"-")})} required /></label>
          <label>Category<input value={form.category} onChange={(e)=>setForm({...form,category:e.target.value})} /></label>
          <label>Model<input value={form.modelId} onChange={(e)=>setForm({...form,modelId:e.target.value})} /></label>
          <label>Format<select value={form.aspectRatio} onChange={(e)=>setForm({...form,aspectRatio:e.target.value})}><option>16:9</option><option>9:16</option></select></label>
          <label>Duration (sec)<input type="number" min={2} max={600} value={form.durationSeconds} onChange={(e)=>setForm({...form,durationSeconds:Number(e.target.value)})} /></label>
          <label>Order<input type="number" min={0} value={form.featuredOrder} onChange={(e)=>setForm({...form,featuredOrder:Number(e.target.value)})} /></label>
          <label>
            Video file
            <input
              type="file"
              accept="video/mp4,video/webm"
              disabled={uploading}
              onChange={(e)=>{
                const file=e.target.files?.[0];
                if(file) uploadMedia(file,"video");
              }}
            />
            <small>{form.videoPath || "No video uploaded yet"}</small>
          </label>
          <label>
            Thumbnail
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e)=>{
                const file=e.target.files?.[0];
                if(file) uploadMedia(file,"thumbnail");
              }}
            />
            <small>{form.thumbnailPath || "Optional"}</small>
          </label>
        </div>
        <label>Description<textarea value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} /></label>
        <label>Prompt<textarea className="promptField" value={form.prompt} onChange={(e)=>setForm({...form,prompt:e.target.value})} required /></label>
        <div className="showcaseAdminChecks">
          <label><input type="checkbox" checked={form.published} onChange={(e)=>setForm({...form,published:e.target.checked})} /> Published</label>
          <label><input type="checkbox" checked={form.isFeatured} onChange={(e)=>setForm({...form,isFeatured:e.target.checked})} /> Featured</label>
        </div>
        <div className="showcaseAdminFormActions">
          <button className="primary" disabled={saving || uploading}>
            {saving ? "Saving…" : uploading ? "Uploading media…" : editingId ? "Save changes" : "Add showcase item"}
          </button>
          {editingId ? <button type="button" className="ghost" onClick={cancelEdit}>Cancel edit</button> : null}
        </div>
        {notice ? <p className="uploadNotice">{notice}</p> : null}
      </form>

      <section className="showcaseAdminList">
        {items.map((item)=>(
          <article key={item.id}>
            {item.video_path ? (
              <video
                className="showcaseAdminPreview"
                src={`${supabaseUrl}/storage/v1/object/public/showcase-media/${item.video_path.split("/").map(encodeURIComponent).join("/")}`}
                poster={item.thumbnail_path ? `${supabaseUrl}/storage/v1/object/public/showcase-media/${item.thumbnail_path.split("/").map(encodeURIComponent).join("/")}` : undefined}
                muted
                playsInline
                controls
                preload="metadata"
              />
            ) : (
              <div className="showcaseAdminPreview empty">No video</div>
            )}
            <div className="showcaseAdminItemInfo">
              <small>{item.category} · {item.aspect_ratio} · {item.duration_seconds}s · order {item.featured_order}</small>
              <h3>{item.title}</h3>
              <p>{item.slug}</p>
            </div>
            <div className="showcaseAdminActions">
              <button onClick={()=>beginEdit(item)}>Edit</button><button onClick={()=>patch(item.id,{published:!item.published})}>{item.published ? "Unpublish" : "Publish"}</button>
              <button onClick={()=>patch(item.id,{featuredOrder:Math.max(0,item.featured_order-1)})}>Earlier</button><button onClick={()=>patch(item.id,{featuredOrder:item.featured_order+1})}>Later</button>
              <button className="danger" onClick={()=>remove(item.id)}>Delete</button>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
