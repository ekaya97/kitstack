"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { loginUrl } from "@/lib/auth-redirect";
import { Avatar } from "@/components/ui/avatar";
import { Stars } from "@/components/ui/stars";
import { RatingInput } from "./rating-input";

interface Review {
  id: string;
  userId: string;
  userName: string;
  userRole: string | null;
  rating: number;
  text: string;
  verified: boolean | null;
  helpfulCount: number;
  createdAt: string | Date | null;
}

interface Distribution {
  stars: number;
  count: number;
  pct: number;
}

function formatTimeAgo(date: string | Date | null): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const now = Date.now();
  const diff = now - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 0 ? "just now" : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

const tones = [
  "#3b7a3b",
  "#6b4ea8",
  "#2b6cb0",
  "#c94080",
  "#d65a2f",
  "#7a6a3b",
];

// A quick-rate from the header produces "Rated N/5" as placeholder text
const isQuickRateText = (text: string) => /^Rated \d\/5$/.test(text);

export function ReviewSection({
  targetType,
  targetSlug,
  initialReviews,
  initialDistribution,
  initialRating,
  initialCount,
}: {
  targetType: string;
  targetSlug: string;
  initialReviews: Review[];
  initialDistribution: Distribution[];
  initialRating: number;
  initialCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { data: session } = authClient.useSession();

  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [distribution, setDistribution] =
    useState<Distribution[]>(initialDistribution);
  const [avgRating, setAvgRating] = useState(initialRating);
  const [totalCount, setTotalCount] = useState(initialCount);
  const [refreshing, setRefreshing] = useState(false);

  // Form state
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const refreshReviews = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(
        `/api/reviews?targetType=${targetType}&targetSlug=${targetSlug}`
      );
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews);
        setDistribution(data.distribution);
        if (data.reviews.length > 0) {
          const sum = data.reviews.reduce(
            (s: number, r: Review) => s + r.rating,
            0
          );
          setAvgRating(
            Math.round((sum / data.reviews.length) * 10) / 10
          );
        } else {
          setAvgRating(0);
        }
        setTotalCount(data.reviews.length);
      }
    } finally {
      setRefreshing(false);
    }
  }, [targetType, targetSlug]);

  // Listen for "reviews-updated" events from HeaderRating
  useEffect(() => {
    const handler = () => refreshReviews();
    window.addEventListener("reviews-updated", handler);
    return () => window.removeEventListener("reviews-updated", handler);
  }, [refreshReviews]);

  // Find the current user's existing review (if any)
  const userReview = session
    ? reviews.find((r) => r.userId === session.user?.id)
    : null;
  // User has a full text review (not just a quick-rate placeholder)
  const hasFullReview = userReview && !isQuickRateText(userReview.text);
  // User quick-rated but hasn't written a full review yet
  const canAddText = userReview && isQuickRateText(userReview.text);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating && !canAddText) {
      setError("Please select a rating.");
      return;
    }
    if (!text.trim()) {
      setError("Please write a comment.");
      return;
    }

    setError("");

    // Optimistic: add review to list immediately
    const optimisticReview: Review = {
      id: `optimistic-${Date.now()}`,
      userId: session?.user?.id || "",
      userName: session?.user?.name || "You",
      userRole: null,
      rating: canAddText ? userReview!.rating : rating,
      text: text.trim(),
      verified: false,
      helpfulCount: 0,
      createdAt: new Date(),
    };

    if (canAddText) {
      // Replace the quick-rate placeholder with the full review
      setReviews((prev) =>
        prev.map((r) =>
          r.id === userReview!.id ? { ...r, text: text.trim() } : r
        )
      );
    } else {
      // Add new review optimistically
      setReviews((prev) => [optimisticReview, ...prev]);
      setTotalCount((c) => c + 1);
      if (totalCount > 0) {
        const newAvg =
          (avgRating * totalCount + rating) / (totalCount + 1);
        setAvgRating(Math.round(newAvg * 10) / 10);
      } else {
        setAvgRating(rating);
      }
    }

    setSubmitting(true);
    setText("");
    setRating(0);

    const res = await fetch("/api/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        targetType,
        targetSlug,
        rating: canAddText ? userReview!.rating : rating,
        text: text.trim(),
      }),
    });

    setSubmitting(false);

    if (!res.ok) {
      // Revert optimistic update
      await refreshReviews();
      const data = await res.json();
      setError(data.error || "Could not post review.");
      return;
    }

    // Sync with server
    await refreshReviews();
    router.refresh();
  };

  const handleHelpful = async (reviewId: string) => {
    if (!session) return;

    // Optimistic: toggle count
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId
          ? { ...r, helpfulCount: r.helpfulCount + 1 }
          : r
      )
    );

    await fetch(`/api/reviews/${reviewId}/helpful`, { method: "POST" });
    await refreshReviews();
  };

  return (
    <section className="px-16 py-16 border-t border-ks-hair" id="reviews">
      <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
        REVIEWS
        {refreshing && (
          <span className="ml-2 animate-pulse">updating...</span>
        )}
      </div>

      <div className="grid grid-cols-[280px_1fr] gap-10">
        {/* Left — stats */}
        <div>
          {totalCount > 0 ? (
            <>
              <h2 className="font-serif text-[44px] tracking-tight mb-2">
                {avgRating}
                <span className="text-lg text-ks-muted">/5</span>
              </h2>
              <Stars v={avgRating} size={16} showValue={false} />
              <div className="font-sans text-xs text-ks-muted mt-2">
                {totalCount} {totalCount === 1 ? "rating" : "ratings"}
              </div>
              <div className="mt-4 flex flex-col gap-1">
                {distribution.map((d) => (
                  <div
                    key={d.stars}
                    className="grid grid-cols-[18px_1fr_30px] gap-2 items-center"
                  >
                    <span className="font-mono text-[10px] text-ks-muted">
                      {d.stars}&#9733;
                    </span>
                    <div className="h-[5px] bg-ks-hair rounded-full">
                      <div
                        className="h-full bg-ks-accent rounded-full transition-all duration-300"
                        style={{ width: `${d.pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-[9px] text-ks-muted text-right">
                      {d.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div>
              <h2 className="font-serif text-[28px] tracking-tight mb-2">
                No reviews yet
              </h2>
              <div className="font-sans text-[13px] text-ks-muted leading-relaxed">
                Be the first to share your experience.
              </div>
            </div>
          )}
        </div>

        {/* Right — reviews + form */}
        <div className="flex flex-col gap-4">
          {/* Comment form */}
          {session ? (
            hasFullReview ? (
              <div className="ks-card p-4 text-center font-sans text-[13px] text-ks-muted mb-2">
                Thanks for your review!
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="ks-card p-5 mb-2">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar
                    name={session.user?.name || "You"}
                    size={28}
                    tone="#3b7a3b"
                  />
                  <div>
                    <div className="font-sans text-[13px] font-medium text-ks-ink">
                      {session.user?.name || "You"}
                    </div>
                    {canAddText && (
                      <div className="font-sans text-[11px] text-ks-muted">
                        You rated {userReview!.rating}/5 &mdash; add a
                        comment below
                      </div>
                    )}
                  </div>
                  {!canAddText && (
                    <div className="ml-auto">
                      <RatingInput
                        value={rating}
                        onChange={setRating}
                        size={18}
                      />
                    </div>
                  )}
                </div>

                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={
                    canAddText
                      ? "Add a comment to your rating..."
                      : "Share your experience..."
                  }
                  rows={3}
                  className="w-full font-sans text-[14px] bg-white border border-ks-hair rounded-lg px-4 py-3 outline-none focus:border-ks-accent transition-colors resize-none mb-3"
                />

                {error && (
                  <div className="font-sans text-[12px] text-red-600 mb-3">
                    {error}
                  </div>
                )}

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="ks-btn ks-btn-primary !text-[13px] !py-2 !px-4 disabled:opacity-60"
                  >
                    {submitting
                      ? "Posting..."
                      : canAddText
                        ? "Add comment"
                        : "Post review"}
                  </button>
                </div>
              </form>
            )
          ) : (
            <a
              href={loginUrl(pathname, "review")}
              className="ks-card p-4 text-center font-sans text-[13px] text-ks-muted hover:text-ks-ink hover:border-ks-accent transition-colors block mb-2"
            >
              Sign in to leave a review &rarr;
            </a>
          )}

          {/* Review list */}
          {reviews.map((r, i) => (
            <div
              key={r.id}
              className={`ks-card p-4 transition-opacity ${r.id.startsWith("optimistic-") ? "opacity-70" : ""}`}
            >
              <div className="flex items-center gap-2.5 mb-2">
                <Avatar
                  name={r.userName}
                  size={26}
                  tone={tones[i % tones.length]}
                />
                <div className="flex-1">
                  <div className="font-sans text-[12.5px] font-semibold">
                    {r.userName}{" "}
                    {r.verified && (
                      <span className="ks-chip !text-[9px] !py-0 !px-1.5 !ml-1">
                        verified
                      </span>
                    )}
                  </div>
                  {(r.userRole || r.createdAt) && (
                    <div className="font-sans text-[10.5px] text-ks-muted">
                      {r.userRole}
                      {r.userRole && r.createdAt && " \u00b7 "}
                      {formatTimeAgo(r.createdAt)}
                    </div>
                  )}
                </div>
                <Stars v={r.rating} size={11} showValue={false} />
              </div>
              {!isQuickRateText(r.text) && (
                <div className="font-sans text-[13px] leading-relaxed text-ks-ink2">
                  {r.text}
                </div>
              )}
              <div className="font-sans text-[11px] text-ks-muted mt-2.5">
                <button
                  onClick={() => handleHelpful(r.id)}
                  className={`hover:text-ks-ink cursor-pointer ${!session ? "opacity-50 pointer-events-none" : ""}`}
                >
                  &#128077; Helpful ({r.helpfulCount})
                </button>
              </div>
            </div>
          ))}

          {reviews.length === 0 && !session && (
            <div className="text-center py-8 font-sans text-[13px] text-ks-muted">
              No reviews yet. Sign in to be the first.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
