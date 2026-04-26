"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Logo } from "@/components/ui/logo";

const navSections = [
  {
    label: "",
    items: [
      { label: "Dashboard", href: "/admin/dashboard" },
    ],
  },
  {
    label: "Content",
    items: [
      { label: "Skills", href: "/admin/skills" },
      { label: "Kits", href: "/admin/kits" },
      { label: "Authors", href: "/admin/authors" },
    ],
  },
  {
    label: "Users & Access",
    items: [
      { label: "Users", href: "/admin/users" },
    ],
  },
  {
    label: "Moderation",
    items: [
      { label: "Reviews", href: "/admin/reviews" },
    ],
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session, isPending } = authClient.useSession();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    if (isPending) return;
    if (!session?.user) {
      router.replace("/login");
      return;
    }
    // Check admin role via API
    fetch("/api/admin/me")
      .then((r) => {
        if (!r.ok) {
          router.replace("/dashboard");
          return;
        }
        setAuthorized(true);
      })
      .catch(() => router.replace("/dashboard"));
  }, [isPending, session, router]);

  if (isPending || !authorized) {
    return (
      <div className="min-h-screen bg-ks-paper flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ks-paper flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r border-ks-hair bg-white flex flex-col">
        <div className="px-5 py-4 border-b border-ks-hair">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={20} />
            <span className="font-serif text-[15px] tracking-tight">
              kitstack<span className="text-ks-accent">.co</span>
            </span>
          </Link>
          <div className="font-mono text-[10px] text-ks-muted tracking-wider mt-1">
            ADMIN
          </div>
        </div>

        <nav className="flex-1 py-3 overflow-y-auto">
          {navSections.map((section, i) => (
            <div key={section.label || i} className="mb-4">
              {section.label && (
                <div className="px-5 font-mono text-[10px] text-ks-muted tracking-wider mb-1.5">
                  {section.label.toUpperCase()}
                </div>
              )}
              {section.items.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`block px-5 py-1.5 font-sans text-[13px] transition-colors ${
                      active
                        ? "text-ks-ink font-semibold bg-ks-paper-warm"
                        : "text-ks-muted hover:text-ks-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-5 py-3 border-t border-ks-hair">
          <div className="font-sans text-[12px] text-ks-muted truncate">
            {session?.user?.email}
          </div>
          <Link
            href="/dashboard"
            className="font-sans text-[11px] text-ks-accent hover:underline"
          >
            Back to dashboard
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
    </div>
  );
}
