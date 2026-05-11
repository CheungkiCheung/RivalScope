import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RivalScope",
  description: "Multi-agent competitive intelligence platform"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
