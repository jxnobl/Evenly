import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  themeColor: "#050506",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "Evenly — Split With Precision",
  description: "Frictionless expense splitting engineered with Linear precision.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Evenly",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#050506] text-[#EDEDEF] antialiased selection:bg-[#5E6AD2]/30 selection:text-white relative">
        <div className="fixed inset-0 pointer-events-none z-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-15%,rgba(94,106,210,0.18),rgba(5,5,6,0)_80%)]" />
        <div className="fixed top-[-10%] left-[20%] w-[500px] h-[500px] bg-[#5E6AD2]/12 rounded-full blur-[140px] pointer-events-none animate-blob-slow z-0" />
        <div className="fixed top-[45%] right-[-10%] w-[420px] h-[420px] bg-purple-600/10 rounded-full blur-[130px] pointer-events-none animate-blob-slow-reverse z-0" />
        <div className="fixed inset-0 linear-grid pointer-events-none opacity-40 z-0" />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}