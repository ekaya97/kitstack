"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Stars } from "@/components/ui/stars";
import { RatingInput } from "./rating-input";
import { loginUrl } from "@/lib/auth-redirect";

export function HeaderRating({
  targetType,
  targetSlug,
  rating,
  count,
}: {
  targetType: string;
  targetSlug: string;
  rating: number;
  count: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const [showInput, setShowInput] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [optimisticRating, setOptimisticRating] = useState<number | null>(null);
  const [optimisticCount, setOptimisticCount] = useState<number | null>(null);

  const displayRating = optimisticRating ?? rating;
  const displayCount = optimisticCount ?? count;

  const handleQuickRate = async (value: number) => {
    if (!session) {
      router.push(loginUrl(pathname, "rate"));
      return;
    }

    // Optimistic update
    const newCount = count + 1;
    const newRating =
      count > 0
        ? Math.round(((rating * count + value) / newCount) * 10) / 10
        : value;
    setOptimisticRating(newRating);
    setOptimisticCount(newCount);
    setShowInput(false);
    setSubmitting(true);

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType,
        targetSlug,
        rating: value,
        text: `Rated ${value}/5`,
      }),
    });

    setSubmitting(false);

    if (res.ok) {
      // Notify the ReviewSection to refresh
      window.dispatchEvent(new CustomEvent("reviews-updated"));
      router.refresh();
    } else {
      // Revert optimistic update
      setOptimisticRating(null);
      setOptimisticCount(null);
    }
  };

  if (displayCount > 0) {
    return (
      <div className="flex items-center gap-2">
        <Stars v={displayRating} size={13} />
        <a
          href="#reviews"
          className="font-sans text-[12px] text-ks-muted hover:text-ks-accent"
        >
          {displayCount} {displayCount === 1 ? "review" : "reviews"}
        </a>
        {submitting && (
          <span className="font-sans text-[10px] text-ks-muted animate-pulse">
            saving...
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {showInput ? (
        <div className="flex items-center gap-2">
          <RatingInput value={0} onChange={handleQuickRate} size={16} />
          {submitting && (
            <span className="font-sans text-[11px] text-ks-muted animate-pulse">
              Saving...
            </span>
          )}
          <button
            onClick={() => setShowInput(false)}
            className="font-sans text-[11px] text-ks-muted hover:text-ks-ink"
          >
            cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => {
            if (!session) {
              router.push(loginUrl(pathname, "rate"));
              return;
            }
            setShowInput(true);
          }}
          className="font-sans text-[12px] text-ks-muted hover:text-ks-accent cursor-pointer"
        >
          &#9733; Be the first to rate
        </button>
      )}
    </div>
  );
}
