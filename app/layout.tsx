import type { Metadata } from "next";
import "./globals.css";
import "./landing.css";
import "./auth.css";
import "./phase-two.css";
import "./studio-phase-two.css";
import "./final-tweaks.css";

export const metadata: Metadata = {
  title:"PixenarMV — AI Movie & Music Video Studio",
  description:"Create consistent AI short films and music videos, scene by scene.",
};

export default function RootLayout({children}:{children:React.ReactNode}){
  return <html lang="en"><body>{children}</body></html>;
}
