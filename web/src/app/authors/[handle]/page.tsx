export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import { getAuthorByHandle } from "@/services/author.service";
import { getAllKitCards } from "@/services/kit.service";
import { getAllSkillCards } from "@/services/skill.service";
import { AuthorCTA } from "@/components/shared/author-cta";
import { ExpandableSkillList } from "@/components/shared/expandable-skill-list";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const author = await getAuthorByHandle(handle);
  if (!author) return { title: "Author not found" };
  return {
    title: `@${author.handle} — KitStack`,
    description: author.bio || `${author.displayName} on KitStack`,
  };
}

export default async function AuthorProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const author = await getAuthorByHandle(handle);
  if (!author) notFound();

  const [kits, skillCards] = await Promise.all([
    getAllKitCards(),
    getAllSkillCards(),
  ]);

  // Filter to this author's content
  const authorKits = kits.filter((k) => k.author === author.handle);
  const authorSkills = skillCards.filter((s) => s.author === author.handle);

  const totalDownloads = authorSkills.reduce((s, sk) => s + sk.downloads, 0);
  const totalSubscribers = authorKits.reduce((s, k) => s + k.subscribers, 0);
  const allRatings = [
    ...authorSkills.map((s) => s.rating),
    ...authorKits.map((k) => k.rating),
  ].filter((r) => r > 0);
  const avgRating =
    allRatings.length > 0
      ? (allRatings.reduce((s, r) => s + r, 0) / allRatings.length).toFixed(1)
      : "—";
  const totalReviews =
    authorSkills.reduce((s, sk) => s + sk.reviews, 0) +
    authorKits.reduce((s, k) => s + k.reviews, 0);

  const pinnedKits = authorKits.slice(0, 3);

  return (
    <div className="bg-ks-paper min-h-screen flex flex-col overflow-x-hidden">
      <Nav />

      <div className="px-4 sm:px-8 lg:px-12 pt-10 pb-16 grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr] gap-8 lg:gap-12 items-start min-w-0">
        {/* LEFT SIDEBAR */}
        <aside className="md:sticky md:top-24">
          {/* Avatar */}
          {author.avatarUrl ? (
            <div className="w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] md:w-[240px] md:h-[240px] rounded-full border-4 border-ks-hair overflow-hidden mb-5 bg-ks-ink flex items-center justify-center">
              {author.avatarUrl.endsWith(".svg") ? (
                <div className="w-[120px] h-[120px]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={author.avatarUrl}
                    alt={author.displayName}
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <Image
                  src={author.avatarUrl}
                  alt={author.displayName}
                  width={240}
                  height={240}
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          ) : (
            <div className="w-[160px] h-[160px] sm:w-[200px] sm:h-[200px] md:w-[240px] md:h-[240px] rounded-full bg-ks-ink border-4 border-ks-hair flex items-center justify-center mb-5">
              <span className="font-serif italic text-[96px] text-ks-paper leading-none select-none">
                {author.displayName.charAt(0)}
              </span>
            </div>
          )}

          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="font-serif text-[28px] sm:text-[32px] md:text-[36px] tracking-tight leading-none">
              {author.displayName}
            </h1>
            {author.verified && (
              <span
                className="text-ks-accent text-[20px] leading-none"
                title="Verified"
              >
                &#10003;
              </span>
            )}
          </div>

          <div className="font-mono text-[14px] text-ks-muted mb-3">
            @{author.handle}
          </div>

          {author.bio && (
            <p className="font-sans text-[14px] text-ks-ink2 leading-relaxed mb-5">
              {author.bio}
            </p>
          )}

          <Link
            href="/skills"
            className="ks-btn ks-btn-primary w-full mb-2 justify-center"
          >
            Browse skills
          </Link>
          <Link
            href="/kits"
            className="ks-btn w-full mb-5 justify-center"
          >
            Browse kits
          </Link>

          <div className="flex flex-col gap-2 font-sans text-[13px] text-ks-muted mb-5">
            {author.location && (
              <div className="flex items-center gap-2">
                <span className="text-[15px]">&#8962;</span>
                <span>{author.location}</span>
              </div>
            )}
            {author.website && (
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
            )}
          </div>

          <div className="border-t border-ks-hair pt-4 flex gap-6">
            <div>
              <div className="font-serif text-[22px] text-ks-ink leading-none">
                {totalSubscribers.toLocaleString()}
              </div>
              <div className="font-sans text-[11px] text-ks-muted mt-0.5">
                subscribers
              </div>
            </div>
            <div>
              <div className="font-serif text-[22px] text-ks-ink leading-none">
                {totalDownloads.toLocaleString()}
              </div>
              <div className="font-sans text-[11px] text-ks-muted mt-0.5">
                downloads
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN */}
        <main className="min-w-0">
          {/* Author CTA */}
          <div className="mb-10">
            <AuthorCTA />
          </div>
          <div className="flex gap-6 border-b border-ks-hair mb-8">
            <button className="font-sans text-[14px] font-semibold text-ks-ink pb-3 border-b-2 border-ks-accent">
              Published &middot; {authorSkills.length + authorKits.length}
            </button>
          </div>

          {/* Impact stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
            <div className="ks-card p-4 text-center">
              <div className="font-serif text-[36px] text-ks-ink leading-none">
                {authorSkills.length}
              </div>
              <div className="font-sans text-[12px] text-ks-muted mt-1">
                free skills
              </div>
            </div>
            <div className="ks-card p-4 text-center">
              <div className="font-serif text-[36px] text-ks-ink leading-none">
                {authorKits.length}
              </div>
              <div className="font-sans text-[12px] text-ks-muted mt-1">
                subscription kits
              </div>
            </div>
            <div className="ks-card p-4 text-center">
              <div className="font-serif text-[36px] text-ks-ink leading-none">
                {avgRating}
              </div>
              <div className="font-sans text-[12px] text-ks-muted mt-1">
                avg rating ({totalReviews.toLocaleString()} reviews)
              </div>
            </div>
            <div className="ks-card p-4 text-center">
              <div className="font-serif text-[36px] text-ks-ink leading-none">
                {totalDownloads.toLocaleString()}
              </div>
              <div className="font-sans text-[12px] text-ks-muted mt-1">
                skill downloads
              </div>
            </div>
          </div>

          {/* Pinned kits */}
          {pinnedKits.length > 0 && (
            <div className="mb-10">
              <h2 className="font-serif text-[22px] tracking-tight mb-4">
                Pinned kits
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          )}

          {/* Subscription kits */}
          {authorKits.length > 0 && (
            <div className="mb-10">
              <h2 className="font-serif text-[22px] tracking-tight mb-4">
                Subscription kits
              </h2>
              <div className="ks-card divide-y divide-ks-hair">
                {authorKits.map((kit) => (
                  <Link
                    key={kit.slug}
                    href={`/kits/${kit.slug}`}
                    className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-ks-paper-warm transition-colors"
                  >
                    <CatMark cat={kit.cat} size={24} />
                    <div className="flex-1 min-w-0 basis-[180px]">
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
                    <span className="font-serif text-[14px] italic text-ks-ink shrink-0">
                      &euro;5/mo
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Free skills */}
          {authorSkills.length > 0 && (
            <div>
              <h2 className="font-serif text-[22px] tracking-tight mb-4">
                Free skills
              </h2>
              <ExpandableSkillList skills={authorSkills} />
            </div>
          )}

        </main>
      </div>

      <Footer />
    </div>
  );
}
