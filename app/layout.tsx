import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  let origin = "https://follow-atlas.example";
  if (host) {
    try {
      origin = new URL(`${protocol}://${host}`).origin;
    } catch {
      // Keep the safe fallback when a proxy sends a malformed host header.
    }
  }
  const description =
    "A private, searchable atlas of the Instagram accounts you follow.";

  return {
    metadataBase: new URL(origin),
    title: {
      default: "Follow Atlas",
      template: "%s · Follow Atlas",
    },
    description,
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title: "Follow Atlas",
      description,
      type: "website",
      images: [{ url: `${origin}/og.png`, width: 1536, height: 1024 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Follow Atlas",
      description,
      images: [`${origin}/og.png`],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
