import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "KitStack — Cancel the SaaS. Keep the work.",
    template: "%s | KitStack",
  },
  description:
    "Free Skills turn Claude into a specialist. Subscription Kits add a database, interactive UI, and memory that survives sessions.",
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
