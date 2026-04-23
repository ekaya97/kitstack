import type { Metadata } from "next";
import Link from "next/link";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import { getAllKitCards } from "@/services/kit.service";
import { getAllSkillCards } from "@/services/skill.service";

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
    title: "@kitstack — KitStack",
    description:
      "Official KitStack team. We build, test, and ship the foundational skills and kits.",
  };
}

export default async function AuthorProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  await params;

  const [kits, skillCards] = await Promise.all([
    getAllKitCards(),
    getAllSkillCards(),
  ]);

  const totalDownloads = skillCards.reduce((s, sk) => s + sk.downloads, 0);
  const totalSubscribers = kits.reduce((s, k) => s + k.subscribers, 0);
  const allRatings = [
    ...skillCards.map((s) => s.rating),
    ...kits.map((k) => k.rating),
  ].filter((r) => r > 0);
  const avgRating =
    allRatings.length > 0
      ? (allRatings.reduce((s, r) => s + r, 0) / allRatings.length).toFixed(1)
      : "—";
  const totalReviews =
    skillCards.reduce((s, sk) => s + sk.reviews, 0) +
    kits.reduce((s, k) => s + k.reviews, 0);

  const pinnedKits = kits.slice(0, 3);

  return (
    <div className="bg-ks-paper min-h-screen">
      <Nav />

      <div className="px-12 pt-10 pb-16 grid grid-cols-[300px_1fr] gap-12 items-start">
        {/* LEFT SIDEBAR */}
        <aside className="sticky top-24">
          <div className="w-[240px] h-[240px] rounded-full bg-ks-ink border-4 border-ks-hair flex items-center justify-center mb-5">
            <span className="font-serif italic text-[96px] text-ks-paper leading-none select-none">
              K
            </span>
          </div>

          <div className="flex items-center gap-2 mb-0.5">
            <h1 className="font-serif text-[36px] tracking-tight leading-none">
              KitStack
            </h1>
            <span
              className="text-ks-accent text-[20px] leading-none"
              title="Verified"
            >
              &#10003;
            </span>
          </div>

          <div className="font-mono text-[14px] text-ks-muted mb-3">
            @kitstack
          </div>

          <p className="font-sans text-[14px] text-ks-ink2 leading-relaxed mb-5">
            Official KitStack team. We build, test, and ship the foundational
            skills and kits. Based in Germany.
          </p>

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
            <div className="flex items-center gap-2">
              <span className="text-[15px]">&#8962;</span>
              <span>D&uuml;sseldorf, DE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[15px]">&#9939;</span>
              <a
                href="https://kitstack.co"
                target="_blank"
                rel="noopener noreferrer"
                className="text-ks-accent hover:underline"
              >
                kitstack.co
              </a>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[15px]">&#9783;</span>
              <span>April 2026</span>
            </div>
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
        <main>
          <div className="flex gap-6 border-b border-ks-hair mb-8">
            <button className="font-sans text-[14px] font-semibold text-ks-ink pb-3 border-b-2 border-ks-accent">
              Published &middot; {skillCards.length + kits.length}
            </button>
          </div>

          {/* Impact stats */}
          <div className="grid grid-cols-4 gap-4 mb-10">
            <div className="ks-card p-4 text-center">
              <div className="font-serif text-[36px] text-ks-ink leading-none">
                {skillCards.length}
              </div>
              <div className="font-sans text-[12px] text-ks-muted mt-1">
                free skills
              </div>
            </div>
            <div className="ks-card p-4 text-center">
              <div className="font-serif text-[36px] text-ks-ink leading-none">
                {kits.length}
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
          <div className="mb-10">
            <h2 className="font-serif text-[22px] tracking-tight mb-4">
              Pinned kits
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

          {/* Free skills */}
          <div className="mb-10">
            <h2 className="font-serif text-[22px] tracking-tight mb-4">
              Free skills
            </h2>
            <div className="ks-card divide-y divide-ks-hair">
              {skillCards.map((skill) => (
                <Link
                  key={skill.slug}
                  href={`/skills/${skill.slug}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-ks-paper-warm transition-colors"
                >
                  <CatMark cat={skill.cat} size={24} />
                  <div className="flex-1 min-w-0">
                    <div className="font-sans text-[14px] font-medium text-ks-ink">
                      {skill.name}
                    </div>
                    <div className="font-sans text-[12px] text-ks-muted truncate">
                      {skill.desc}
                    </div>
                  </div>
                  <span className="ks-chip !text-[10px] shrink-0">
                    {skill.cat}
                  </span>
                  <span className="font-sans text-[12px] text-ks-muted shrink-0">
                    {skill.downloads.toLocaleString()} downloads
                  </span>
                  <span className="font-sans text-[12px] text-ks-muted shrink-0">
                    &#9733; {skill.rating}
                  </span>
                  <span className="font-serif text-[14px] italic text-ks-accent shrink-0">
                    Free
                  </span>
                </Link>
              ))}
            </div>
          </div>

          {/* All kits */}
          <div>
            <h2 className="font-serif text-[22px] tracking-tight mb-4">
              Subscription kits
            </h2>
            <div className="ks-card divide-y divide-ks-hair">
              {kits.map((kit) => (
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
