"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { loginUrl } from "@/lib/auth-redirect";

export function WishlistButton({
  targetType,
  targetSlug,
}: {
  targetType: string;
  targetSlug: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const [wishlisted, setWishlisted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check current wishlist status
  useEffect(() => {
    if (!session) return;
    fetch(`/api/wishlists?targetType=${targetType}&targetSlug=${targetSlug}`)
      .then((r) => r.json())
      .then((d) => setWishlisted(d.wishlisted))
      .catch(() => {});
  }, [session, targetType, targetSlug]);

  // Execute pending wishlist action after login redirect
  useEffect(() => {
    if (!session) return;
    if (searchParams.get("action") !== "wishlist") return;

    // Remove action from URL without navigation
    const url = new URL(window.location.href);
    url.searchParams.delete("action");
    window.history.replaceState({}, "", url.toString());

    // Execute the wishlist toggle
    setWishlisted(true);
    setLoading(true);
    fetch("/api/wishlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetSlug }),
    })
      .then((r) => { if (!r.ok) setWishlisted(false); })
      .finally(() => setLoading(false));
  }, [session, searchParams, targetType, targetSlug]);

  const toggle = async () => {
    if (!session) {
      router.push(loginUrl(pathname, "wishlist"));
      return;
    }

    const next = !wishlisted;
    setWishlisted(next);
    setLoading(true);

    const res = await fetch("/api/wishlists", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType, targetSlug }),
    });

    setLoading(false);
    if (!res.ok) setWishlisted(!next);
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`font-sans text-xs cursor-pointer transition-colors ${
        wishlisted
          ? "text-ks-accent font-medium"
          : "text-ks-muted hover:text-ks-ink"
      }`}
    >
      {wishlisted ? "\u2665 Wishlisted" : "\u2661 Wishlist"}
    </button>
  );
}
