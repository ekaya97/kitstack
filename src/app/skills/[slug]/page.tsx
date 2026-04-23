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
} from "@/components/claude-chat/claude-chat";
import { SKILLS, findSkill, findKit } from "@/data/kits";

export async function generateStaticParams() {
  return SKILLS.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const skill = findSkill(slug);
  if (!skill) return { title: "Skill not found" };
  return {
    title: `${skill.name} — KitStack`,
    description: skill.desc,
  };
}

/* ── File tree items for the "What's inside" section ── */
const FILE_TREE = [
  { name: "README.md", indent: 0, icon: "doc" },
  { name: "system-prompt.md", indent: 0, icon: "doc" },
  { name: "templates/", indent: 0, icon: "dir" },
  { name: "exec-summary.md", indent: 1, icon: "doc" },
  { name: "scope-table.md", indent: 1, icon: "doc" },
  { name: "pricing-table.md", indent: 1, icon: "doc" },
  { name: "terms.md", indent: 1, icon: "doc" },
  { name: "examples/", indent: 0, icon: "dir" },
  { name: "sample-brief.md", indent: 1, icon: "doc" },
  { name: "sample-output.md", indent: 1, icon: "doc" },
];

const FILE_DESCRIPTIONS = [
  {
    title: "System prompt",
    desc: "The core instruction set. Defines the expert persona, output format, and anti-slop rules.",
    file: "system-prompt.md",
  },
  {
    title: "Templates",
    desc: "Markdown templates for each proposal section. Structured placeholders Claude fills from your brief.",
    file: "templates/",
  },
  {
    title: "Examples",
    desc: "Sample input and output pairs so Claude calibrates tone, length, and detail level.",
    file: "examples/",
  },
];

export default async function SkillDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const skill = findSkill(slug);
  if (!skill) notFound();

  const upgradeKit = skill.upgradeTo ? findKit(skill.upgradeTo) : null;

  return (
    <div className="bg-ks-paper">
      <Nav active="Skills" />

      {/* ── HEADER ── */}
      <section className="px-12 pt-10 pb-14">
        {/* Breadcrumb */}
        <div className="font-sans text-[13px] text-ks-muted mb-6 flex items-center gap-1.5">
          <Link href="/" className="hover:text-ks-ink">
            Home
          </Link>
          <span>/</span>
          <Link href="/skills" className="hover:text-ks-ink">
            Skills
          </Link>
          <span>/</span>
          <span className="text-ks-ink font-medium">{skill.name}</span>
        </div>

        <div className="grid grid-cols-[1fr_380px] gap-16 items-start">
          {/* Left column */}
          <div>
            {/* Category + free chip */}
            <div className="flex items-center gap-2 mb-5">
              <span className="ks-chip">
                <CatMark cat={skill.cat} size={14} />
                {skill.cat}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium px-2.5 py-[3px] rounded-full bg-green-100 text-green-800 border border-green-300">
                FREE &middot; no signup
              </span>
            </div>

            {/* Title */}
            <h1 className="font-serif text-[64px] leading-[0.98] tracking-[-2px] text-ks-ink mb-5">
              {skill.name}
            </h1>

            {/* Description */}
            <p className="font-sans text-[17px] text-ks-muted leading-relaxed max-w-xl mb-6">
              {skill.desc}
            </p>

            {/* Author row */}
            <div className="flex items-center gap-3 mb-5">
              <Avatar name={skill.author} size={32} tone="#3b7a3b" />
              <span className="font-sans text-sm text-ks-ink">
                by <b>{skill.author}</b>{" "}
                <span className="text-green-700">&#10003;</span>
              </span>
            </div>

            {/* Rating / downloads / file info */}
            <div className="flex items-center gap-5">
              <Stars v={skill.rating} />
              <span className="font-sans text-[13px] text-ks-muted">
                {skill.downloads.toLocaleString()} downloads
              </span>
              <span className="font-sans text-[13px] text-ks-muted">
                {skill.files} files &middot; {skill.size}
              </span>
            </div>
          </div>

          {/* Right sidebar — download card */}
          <div className="sticky top-8 flex flex-col gap-4">
            <div className="ks-card p-6">
              <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2">
                FREE SKILL
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-serif text-[44px] text-ks-ink italic leading-none">
                  &euro;0
                </span>
                <span className="font-sans text-[13px] text-ks-muted">
                  forever free
                </span>
              </div>
              <div className="font-sans text-[12px] text-ks-muted mb-5">
                .zip &middot; {skill.files} files &middot; {skill.size}
              </div>

              <button className="ks-btn ks-btn-primary w-full justify-center !py-3.5 !text-[15px] mb-2.5">
                Download free &darr;
              </button>
              <button className="ks-btn w-full justify-center !py-3 !text-[13px] mb-5">
                Try it first &middot; 1 free/day
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

              {/* Features list */}
              <div className="border-t border-ks-hair pt-4 flex flex-col gap-2">
                <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1">
                  INCLUDES
                </div>
                {[
                  "System prompt with expert persona",
                  `${skill.files} structured templates`,
                  "Example input/output pairs",
                  "Works in Claude, ChatGPT, VS Code",
                  "No account, no server, no API key",
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
            </div>

            {/* Upgrade card */}
            {upgradeKit && (
              <div className="ks-card-ink p-5">
                <div className="font-mono text-[10px] text-ks-accent tracking-wider mb-2">
                  UPGRADE AVAILABLE
                </div>
                <div className="font-serif text-[20px] text-ks-paper leading-tight mb-2">
                  {upgradeKit.name}
                </div>
                <div className="font-sans text-[13px] text-ks-paper-deep leading-relaxed mb-4">
                  {skill.upgradeHook}
                </div>
                <Link
                  href={`/kits/${upgradeKit.slug}`}
                  className="ks-btn ks-btn-accent w-full justify-center !py-2.5 !text-[13px]"
                >
                  See the kit &rarr;
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
            ...(upgradeKit ? ["Upgrade path"] : []),
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
          One prompt. Full output.
        </h2>

        <div className="max-w-2xl mx-auto">
          <ClaudeChat title={`Claude · with ${skill.name}`}>
            <ChatUser>
              Write a proposal for Acme Bakery. 6-week brand refresh, budget
              &euro;18,000. Include exec summary, phased scope, and pricing
              table.
            </ChatUser>
            <ChatClaude>
              <div className="mb-2">
                Here&apos;s your proposal for Acme Bakery:
              </div>
              <div className="bg-ks-paper-warm rounded-lg p-4 font-mono text-[11px] text-ks-ink2 leading-relaxed">
                <div className="font-sans text-[13px] font-semibold mb-2">
                  Proposal: Brand Refresh for Acme Bakery
                </div>
                <div className="text-ks-muted mb-2">
                  <b>Executive Summary</b>
                </div>
                <div className="mb-3">
                  A 6-week engagement to modernize Acme Bakery&apos;s visual
                  identity and digital presence. Three phases: Discovery &amp;
                  Audit, Design System, Implementation...
                </div>
                <div className="text-ks-muted mb-2">
                  <b>Phased Scope</b>
                </div>
                <div className="mb-1">
                  Phase 1 (Wk 1-2): Discovery &amp; Audit &mdash; &euro;4,500
                </div>
                <div className="mb-1">
                  Phase 2 (Wk 3-4): Design System &mdash; &euro;7,500
                </div>
                <div className="mb-3">
                  Phase 3 (Wk 5-6): Implementation &mdash; &euro;6,000
                </div>
                <div className="text-ks-muted mb-2">
                  <b>Pricing Table</b>
                </div>
                <div className="border border-ks-hair rounded p-2 bg-white text-[10px]">
                  <div className="grid grid-cols-3 gap-2 font-semibold border-b border-ks-hair pb-1 mb-1">
                    <span>Phase</span>
                    <span>Duration</span>
                    <span>Cost</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>Discovery</span>
                    <span>2 weeks</span>
                    <span>&euro;4,500</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>Design</span>
                    <span>2 weeks</span>
                    <span>&euro;7,500</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>Implementation</span>
                    <span>2 weeks</span>
                    <span>&euro;6,000</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-semibold border-t border-ks-hair pt-1 mt-1">
                    <span>Total</span>
                    <span>6 weeks</span>
                    <span>&euro;18,000</span>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-ks-muted text-[12px]">
                [+ Terms &amp; conditions section, ~2 pages total]
              </div>
            </ChatClaude>
          </ClaudeChat>
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
          {skill.files} files. One .zip.
        </h2>

        <div className="grid grid-cols-[340px_1fr] gap-10">
          {/* Left — dark file tree */}
          <div className="bg-ks-ink rounded-xl p-5 self-start">
            <div className="font-mono text-[10px] text-ks-faint tracking-wider mb-3">
              {skill.slug}.zip
            </div>
            {FILE_TREE.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-2 py-[3px]"
                style={{ paddingLeft: f.indent * 16 }}
              >
                <span className="text-[12px]">
                  {f.icon === "dir" ? (
                    <span className="text-ks-accent">&#9654;</span>
                  ) : (
                    <span className="text-ks-faint">&#9643;</span>
                  )}
                </span>
                <span
                  className={`font-mono text-[12px] ${
                    f.icon === "dir"
                      ? "text-ks-paper font-medium"
                      : "text-ks-paper-deep"
                  }`}
                >
                  {f.name}
                </span>
              </div>
            ))}
          </div>

          {/* Right — file descriptions */}
          <div className="flex flex-col gap-4">
            {FILE_DESCRIPTIONS.map((fd) => (
              <div key={fd.file} className="ks-card p-5">
                <div className="flex items-center gap-2.5 mb-2">
                  <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-ks-paper-warm text-ks-muted border border-ks-hair">
                    {fd.file}
                  </span>
                </div>
                <div className="font-serif text-[20px] text-ks-ink mb-1.5">
                  {fd.title}
                </div>
                <div className="font-sans text-[13px] text-ks-muted leading-relaxed">
                  {fd.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SETUP ── */}
      <section className="px-12 py-16" id="setup">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
          SETUP
        </div>
        <h2 className="font-serif text-[48px] tracking-tight mb-10">
          Download. Upload. Chat.
        </h2>

        <div className="grid grid-cols-4 gap-4">
          {[
            {
              n: "01",
              title: "Download",
              desc: "Click the download button above. You get a .zip file with everything inside.",
            },
            {
              n: "02",
              title: "Open Claude",
              desc: "Go to claude.ai (or ChatGPT, or VS Code). Open a new conversation.",
            },
            {
              n: "03",
              title: "Upload",
              desc: "Drag the .zip into Claude's Skills folder, or upload it as a project file.",
            },
            {
              n: "04",
              title: "Chat",
              desc: `Tell Claude what you need. The skill's system prompt and templates kick in automatically.`,
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

      {/* ── UPGRADE PATH ── */}
      {upgradeKit && (
        <section
          className="px-12 py-16 bg-ks-ink text-ks-paper"
          id="upgrade-path"
        >
          <div className="font-mono text-[11px] text-ks-accent tracking-[1px] mb-2">
            UPGRADE PATH
          </div>
          <h2 className="font-serif text-[48px] tracking-tight mb-3">
            Love the skill?{" "}
            <span className="italic text-ks-accent">Add memory.</span>
          </h2>
          <p className="font-sans text-[15px] text-ks-paper-deep leading-relaxed mb-10 max-w-xl">
            The free skill gives you great output. The kit version remembers
            everything, adds a database, and renders interactive UI inside your
            chat.
          </p>

          <div className="grid grid-cols-2 gap-6">
            {/* Skill side (free, dimmed) */}
            <div className="border-2 border-dashed border-ks-ink2 rounded-xl p-7 opacity-70">
              <div className="font-mono text-[10px] text-ks-faint tracking-wider mb-3">
                FREE SKILL
              </div>
              <div className="font-serif text-[28px] text-ks-paper-deep leading-tight mb-4">
                {skill.name}
              </div>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: "Download .zip", included: true },
                  { label: "System prompt + templates", included: true },
                  { label: "Works in Claude, ChatGPT, VS Code", included: true },
                  { label: "Memory between sessions", included: false },
                  { label: "Database with your data", included: false },
                  { label: "Interactive UI in chat", included: false },
                  { label: "MCP tools Claude can call", included: false },
                  { label: "Data export", included: false },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`font-sans text-[13px] flex items-center gap-2 ${
                      item.included ? "text-ks-paper-deep" : "text-ks-ink2"
                    }`}
                  >
                    <span
                      className={
                        item.included ? "text-green-500" : "text-ks-ink2"
                      }
                    >
                      {item.included ? "\u2713" : "\u2717"}
                    </span>
                    {item.label}
                  </div>
                ))}
              </div>
              <div className="mt-6 font-serif text-[32px] text-ks-paper-deep italic">
                &euro;0
              </div>
            </div>

            {/* Kit side (accent, full features) */}
            <div className="bg-ks-accent rounded-xl p-7 relative">
              <div className="absolute -top-2.5 right-5 px-2.5 py-0.5 bg-white text-ks-accent font-mono text-[10px] tracking-wider rounded-[3px] font-semibold">
                RECOMMENDED
              </div>
              <div className="font-mono text-[10px] text-white/80 tracking-wider mb-3">
                SUBSCRIPTION KIT
              </div>
              <div className="font-serif text-[28px] text-white leading-tight mb-4">
                {upgradeKit.name}
              </div>
              <div className="flex flex-col gap-2.5">
                {[
                  { label: "Everything in the free skill" },
                  { label: "Per-user Turso database" },
                  {
                    label: `${upgradeKit.tools.length} MCP tools Claude can call`,
                  },
                  {
                    label: `${upgradeKit.uiComponents.length} interactive UI components`,
                  },
                  { label: "Memory that survives sessions" },
                  {
                    label: `Replaces ${upgradeKit.replaces.join(" + ")}`,
                  },
                  { label: "Data export anytime" },
                  { label: "Frankfurt-hosted, GDPR-first" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="font-sans text-[13px] text-white flex items-center gap-2"
                  >
                    <span className="text-white">&#10003;</span>
                    {item.label}
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-baseline gap-2">
                <span className="font-serif text-[32px] text-white italic">
                  &euro;5
                </span>
                <span className="font-sans text-sm text-white/80">/mo</span>
              </div>
              <Link
                href={`/kits/${upgradeKit.slug}`}
                className="ks-btn !bg-white !text-ks-accent !border-white w-full justify-center !py-3 !text-[14px] mt-5"
              >
                See the {upgradeKit.name} &rarr;
              </Link>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
