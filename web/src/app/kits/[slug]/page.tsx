import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import { Avatar } from "@/components/ui/avatar";
import {
  ClaudeChat,
  ChatUser,
  ChatClaude,
  ToolCall,
  MCPApp,
} from "@/components/claude-chat/claude-chat";
import { PipelineKanban } from "@/components/mcp-apps/pipeline-kanban";
import { getAllKitCards, getKitCardBySlug } from "@/services/kit.service";
import { getSkillCardBySlug } from "@/services/skill.service";
import { getReviewsByTarget, getRatingDistribution } from "@/services/review.service";
import { ScrollTabs } from "@/components/shared/scroll-tabs";
import { HeaderRating } from "@/components/reviews/header-rating";
import { ReviewSection } from "@/components/reviews/review-section";
import { AppPreviewTabs } from "@/components/shared/app-preview-tabs";
import { KitActivateCard } from "@/components/shared/kit-activate-card";

export async function generateStaticParams() {
  const kits = await getAllKitCards();
  return kits.map((k) => ({ slug: k.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const kit = await getKitCardBySlug(slug);
  if (!kit) return { title: "Kit not found" };
  return {
    title: `${kit.name} — KitStack`,
    description: kit.desc,
  };
}

export default async function KitDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const kit = await getKitCardBySlug(slug);
  if (!kit) notFound();

  const linkedSkill = kit.fromSkill ? await getSkillCardBySlug(kit.fromSkill) : null;
  const reviewsList = await getReviewsByTarget("kit", slug);
  const distribution = await getRatingDistribution("kit", slug);

  return (
    <div className="bg-ks-paper min-h-screen flex flex-col">
      <Nav active="Kits" />

      {/* ── HEADER ── */}
      <section className="px-4 sm:px-8 lg:px-12 pt-10 pb-14">
        {/* Breadcrumb */}
        <div className="font-sans text-[13px] text-ks-muted mb-6 flex items-center gap-1.5">
          <Link href="/" className="hover:text-ks-ink">
            Home
          </Link>
          <span>/</span>
          <Link href="/kits" className="hover:text-ks-ink">
            Kits
          </Link>
          <span>/</span>
          <span className="text-ks-ink font-medium">{kit.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-16 items-start">
          {/* Left column */}
          <div>
            {/* Category + status chips */}
            <div className="flex items-center gap-2 mb-5">
              <span className="ks-chip">
                <CatMark cat={kit.cat} size={14} />
                {kit.cat}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-green-700">
                <span className="w-[7px] h-[7px] rounded-full bg-green-600" />
                live
              </span>
              <span className="ks-chip ks-chip-soft !text-[10px]">
                &euro;5/mo Starter unlocks
              </span>
            </div>

            {/* Title */}
            <h1 className="font-serif text-[28px] sm:text-[48px] lg:text-[64px] leading-[0.98] tracking-[-2px] text-ks-ink mb-5">
              {kit.name}
            </h1>

            {/* Description */}
            <p className="font-sans text-[17px] text-ks-muted leading-relaxed max-w-xl mb-6">
              {kit.desc}
            </p>

            {/* Author row + Rating inline */}
            <div className="flex items-center gap-4 flex-wrap mb-6">
              <Link href={`/authors/${kit.author}`} className="flex items-center gap-2.5 group">
                <Avatar name={kit.author} size={28} tone="#3b7a3b" />
                <span className="font-sans text-[13px] text-ks-ink group-hover:text-ks-accent">
                  by <b>{kit.author}</b>{" "}
                  <span className="text-green-700">&#10003;</span>
                </span>
              </Link>
              <div className="w-px h-5 bg-ks-hair" />
              <HeaderRating
                targetType="kit"
                targetSlug={slug}
                rating={kit.rating}
                count={kit.reviews}
              />
              <span className="font-sans text-[12px] text-ks-muted">
                {kit.subscribers.toLocaleString()} subscribers
              </span>
              <div className="w-px h-5 bg-ks-hair" />
              <span className="font-sans text-[12px] text-ks-muted">
                replaces{" "}
                {kit.replaces.map((r, i) => (
                  <span key={i}>
                    <span className="ks-strike">{r}</span>
                    {i < kit.replaces.length - 1 && ", "}
                  </span>
                ))}
                {" "}&mdash; saves <b className="text-ks-accent">&euro;{kit.replacesValue}/mo</b>
              </span>
            </div>

            {/* Includes */}
            <div className="flex flex-col gap-1.5 mt-6">
              <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-0.5">
                INCLUDES
              </div>
              {[
                "Your own private database",
                `${kit.tools.length} built-in actions`,
                `${kit.uiComponents.length} interactive views`,
                `${kit.schema.length} data types`,
                "Data export anytime",
                "EU-hosted, your data stays private",
              ].map((f) => (
                <div
                  key={f}
                  className="font-sans text-[12.5px] text-ks-ink flex items-center gap-2"
                >
                  <span className="text-green-700 text-xs">&#10003;</span>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Right sidebar — activation card */}
          <KitActivateCard
            kitSlug={kit.slug}
            kitName={kit.name}
            toolCount={kit.tools.length}
            uiCount={kit.uiComponents.length}
            schemaCount={kit.schema.length}
            linkedSkillSlug={linkedSkill?.slug}
          />
        </div>
      </section>

      {/* ── STICKY TAB BAR ── */}
      <ScrollTabs
        tabs={[
          { id: "see-it-work", label: "See it work" },
          { id: "whats-inside", label: "What's inside" },
          { id: "setup", label: "Setup" },
          { id: "reviews", label: `Reviews (${kit.reviews})` },
        ]}
      />

      {/* ── SEE IT WORK ── */}
      <section className="px-4 sm:px-8 lg:px-12 py-16" id="see-it-work">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
          SEE IT WORK
        </div>
        <h2 className="font-serif text-[26px] sm:text-[36px] lg:text-[48px] tracking-tight mb-8">
          {kit.tagline}
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6 lg:gap-10">
          {/* Left — description + tool list */}
          <div>
            <p className="font-sans text-[15px] text-ks-muted leading-relaxed mb-6">
              {kit.desc} Every conversation adds to the record. Claude can call
              any of these tools whenever you ask.
            </p>

            <div className="ks-card p-5">
              <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-3">
                {kit.tools.length} BUILT-IN ACTIONS
              </div>
              <div className="flex flex-wrap gap-1.5">
                {kit.tools.map((t) => (
                  <span
                    key={t}
                    className="font-mono text-[11px] px-2.5 py-1 rounded-md bg-ks-paper-warm text-ks-ink border border-ks-hair"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="ks-card p-5 mt-4">
              <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-3">
                {kit.uiComponents.length} UI COMPONENTS
              </div>
              <div className="flex flex-wrap gap-1.5">
                {kit.uiComponents.map((c) => (
                  <span
                    key={c}
                    className="font-sans text-[12px] px-2.5 py-1 rounded-md bg-ks-paper-warm text-ks-ink border border-ks-hair"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Right — Claude chat demo */}
          <div>
            <ClaudeChat title={`Claude · with ${kit.name}`}>
              <ChatUser>Show me my pipeline.</ChatUser>
              <ToolCall tool="pipeline_dashboard" />
              <ChatClaude>
                Here&apos;s your current pipeline. You have 6 open deals worth
                &euro;113,000 total:
              </ChatClaude>
              <MCPApp title="pipeline_dashboard">
                <PipelineKanban />
              </MCPApp>
              <ChatClaude>
                Helix GmbH (&euro;45k) is in negotiation &mdash; want me to
                draft a follow-up email?
              </ChatClaude>
            </ClaudeChat>
          </div>
        </div>
      </section>

      {/* ── WHAT'S INSIDE ── */}
      <section
        className="px-4 sm:px-8 lg:px-12 py-16 bg-ks-paper-warm border-y border-ks-hair"
        id="whats-inside"
      >
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
          WHAT&apos;S INSIDE
        </div>
        <h2 className="font-serif text-[26px] sm:text-[36px] lg:text-[48px] tracking-tight mb-3">
          {kit.uiComponents.length} interactive views.
        </h2>
        <p className="font-sans text-[15px] text-ks-muted mb-8 max-w-xl leading-relaxed">
          These are the actual screens that render inside your chat. Click through them with sample data.
        </p>

        <AppPreviewTabs kitSlug={slug} />
      </section>

      {/* ── SETUP ── */}
      <section className="px-4 sm:px-8 lg:px-12 py-16" id="setup">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
          SETUP
        </div>
        <h2 className="font-serif text-[26px] sm:text-[36px] lg:text-[48px] tracking-tight mb-10">
          Four steps. Five minutes.
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              n: "01",
              title: "Subscribe",
              desc: "Pick Starter at \u20ac5/mo. Unlocks every kit in the catalogue.",
            },
            {
              n: "02",
              title: "Add to Claude",
              desc: "Open Claude, go to Settings, and add KitStack as a connector. Takes 10 seconds.",
            },
            {
              n: "03",
              title: "Sign in",
              desc: "One-click sign in. Your subscription and data are linked automatically.",
            },
            {
              n: "04",
              title: "Start a chat",
              desc: `"Show my pipeline." "Add this expense." Claude uses ${kit.name} on your behalf.`,
            },
          ].map((step) => (
            <div key={step.n} className="ks-card p-6">
              <div className="font-serif text-[28px] sm:text-[42px] lg:text-[56px] text-ks-accent italic leading-none">
                {step.n}
              </div>
              <div className="font-serif text-[22px] mt-3">{step.title}</div>
              <div className="font-sans text-[13px] text-ks-muted mt-2 leading-relaxed">
                {step.desc}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── REVIEWS ── */}
      <ReviewSection
        targetType="kit"
        targetSlug={slug}
        initialReviews={reviewsList}
        initialDistribution={distribution}
        initialRating={kit.rating}
        initialCount={kit.reviews}
      />

      <Footer />
    </div>
  );
}
