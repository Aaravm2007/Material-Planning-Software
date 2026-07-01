import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { RoleProvider } from "@/components/RoleContext";
import TrackpadScrollFix from "@/components/TrackpadScrollFix";
import SessionBanner from "@/components/SessionBanner";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Material Planning",
  description: "Material Planning Software",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geist.variable} ${geistMono.variable} ${playfair.variable}`}
      style={{ height: "100%" }}
    >
      <body style={{ height: "100%", margin: 0, background: "#ffffff", display: "flex" }}>
        <RoleProvider>
          <SessionBanner />
          <TrackpadScrollFix />
          <Sidebar />
          <main style={{ flex: 1, height: "100%", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            {children}
          </main>
        </RoleProvider>
      </body>
    </html>
  );
}
