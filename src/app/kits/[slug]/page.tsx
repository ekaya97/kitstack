import { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import { Avatar } from "@/components/ui/avatar";
import { Stars } from "@/components/ui/stars";
import {
  ClaudeChat,
  ChatUser,
  ChatClaude,
  ToolCall,
  MCPApp,
} from "@/components/claude-chat/claude-chat";
import { PipelineKanban } from "@/components/mcp-apps/pipeline-kanban";
import { KITS, findKit, findSkill } from "@/data/kits";

export async function generateStaticParams() {
  return KITS.map((k) => ({ slug: k.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const kit = findKit(slug);
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
  const kit = findKit(slug);
  if (!kit) notFound();

  const linkedSkill = findSkill(kit.fromSkill);

  return (
    <div className="bg-ks-paper">
      <Nav active="Kits" />

      {/* ── HEADER ── */}
      <section className="px-12 pt-10 pb-14">
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

        <div className="grid grid-cols-[1fr_380px] gap-16 items-start">
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
            <h1 className="font-serif text-[64px] leading-[0.98] tracking-[-2px] text-ks-ink mb-5">
              {kit.name}
            </h1>

            {/* Description */}
            <p className="font-sans text-[17px] text-ks-muted leading-relaxed max-w-xl mb-6">
              {kit.desc}
            </p>

            {/* Author row */}
            <div className="flex items-center gap-3 mb-5">
              <Avatar name={kit.author} size={32} tone="#3b7a3b" />
              <span className="font-sans text-sm text-ks-ink">
                by <b>{kit.author}</b>{" "}
                <span className="text-green-700">&#10003;</span>
              </span>
            </div>

            {/* Rating / reviews / subscribers */}
            <div className="flex items-center gap-5">
              <Stars v={kit.rating} />
              <span className="font-sans text-[13px] text-ks-muted">
                {kit.reviews} reviews
              </span>
              <span className="font-sans text-[13px] text-ks-muted">
                {kit.subscribers.toLocaleString()} subscribers
              </span>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-4 gap-4 mt-8 pt-8 border-t border-ks-hair">
              <div>
                <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1.5">
                  REPLACES
                </div>
                <div className="font-sans text-sm text-ks-ink leading-snug">
                  {kit.replaces.map((r, i) => (
                    <span key={i}>
                      <span className="ks-strike">{r}</span>
                      {i < kit.replaces.length - 1 && ", "}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1.5">
                  SAVES
                </div>
                <div className="font-serif text-2xl text-ks-accent italic">
                  &euro;{kit.replacesValue}/mo
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1.5">
                  DB TABLES
                </div>
                <div className="font-serif text-2xl text-ks-ink">
                  {kit.schema.length}
                </div>
              </div>
              <div>
                <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1.5">
                  MCP TOOLS
                </div>
                <div className="font-serif text-2xl text-ks-ink">
                  {kit.tools.length}
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar — pricing card */}
          <div className="ks-card p-6 sticky top-8">
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2">
              SUBSCRIPTION KIT
            </div>
            <div className="font-serif text-[44px] text-ks-ink italic leading-none mb-1">
              &euro;5<span className="text-lg">/mo</span>
            </div>
            <div className="font-sans text-[13px] text-ks-muted mb-5">
              Starter plan &middot; unlocks every kit
            </div>

            <button className="ks-btn ks-btn-accent w-full justify-center !py-3.5 !text-[15px] mb-2.5">
              Connect to Claude &rarr;
            </button>
            <button className="ks-btn w-full justify-center !py-3 !text-[13px] mb-5">
              Try it free &middot; 1/day
            </button>

            {/* Action row */}
            <div className="flex justify-between border-t border-ks-hair pt-4 mb-5">
              <button className="font-sans text-xs text-ks-muted hover:text-ks-ink cursor-pointer">
                &#9825; Wishlist
              </button>
              <button className="font-sans text-xs text-ks-muted hover:text-ks-ink cursor-pointer">
                &#8679; Helpful
              </button>
              <button className="font-sans text-xs text-ks-muted hover:text-ks-ink cursor-pointer">
                &#8599; Share
              </button>
            </div>

            {/* Features checklist */}
            <div className="border-t border-ks-hair pt-4 flex flex-col gap-2">
              <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1">
                INCLUDES
              </div>
              {[
                "Per-user Turso database",
                `${kit.tools.length} MCP tools`,
                `${kit.uiComponents.length} interactive UI components`,
                `${kit.schema.length} database tables`,
                "Data export anytime",
                "Frankfurt-hosted, GDPR-first",
              ].map((f) => (
                <div
                  key={f}
                  className="font-sans text-[13px] text-ks-ink flex items-center gap-2"
                >
                  <span className="text-green-700 text-xs">&#10003;</span>
                  {f}
                </div>
              ))}
            </div>

            {/* Link to free skill */}
            {linkedSkill && (
              <div className="mt-5 pt-4 border-t border-ks-hair">
                <Link
                  href={`/skills/${linkedSkill.slug}`}
                  className="font-sans text-[13px] text-ks-accent hover:underline"
                >
                  Want just the basics? Try the free skill &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── STICKY TAB BAR ── */}
      <div className="sticky top-0 z-20 bg-ks-paper border-b border-ks-hair">
        <div className="px-12 flex gap-1.5 py-3">
          {[
            "See it work",
            "What's inside",
            "Setup",
            `Reviews (${kit.reviews})`,
          ].map((tab, i) => (
            <span
              key={tab}
              className={`font-sans text-[13px] font-medium px-4 py-2 rounded-full cursor-pointer transition-colors ${
                i === 0
                  ? "bg-ks-ink text-ks-paper"
                  : "text-ks-muted hover:bg-ks-paper-warm"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>
      </div>

      {/* ── SEE IT WORK ── */}
      <section className="px-12 py-16" id="see-it-work">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
          SEE IT WORK
        </div>
        <h2 className="font-serif text-[48px] tracking-tight mb-8">
          {kit.tagline}
        </h2>

        <div className="grid grid-cols-[1fr_1.2fr] gap-10">
          {/* Left — description + tool list */}
          <div>
            <p className="font-sans text-[15px] text-ks-muted leading-relaxed mb-6">
              {kit.desc} Every conversation adds to the record. Claude can call
              any of these tools whenever you ask.
            </p>

            <div className="ks-card p-5">
              <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-3">
                {kit.tools.length} MCP TOOLS
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
        className="px-12 py-16 bg-ks-paper-warm border-y border-ks-hair"
        id="whats-inside"
      >
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
          WHAT&apos;S INSIDE
        </div>
        <h2 className="font-serif text-[48px] tracking-tight mb-10">
          The three layers.
        </h2>

        <div className="grid grid-cols-3 gap-5">
          {/* Database layer */}
          <div className="ks-card overflow-hidden">
            <div className="bg-blue-600 px-5 py-3">
              <span className="font-mono text-[10px] text-white/80 tracking-wider">
                LAYER 1
              </span>
              <div className="font-serif text-[22px] text-white mt-0.5">
                Database
              </div>
              <div className="font-sans text-[12px] text-white/70">
                Per-user Turso &middot; Frankfurt
              </div>
            </div>
            <div className="p-5 flex flex-col gap-2">
              {kit.schema.map((table) => (
                <div
                  key={table}
                  className="font-mono text-[12px] px-3 py-2 rounded-md bg-blue-50 text-blue-800 border border-blue-200"
                >
                  {table}
                </div>
              ))}
            </div>
          </div>

          {/* MCP Tools layer */}
          <div className="ks-card overflow-hidden">
            <div className="bg-ks-accent px-5 py-3">
              <span className="font-mono text-[10px] text-white/80 tracking-wider">
                LAYER 2
              </span>
              <div className="font-serif text-[22px] text-white mt-0.5">
                MCP Tools
              </div>
              <div className="font-sans text-[12px] text-white/70">
                Claude calls these on your behalf
              </div>
            </div>
            <div className="p-5 flex flex-col gap-2">
              {kit.tools.map((tool) => (
                <div
                  key={tool}
                  className="font-mono text-[12px] px-3 py-2 rounded-md bg-orange-50 text-ks-accent-deep border border-orange-200"
                >
                  &#9674; {tool}
                </div>
              ))}
            </div>
          </div>

          {/* MCP App UI layer */}
          <div className="ks-card overflow-hidden">
            <div className="bg-green-700 px-5 py-3">
              <span className="font-mono text-[10px] text-white/80 tracking-wider">
                LAYER 3
              </span>
              <div className="font-serif text-[22px] text-white mt-0.5">
                MCP App UI
              </div>
              <div className="font-sans text-[12px] text-white/70">
                Interactive components in chat
              </div>
            </div>
            <div className="p-5 flex flex-col gap-2">
              {kit.uiComponents.map((comp) => (
                <div
                  key={comp}
                  className="font-sans text-[12px] px-3 py-2 rounded-md bg-green-50 text-green-800 border border-green-200"
                >
                  &#9635; {comp}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── SETUP ── */}
      <section className="px-12 py-16" id="setup">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
          SETUP
        </div>
        <h2 className="font-serif text-[48px] tracking-tight mb-10">
          Four steps. Five minutes.
        </h2>

        <div className="grid grid-cols-4 gap-4">
          {[
            {
              n: "01",
              title: "Subscribe",
              desc: "Pick Starter at \u20ac5/mo. Unlocks every kit in the catalogue.",
            },
            {
              n: "02",
              title: "Add connector",
              desc: (
                <>
                  In Claude &rarr; Settings &rarr; Connectors &rarr; paste{" "}
                  <code className="font-mono bg-ks-paper-warm px-1.5 py-0.5 rounded text-[11px]">
                    mcp.kitstack.co/mcp
                  </code>
                </>
              ),
            },
            {
              n: "03",
              title: "OAuth sign in",
              desc: "One-click auth. Your subscription and database are linked automatically.",
            },
            {
              n: "04",
              title: "Start a chat",
              desc: `"Show my pipeline." "Add this expense." Claude invokes ${kit.name} tools.`,
            },
          ].map((step) => (
            <div key={step.n} className="ks-card p-6">
              <div className="font-serif text-[56px] text-ks-accent italic leading-none">
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
      <section
        className="px-12 py-16 bg-ks-paper-warm border-y border-ks-hair"
        id="reviews"
      >
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
          REVIEWS
        </div>
        <h2 className="font-serif text-[48px] tracking-tight mb-10">
          What subscribers say.
        </h2>

        <div className="grid grid-cols-[300px_1fr] gap-12">
          {/* Left — rating summary */}
          <div className="ks-card p-6">
            <div className="font-serif text-[56px] text-ks-ink leading-none">
              {kit.rating}
            </div>
            <div className="font-sans text-[13px] text-ks-muted mb-3">
              out of 5
            </div>
            <Stars v={kit.rating} size={18} />
            <div className="font-sans text-[13px] text-ks-muted mt-1 mb-5">
              {kit.reviews} reviews
            </div>

            {/* Distribution bars */}
            {[
              { stars: 5, pct: 72 },
              { stars: 4, pct: 18 },
              { stars: 3, pct: 7 },
              { stars: 2, pct: 2 },
              { stars: 1, pct: 1 },
            ].map((row) => (
              <div key={row.stars} className="flex items-center gap-2.5 mb-1.5">
                <span className="font-mono text-[11px] text-ks-muted w-4 text-right">
                  {row.stars}
                </span>
                <div className="flex-1 h-2 bg-ks-paper-deep rounded-full overflow-hidden">
                  <div
                    className="h-full bg-ks-accent rounded-full"
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
                <span className="font-mono text-[10px] text-ks-muted w-8">
                  {row.pct}%
                </span>
              </div>
            ))}
          </div>

          {/* Right — review cards */}
          <div className="flex flex-col gap-4">
            {[
              {
                name: "Mira S.",
                role: "Freelance Designer",
                tone: "#3b7a3b",
                rating: 5,
                text: `Replaced Pipedrive entirely. I just say "log that call" and it's in the CRM. The pipeline kanban inside Claude is wild.`,
                helpful: 24,
              },
              {
                name: "Jan P.",
                role: "Agency Founder",
                tone: "#2b6cb0",
                rating: 5,
                text: `The proposal generator alone is worth it. But having it connected to a real contact database? That's the upgrade that sticks.`,
                helpful: 18,
              },
              {
                name: "Anja K.",
                role: "Ops Manager",
                tone: "#c94080",
                rating: 4,
                text: `Solid kit. Wish it had calendar integration, but the team says it's coming. Database export works perfectly.`,
                helpful: 11,
              },
            ].map((review) => (
              <div key={review.name} className="ks-card p-5">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={review.name} size={36} tone={review.tone} />
                  <div>
                    <div className="font-sans text-sm font-semibold text-ks-ink flex items-center gap-2">
                      {review.name}
                      <span className="ks-chip !text-[9px] !py-px !px-1.5 !border-green-300 !text-green-700">
                        verified
                      </span>
                    </div>
                    <div className="font-sans text-[12px] text-ks-muted">
                      {review.role}
                    </div>
                  </div>
                  <div className="ml-auto">
                    <Stars v={review.rating} size={12} showValue={false} />
                  </div>
                </div>
                <div className="font-sans text-[13.5px] text-ks-ink2 leading-relaxed">
                  {review.text}
                </div>
                <div className="mt-3 font-sans text-[12px] text-ks-muted">
                  &#8679; {review.helpful} found this helpful
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
