"use client";

import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export function NavAuth() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return (
      <div className="flex gap-2.5 items-center">
        <div className="w-20 h-7 bg-ks-paper-warm rounded-full animate-pulse" />
      </div>
    );
  }

  if (session?.user) {
    return (
      <div className="flex gap-2.5 items-center">
        <Link
          href="/dashboard"
          className="ks-btn ks-btn-primary !py-1.5 !px-3 !text-[13px]"
        >
          Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 items-center">
      <Link
        href="/login"
        className="font-sans text-[13px] text-ks-muted hover:text-ks-ink"
      >
        Sign in
      </Link>
      <Link
        href="/login"
        className="ks-btn ks-btn-primary !py-1.5 !px-3 !text-[13px]"
      >
        Get started &rarr;
      </Link>
    </div>
  );
}
