import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "KitStack — AI Skills Marketplace",
    template: "%s | KitStack",
  },
  description:
    "Discover and share AI skills, prompts, and workflows for Claude and ChatGPT.",
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "KitStack",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
