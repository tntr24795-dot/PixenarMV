import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pixenar Studio",
    short_name: "Pixenar",
    description: "AI Film, Drama, Music & Video Creation Studio",
    start_url: "/studio",
    display: "standalone",
    background_color: "#080b14",
    theme_color: "#168ff8",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/pixenar-studio-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  };
}
