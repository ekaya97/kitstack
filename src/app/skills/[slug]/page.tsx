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
import { ScrollTabs } from "@/components/shared/scroll-tabs";

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

  const tabs = [
    { id: "see-it-work", label: "See it work" },
    { id: "whats-inside", label: "What's inside" },
    { id: "setup", label: "Setup" },
    { id: "reviews", label: `Reviews (${skill.reviews})` },
    ...(upgradeKit ? [{ id: "upgrade-path", label: "Upgrade path" }] : []),
  ];

  return (
    <div className="bg-ks-paper">
      <Nav active="Skills" />

      {/* ── HEADER ── */}
      <section className="px-16 pt-6 pb-10 border-b border-ks-hair">
        {/* Breadcrumb */}
        <div className="font-mono text-[11px] text-ks-muted mb-4 flex items-center gap-1.5">
          <Link href="/" className="hover:text-ks-ink">Home</Link>
          <span>/</span>
          <Link href="/skills" className="hover:text-ks-ink">Skills</Link>
          <span>/</span>
          <span className="text-ks-ink font-medium">{skill.name}</span>
        </div>

        <div className="grid grid-cols-[1fr_360px] gap-12 items-start">
          {/* Left column */}
          <div>
            {/* Category + free chip */}
            <div className="flex items-center gap-2 mb-3">
              <span className="ks-chip">
                <CatMark cat={skill.cat} size={14} />
                {skill.cat}
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium px-2.5 py-[3px] rounded-full bg-green-100 text-green-800 border border-green-300">
                FREE &middot; no signup
              </span>
            </div>

            {/* Title */}
            <h1 className="font-serif text-[56px] leading-[1] tracking-[-2px] text-ks-ink mb-3">
              {skill.name}
            </h1>

            {/* Description */}
            <p className="font-sans text-[16px] text-ks-muted leading-relaxed max-w-xl mb-5">
              {skill.desc}
            </p>

            {/* Author row + Rating inline */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2.5">
                <Avatar name={skill.author} size={28} tone="#3b7a3b" />
                <span className="font-sans text-[13px] text-ks-ink">
                  by <b>{skill.author}</b>{" "}
                  <span className="text-green-700">&#10003;</span>
                </span>
              </div>
              <div className="w-px h-5 bg-ks-hair" />
              <Stars v={skill.rating} size={13} />
              <span className="font-sans text-[12px] text-ks-muted">
                {skill.downloads.toLocaleString()} downloads
              </span>
              <span className="font-sans text-[12px] text-ks-muted">
                {skill.files} files &middot; {skill.size}
              </span>
            </div>
          </div>

          {/* Right sidebar — download card */}
          <div className="sticky top-8 flex flex-col gap-3">
            <div className="ks-card p-5">
              <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1">
                FREE SKILL
              </div>
              <div className="flex items-baseline gap-2 mb-0.5">
                <span className="font-serif text-[40px] text-ks-ink italic leading-none">
                  &euro;0
                </span>
                <span className="font-sans text-[13px] text-ks-muted">
                  forever free
                </span>
              </div>
              <div className="font-sans text-[11px] text-ks-muted mb-4">
                .zip &middot; {skill.files} files &middot; {skill.size}
              </div>

              <button className="ks-btn ks-btn-primary w-full justify-center !py-3 !text-[14px] mb-2">
                Download free &darr;
              </button>
              <button className="ks-btn w-full justify-center !py-2.5 !text-[13px] mb-4">
                Try it first &middot; 1 free/day
              </button>

              {/* Action row */}
              <div className="flex justify-between border-t border-ks-hair pt-3 mb-4">
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
              <div className="border-t border-ks-hair pt-3 flex flex-col gap-1.5">
                <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-0.5">
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
                    className="font-sans text-[12.5px] text-ks-ink flex items-center gap-2"
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
                <div className="font-mono text-[10px] text-ks-accent tracking-wider mb-1.5">
                  UPGRADE AVAILABLE
                </div>
                <div className="font-serif text-[20px] text-ks-paper leading-tight mb-1.5">
                  {upgradeKit.name}
                </div>
                <div className="font-sans text-[12.5px] text-ks-paper-deep leading-relaxed mb-3">
                  {skill.upgradeHook}
                </div>
                <Link
                  href={`/kits/${upgradeKit.slug}`}
                  className="ks-btn ks-btn-accent w-full justify-center !py-2 !text-[13px]"
                >
                  See the kit &rarr;
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ── STICKY TAB BAR ── */}
      <ScrollTabs tabs={tabs} />

      {/* ── SEE IT WORK ── */}
      <section className="px-16 py-16" id="see-it-work">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
          SEE IT WORK
        </div>
        <h2 className="font-serif text-[48px] tracking-tight mb-8">
          One prompt. Full output.
        </h2>

        <div className="max-w-3xl">
          <ClaudeChat title={`Claude \u00b7 with ${skill.name}`}>
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
        className="px-16 py-16 bg-ks-paper-warm border-y border-ks-hair"
        id="whats-inside"
      >
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
          WHAT&apos;S INSIDE
        </div>
        <h2 className="font-serif text-[48px] tracking-tight mb-10">
          {skill.files} files. One .zip.
        </h2>

        <div className="grid grid-cols-[340px_1fr] gap-10">
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
      <section className="px-16 py-16" id="setup">
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
              desc: "Drag the .zip into Claude\u2019s Skills folder, or upload it as a project file.",
            },
            {
              n: "04",
              title: "Chat",
              desc: "Tell Claude what you need. The skill\u2019s system prompt and templates kick in automatically.",
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
      <section className="px-16 py-16 border-t border-ks-hair" id="reviews">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
          REVIEWS
        </div>
        <div className="grid grid-cols-[280px_1fr] gap-10">
          <div>
            <h2 className="font-serif text-[44px] tracking-tight mb-4">
              {skill.rating}<span className="text-lg text-ks-muted">/5</span>
            </h2>
            <Stars v={skill.rating} size={16} showValue={false} />
            <div className="font-sans text-xs text-ks-muted mt-2">
              {skill.reviews} ratings
            </div>
            <div className="mt-4 flex flex-col gap-1">
              {[5, 4, 3, 2, 1].map((n) => {
                const p = { 5: 72, 4: 20, 3: 5, 2: 2, 1: 1 }[n] ?? 0;
                return (
                  <div key={n} className="grid grid-cols-[18px_1fr_30px] gap-2 items-center">
                    <span className="font-mono text-[10px] text-ks-muted">{n}&#9733;</span>
                    <div className="h-[5px] bg-ks-hair rounded-full">
                      <div className="h-full bg-ks-accent rounded-full" style={{ width: `${p}%` }} />
                    </div>
                    <span className="font-mono text-[9px] text-ks-muted text-right">{p}%</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { name: "Lena K.", role: "Brand consultant", v: 5, text: "Saved me 2 hours on my last proposal. The structure is spot-on and the tone matched my voice.", ago: "3d ago", helpful: 24, tone: "#3b7a3b" },
              { name: "Marco S.", role: "Solo dev", v: 5, text: "I used to spend forever scoping projects. Now I paste 4 lines and get a full proposal back.", ago: "1w ago", helpful: 12, tone: "#6b4ea8" },
              { name: "Dana A.", role: "Agency owner", v: 4, text: "Great for the basics. Would love a few more industry-specific templates, but the framework is solid.", ago: "2w ago", helpful: 8, tone: "#2b6cb0" },
            ].map((r, i) => (
              <div key={i} className="ks-card p-4">
                <div className="flex items-center gap-2.5 mb-2">
                  <Avatar name={r.name} size={26} tone={r.tone} />
                  <div className="flex-1">
                    <div className="font-sans text-[12.5px] font-semibold">
                      {r.name}{" "}
                      <span className="ks-chip !text-[9px] !py-0 !px-1.5 !ml-1">verified</span>
                    </div>
                    <div className="font-sans text-[10.5px] text-ks-muted">{r.role} &middot; {r.ago}</div>
                  </div>
                  <Stars v={r.v} size={11} showValue={false} />
                </div>
                <div className="font-sans text-[13px] leading-relaxed text-ks-ink2">{r.text}</div>
                <div className="font-sans text-[11px] text-ks-muted mt-2.5">
                  &#128077; Helpful ({r.helpful}) &middot; &#128172; Reply
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── UPGRADE PATH ── */}
      {upgradeKit && (
        <section
          className="px-16 py-12 bg-ks-ink text-ks-paper"
          id="upgrade-path"
        >
          <div className="max-w-4xl mx-auto">
            <div className="font-mono text-[11px] text-ks-accent tracking-[1px] mb-2">
              UPGRADE PATH
            </div>
            <h2 className="font-serif text-[36px] tracking-tight mb-2">
              Love the skill?{" "}
              <span className="italic text-ks-accent">Add memory.</span>
            </h2>
            <p className="font-sans text-[14px] text-ks-paper-deep leading-relaxed mb-8 max-w-lg">
              The kit version remembers everything, adds a database, and renders interactive UI inside your chat.
            </p>

            <div className="grid grid-cols-2 gap-5">
              {/* Skill side */}
              <div className="border border-dashed border-ks-faint rounded-xl p-6 opacity-80">
                <div className="font-mono text-[10px] text-ks-faint tracking-wider mb-2">
                  FREE SKILL
                </div>
                <div className="font-serif text-[22px] text-ks-paper-deep leading-tight mb-3">
                  {skill.name}
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    { label: "Download .zip", ok: true },
                    { label: "System prompt + templates", ok: true },
                    { label: "Works everywhere", ok: true },
                    { label: "Memory between sessions", ok: false },
                    { label: "Database", ok: false },
                    { label: "Interactive UI", ok: false },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className={`font-sans text-[12.5px] flex items-center gap-2 ${
                        item.ok ? "text-ks-paper-deep" : "text-ks-faint"
                      }`}
                    >
                      <span className={item.ok ? "text-green-400" : "text-ks-faint"}>
                        {item.ok ? "\u2713" : "\u2014"}
                      </span>
                      {item.label}
                    </div>
                  ))}
                </div>
                <div className="mt-4 font-serif text-[26px] text-ks-paper-deep italic">
                  &euro;0
                </div>
              </div>

              {/* Kit side */}
              <div className="bg-ks-accent rounded-xl p-6 relative">
                <div className="absolute -top-2.5 right-5 px-2.5 py-0.5 bg-white text-ks-accent font-mono text-[10px] tracking-wider rounded-[3px] font-semibold">
                  RECOMMENDED
                </div>
                <div className="font-mono text-[10px] text-white/80 tracking-wider mb-2">
                  SUBSCRIPTION KIT
                </div>
                <div className="font-serif text-[22px] text-white leading-tight mb-3">
                  {upgradeKit.name}
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    "Everything in the free skill",
                    "Per-user Turso database",
                    `${upgradeKit.tools.length} MCP tools`,
                    `${upgradeKit.uiComponents.length} UI components`,
                    "Memory that survives sessions",
                    "Data export anytime",
                  ].map((label) => (
                    <div
                      key={label}
                      className="font-sans text-[12.5px] text-white flex items-center gap-2"
                    >
                      <span>&#10003;</span>
                      {label}
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-baseline gap-2">
                  <span className="font-serif text-[26px] text-white italic">
                    &euro;5
                  </span>
                  <span className="font-sans text-sm text-white/80">/mo</span>
                </div>
                <Link
                  href={`/kits/${upgradeKit.slug}`}
                  className="ks-btn !bg-white !text-ks-accent !border-white w-full justify-center !py-2.5 !text-[13px] mt-4"
                >
                  See the {upgradeKit.name} &rarr;
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
