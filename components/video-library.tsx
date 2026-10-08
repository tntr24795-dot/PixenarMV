"use client";

export type VideoLibraryItem = {
  id: string;
  kind: "scene" | "final";
  title: string;
  subtitle: string;
  createdAt: string;
  expiresAt: string | null;
  signedUrl: string | null;
  mediaDeletedAt: string | null;
};

function daysLeft(expiresAt: string | null) {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000));
}

export default function VideoLibrary({ items }: { items: VideoLibraryItem[] }) {
  if (!items.length) {
    return (
      <section className="videoLibrarySection">
        <div className="sectionHead">
          <div>
            <h2>My Videos</h2>
            <p>Your generated scenes and final exports will appear here.</p>
          </div>
        </div>
        <div className="emptyState">No generated videos yet.</div>
      </section>
    );
  }

  return (
    <section className="videoLibrarySection">
      <div className="sectionHead">
        <div>
          <h2>My Videos</h2>
          <p>Generated videos are stored for 60 days. Download anything you want to keep.</p>
        </div>
        <strong>{items.length}</strong>
      </div>
      <div className="retentionNotice">
        <b>60-day storage policy</b>
        <span>
          Pixenar Studio automatically deletes generated video files 60 days after completion.
          Save important videos to your phone or computer before they expire.
        </span>
      </div>
      <div className="videoLibraryGrid">
        {items.map((item) => {
          const remaining = daysLeft(item.expiresAt);
          const expired = Boolean(item.mediaDeletedAt) || remaining === 0 || !item.signedUrl;
          return (
            <article className="videoLibraryCard" key={item.kind + item.id}>
              <div className="videoLibraryMedia">
                {item.signedUrl ? (
                  <video controls preload="metadata" src={item.signedUrl} />
                ) : (
                  <div className="videoExpired">Video expired</div>
                )}
                <span className="videoKind">{item.kind === "final" ? "Final export" : "Scene"}</span>
              </div>
              <div className="videoLibraryInfo">
                <h3>{item.title}</h3>
                <p>{item.subtitle}</p>
                <small>
                  {expired
                    ? "Media no longer stored"
                    : remaining !== null
                      ? remaining + " day" + (remaining === 1 ? "" : "s") + " left"
                      : "60-day retention"}
                </small>
                {item.signedUrl ? (
                  <a className="primary" href={item.signedUrl} download>
                    Download
                  </a>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
