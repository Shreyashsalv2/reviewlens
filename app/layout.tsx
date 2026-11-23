import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReviewLens: pull-request review checklist",
  description:
    "Paste a public GitHub pull request and get a review checklist: missing tests, long functions, leftover debug prints, TODOs and secret-looking strings.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
