import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HFTS Horizon",
  description: "Evergreen New Year Countdown and Memory Sharing Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-[#05060f] text-slate-100">
        {children}
      </body>
    </html>
  );
}
