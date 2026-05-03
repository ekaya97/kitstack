export const dynamic = "force-dynamic";
"use client";

import { useState, useEffect, useCallback, Fragment } from "react";
import type { Review } from "@/db/schema";

type ReviewRow = Review & { helpfulCount: number };

type TypeFilter = "all" | "skill" | "kit";
type VerifiedFilter = "all" | "verified" | "unverified";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [verifiedFilter, setVerifiedFilter] = useState<VerifiedFilter>("all");
  const [deleteTarget, setDeleteTarget] = useState<ReviewRow | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toggling, setToggling] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchReviews = useCallback(async () => {
    const params = new URLSearchParams();
    if (typeFilter !== "all") params.set("targetType", typeFilter);
    if (verifiedFilter === "verified") params.set("verified", "true");
    if (verifiedFilter === "unverified") params.set("verified", "false");

    const res = await fetch(`/api/admin/reviews?${params.toString()}`);
    const data = await res.json();
    setReviews(data.reviews || []);
    setLoading(false);
  }, [typeFilter, verifiedFilter]);

  useEffect(() => {
    setLoading(true);
    fetchReviews();
  }, [fetchReviews]);

  async function handleToggleVerified(review: ReviewRow) {
    setToggling(review.id);
    await fetch(`/api/admin/reviews/${review.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verified: !review.verified }),
    });
    setToggling(null);
    fetchReviews();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/admin/reviews/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTarget(null);
    fetchReviews();
  }

  function formatDate(date: Date | null) {
    if (!date) return "--";
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function truncate(text: string, max: number) {
    if (text.length <= max) return text;
    return text.slice(0, max) + "...";
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-[28px] tracking-tight text-ks-ink">
            Reviews
          </h1>
          <p className="font-sans text-[13px] text-ks-muted mt-1">
            {reviews.length} reviews &middot; Moderate user reviews for skills
            and kits
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-4 mb-6">
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ks-muted mr-1">
            Type
          </span>
          {(["all", "skill", "kit"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={
                typeFilter === t
                  ? "ks-chip ks-chip-solid !text-[11px]"
                  : "ks-chip !text-[11px]"
              }
            >
              {t === "all" ? "All" : t === "skill" ? "Skills" : "Kits"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-ks-muted mr-1">
            Status
          </span>
          {(["all", "verified", "unverified"] as VerifiedFilter[]).map((v) => (
            <button
              key={v}
              onClick={() => setVerifiedFilter(v)}
              className={
                verifiedFilter === v
                  ? "ks-chip ks-chip-solid !text-[11px]"
                  : "ks-chip !text-[11px]"
              }
            >
              {v === "all"
                ? "All"
                : v === "verified"
                  ? "Verified"
                  : "Unverified"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="ks-card p-10 text-center">
          <div className="font-serif text-xl text-ks-muted mb-2">
            No reviews found
          </div>
          <p className="font-sans text-[13px] text-ks-muted">
            {typeFilter !== "all" || verifiedFilter !== "all"
              ? "Try adjusting the filters."
              : "No reviews have been submitted yet."}
          </p>
        </div>
      ) : (
        <div className="ks-card overflow-hidden">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-ks-paper-warm border-b border-ks-hair">
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  Target
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  User
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  Rating
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  Text
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  Verified
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  Helpful
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  Date
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <Fragment key={review.id}>
                  <tr
                    className="border-b border-ks-hair/50 hover:bg-ks-paper-warm/50 transition-colors cursor-pointer"
                    onClick={() =>
                      setExpandedId(
                        expandedId === review.id ? null : review.id,
                      )
                    }
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            review.targetType === "skill"
                              ? "ks-chip !text-[10px]"
                              : "ks-chip ks-chip-solid !text-[10px]"
                          }
                        >
                          {review.targetType}
                        </span>
                        <span className="font-mono text-[12px] text-ks-ink">
                          {review.targetSlug}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-sans text-[13px] text-ks-ink">
                        {review.userName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-[12px] text-ks-ink">
                        <span className="text-amber-500">&#9733;</span>{" "}
                        {review.rating}/5
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-sans text-[12px] text-ks-muted">
                        {truncate(review.text, 80)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {review.verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-green-700">
                          <span className="text-[8px]">&#9679;</span> yes
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ks-muted">
                          <span className="text-[8px]">&#9675;</span> no
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-ks-ink">
                      {review.helpfulCount}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ks-muted">
                      {formatDate(review.createdAt)}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <button
                          disabled={toggling === review.id}
                          onClick={() => handleToggleVerified(review)}
                          className="font-sans text-[12px] text-ks-accent hover:underline disabled:opacity-50"
                        >
                          {toggling === review.id
                            ? "..."
                            : review.verified
                              ? "Unverify"
                              : "Verify"}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(review)}
                          className="font-sans text-[12px] text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === review.id && (
                    <tr
                      key={`${review.id}-expanded`}
                      className="border-b border-ks-hair/50"
                    >
                      <td colSpan={8} className="px-4 py-4 bg-ks-paper-warm/30">
                        <div className="flex flex-col gap-2">
                          <div className="font-mono text-[10px] uppercase tracking-wider text-ks-muted">
                            Full Review
                          </div>
                          <p className="font-sans text-[13px] text-ks-ink leading-relaxed whitespace-pre-wrap">
                            {review.text}
                          </p>
                          <div className="flex items-center gap-4 mt-1">
                            <span className="font-mono text-[11px] text-ks-muted">
                              User ID: {review.userId}
                            </span>
                            {review.userRole && (
                              <span className="font-mono text-[11px] text-ks-muted">
                                Role: {review.userRole}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-ks-ink/40 backdrop-blur-sm"
            onClick={() => setDeleteTarget(null)}
          />
          <div className="relative bg-ks-paper border border-ks-hair rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="font-serif text-[22px] tracking-tight mb-2">
              Delete review?
            </h2>
            <p className="font-sans text-[13px] text-ks-muted mb-5">
              This will permanently delete the review by{" "}
              <span className="font-semibold text-ks-ink">
                {deleteTarget.userName}
              </span>{" "}
              on{" "}
              <span className="font-semibold text-ks-ink">
                {deleteTarget.targetSlug}
              </span>{" "}
              and all its helpful votes.
            </p>
            <div className="flex gap-2.5">
              <button
                onClick={() => setDeleteTarget(null)}
                className="ks-btn flex-1 justify-center !py-2.5 !text-[13px]"
              >
                Cancel
              </button>
              <button
                disabled={deleting}
                onClick={handleDelete}
                className="flex-1 font-sans text-[13px] font-medium py-2.5 px-4 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
