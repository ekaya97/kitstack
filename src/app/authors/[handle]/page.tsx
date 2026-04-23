import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import { ContribGrid } from "@/components/ui/contrib-grid";
import { KITS } from "@/data/kits";

const author = {
  handle: "kitstack",
  name: "KitStack",
  bio: "Official KitStack team. We build, test, and ship the foundational kits. Berlin-based.",
  verified: true,
  website: "kitstack.co",
  location: "Berlin, DE",
  joined: "April 2026",
  stats: { kits: 8, installs: 8000, stars: 1240, followers: 312 },
};

export function generateStaticParams() {
  return [{ handle: "kitstack" }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  await params;
  return {
    title: `@${author.handle} — KitStack`,
    description: author.bio,
  };
}

export default async function AuthorProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  await params;
  const pinnedKits = KITS.slice(0, 3);

  return (
    <div className="bg-ks-paper min-h-screen">
      <Nav active="Authors" />

      <div className="px-12 pt-10 pb-16 grid grid-cols-[300px_1fr] gap-12 items-start">
        {/* ── LEFT SIDEBAR ── */}
        <aside className="sticky top-24">
          {/* Avatar */}
          <div
            className="w-[240px] h-[240px] rounded-full bg-ks-ink border-4 border-ks-hair flex items-center justify-center mb-5"
          >
            <span className="font-serif italic text-[96px] text-ks-paper leading-none select-none">
              K
            </span>
          </div>

          {/* Name + verified */}
          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="font-serif text-[36px] tracking-tight leading-none">
              {author.name}
            </h1>
            {author.verified && (
              <span className="text-ks-accent text-[20px] leading-none" title="Verified">
                &#10003;
              </span>
            )}
          </div>

          {/* Handle */}
          <div className="font-mono text-[14px] text-ks-muted mb-3">
            @{author.handle}
          </div>

          {/* Bio */}
          <p className="font-sans text-[14px] text-ks-ink2 leading-relaxed mb-5">
            {author.bio}
          </p>

          {/* Action buttons */}
          <button className="ks-btn ks-btn-primary w-full mb-2">
            + Follow
          </button>
          <button className="ks-btn w-full mb-5">
            &#9993; Message
          </button>

          {/* Meta info */}
          <div className="flex flex-col gap-2 font-sans text-[13px] text-ks-muted mb-5">
            <div className="flex items-center gap-2">
              <span className="text-[15px]">&#8962;</span>
              <span>{author.location}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[15px]">&#9939;</span>
              <a
                href={`https://${author.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-ks-accent hover:underline"
              >
                {author.website}
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[15px]">&#9783;</span>
              <span>{author.joined}</span>
            </div>
          </div>

          {/* Followers / Stars */}
          <div className="border-t border-ks-hair pt-4 flex gap-6">
            <div>
              <div className="font-serif text-[22px] text-ks-ink leading-none">
                {author.stats.followers.toLocaleString()}
              </div>
              <div className="font-sans text-[11px] text-ks-muted mt-0.5">
                followers
              </div>
            </div>
            <div>
              <div className="font-serif text-[22px] text-ks-ink leading-none">
                {author.stats.stars.toLocaleString()}
              </div>
              <div className="font-sans text-[11px] text-ks-muted mt-0.5">
                stars
              </div>
            </div>
          </div>
        </aside>

        {/* ── RIGHT MAIN CONTENT ── */}
        <main>
          {/* Tab bar */}
          <div className="flex gap-6 border-b border-ks-hair mb-8">
            <button className="font-sans text-[14px] font-semibold text-ks-ink pb-3 border-b-2 border-ks-accent">
              Kits &middot; {author.stats.kits}
            </button>
            <button className="font-sans text-[14px] text-ks-muted pb-3 border-b-2 border-transparent hover:text-ks-ink">
              Pinned &middot; 3
            </button>
            <button className="font-sans text-[14px] text-ks-muted pb-3 border-b-2 border-transparent hover:text-ks-ink">
              Activity
            </button>
            <button className="font-sans text-[14px] text-ks-muted pb-3 border-b-2 border-transparent hover:text-ks-ink">
              About
            </button>
          </div>

          {/* Community authors note */}
          <div className="border-2 border-dashed border-ks-hair bg-ks-paper-warm rounded-lg p-5 mb-8 flex items-center justify-between">
            <p className="font-sans text-[14px] text-ks-muted">
              Community authors &mdash; coming later.
            </p>
            <button className="font-sans text-[13px] text-ks-accent hover:underline">
              Waitlist for authors &rarr;
            </button>
          </div>

          {/* Impact stats */}
          <div className="grid grid-cols-4 gap-4 mb-10">
            <div className="ks-card p-4 text-center">
              <div className="font-serif text-[36px] text-ks-ink leading-none">
                {author.stats.kits}
              </div>
              <div className="font-sans text-[12px] text-ks-muted mt-1">
                kits published
              </div>
            </div>
            <div className="ks-card p-4 text-center">
              <div className="font-serif text-[36px] text-ks-ink leading-none">
                {(author.stats.installs / 1000).toFixed(0)},000+
              </div>
              <div className="font-sans text-[12px] text-ks-muted mt-1">
                total installs
              </div>
            </div>
            <div className="ks-card p-4 text-center">
              <div className="font-serif text-[36px] text-ks-ink leading-none">
                4.8
              </div>
              <div className="font-sans text-[12px] text-ks-muted mt-1">
                avg rating
              </div>
            </div>
            <div className="ks-card p-4 text-center">
              <div className="font-serif text-[36px] text-ks-ink leading-none">
                &euro;32k+
              </div>
              <div className="font-sans text-[12px] text-ks-muted mt-1">
                revenue generated
              </div>
            </div>
          </div>

          {/* Shipping cadence */}
          <div className="mb-10">
            <h2 className="font-serif text-[22px] tracking-tight mb-4">
              Shipping cadence
            </h2>
            <div className="ks-card p-5">
              <ContribGrid w={14} h={7} cell={14} seed={7} />
              <div className="flex items-center gap-2 mt-3 font-sans text-[11px] text-ks-muted">
                <span>Less</span>
                <span
                  className="inline-block w-[14px] h-[14px] rounded-sm"
                  style={{ background: "#ece3d1" }}
                />
                <span
                  className="inline-block w-[14px] h-[14px] rounded-sm"
                  style={{ background: "#f7d9c8" }}
                />
                <span
                  className="inline-block w-[14px] h-[14px] rounded-sm"
                  style={{ background: "#f0a57f" }}
                />
                <span
                  className="inline-block w-[14px] h-[14px] rounded-sm"
                  style={{ background: "#e6784b" }}
                />
                <span
                  className="inline-block w-[14px] h-[14px] rounded-sm"
                  style={{ background: "#d65a2f" }}
                />
                <span>More</span>
              </div>
            </div>
          </div>

          {/* Pinned kits */}
          <div className="mb-10">
            <h2 className="font-serif text-[22px] tracking-tight mb-4">
              Pinned
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {pinnedKits.map((kit) => (
                <Link
                  key={kit.slug}
                  href={`/kits/${kit.slug}`}
                  className="ks-card p-4 hover:border-ks-accent transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <CatMark cat={kit.cat} />
                    <span className="font-mono text-[12px] text-ks-muted">
                      {kit.slug}
                    </span>
                  </div>
                  <p className="font-sans text-[13px] text-ks-ink2 leading-relaxed mb-3">
                    {kit.tagline}
                  </p>
                  <div className="flex items-center justify-between">
                    <span className="font-sans text-[12px] text-ks-muted">
                      &#9733; {kit.rating}
                    </span>
                    <span className="font-sans text-[12px] text-ks-muted">
                      {kit.subscribers.toLocaleString()} subscribers
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* All kits table */}
          <div>
            <h2 className="font-serif text-[22px] tracking-tight mb-4">
              All kits
            </h2>
            <div className="ks-card divide-y divide-ks-hair">
              {KITS.map((kit) => (
                <Link
                  key={kit.slug}
                  href={`/kits/${kit.slug}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-ks-paper-warm transition-colors"
                >
                  <CatMark cat={kit.cat} size={24} />
                  <div className="flex-1 min-w-0">
                    <div className="font-sans text-[14px] font-medium text-ks-ink">
                      {kit.name}
                    </div>
                    <div className="font-sans text-[12px] text-ks-muted truncate">
                      {kit.desc}
                    </div>
                  </div>
                  <span className="ks-chip !text-[10px] shrink-0">
                    {kit.cat}
                  </span>
                  <span className="font-sans text-[12px] text-ks-muted shrink-0 ks-strike">
                    {kit.replaces[0]}
                  </span>
                  <span className="font-sans text-[12px] text-ks-muted shrink-0">
                    &#9733; {kit.rating}
                  </span>
                  <span className="font-serif text-[14px] italic text-ks-ink shrink-0">
                    &euro;5/mo
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
