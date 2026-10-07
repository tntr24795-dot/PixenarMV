import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./auth.css";
import "./phase-two.css";
import "./studio-phase-two.css";
import "./final-tweaks.css";
import "./showcase.css";
import "./showcase-admin.css";

export const metadata: Metadata = {
  title:"Pixenar Studio — AI Film, Drama, Music & Video Creation Studio",
  description:"Create films, dramas, music videos, animation and cinematic stories with AI, scene by scene.",
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}</body></html>;
}
