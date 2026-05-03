export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import {
  ClaudeChat,
  ChatUser,
  ChatClaude,
} from "@/components/claude-chat/claude-chat";
import { getSkillCardBySlug, getSkillBySlug } from "@/services/skill.service";

function buildFileTree(whatsInside: { file: string; description: string }[]) {
  const tree: { name: string; indent: number; icon: "dir" | "doc" }[] = [];
  const addedDirs = new Set<string>();

  for (const entry of whatsInside) {
    const parts = entry.file.split("/");
    for (let i = 0; i < parts.length - 1; i++) {
      const dirKey = parts.slice(0, i + 1).join("/");
      if (!addedDirs.has(dirKey)) {
        addedDirs.add(dirKey);
        tree.push({ name: parts[i] + "/", indent: i, icon: "dir" });
      }
    }
    tree.push({ name: parts[parts.length - 1], indent: parts.length - 1, icon: "doc" });
  }

  return tree;
}

export default async function TrySkillPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const skill = await getSkillCardBySlug(slug);
  if (!skill) notFound();

  const rawSkill = await getSkillBySlug(slug);
  const whatsInsideEntries = rawSkill?.whatsInside ?? [];
  const fileTree = buildFileTree(whatsInsideEntries);

  return (
    <div className="bg-ks-paper">
      <Nav active="Skills" />

      {/* HEADER */}
      <section className="px-4 sm:px-8 lg:px-16 pt-12 pb-8">
        <div className="flex items-center gap-2.5 mb-4">
          <CatMark cat={skill.cat} />
          <span className="font-mono text-[11px] text-ks-muted tracking-[1px]">
            PLAYGROUND &middot; {skill.slug}
          </span>
        </div>
        <h1 className="font-serif text-[28px] sm:text-[40px] lg:text-[52px] leading-[1.02] tracking-tight text-ks-ink">
          Test{" "}
          <span className="italic text-ks-accent">{skill.name}</span>{" "}
          in a live chat.
        </h1>
        <p className="font-sans text-[17px] text-ks-muted mt-4 max-w-[640px] leading-relaxed">
          See how this skill performs in a real conversation. Paste your own
          prompt or use one of ours &mdash; the AI responds using the
          skill&apos;s system prompt and templates.
        </p>
      </section>

      {/* CHAT PLAYGROUND */}
      <section className="px-4 sm:px-8 lg:px-16 pb-12 relative">
        {/* Coming soon overlay */}
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="bg-ks-paper/90 backdrop-blur-sm border rounded-2xl shadow-xl px-10 py-8 text-center pointer-events-auto max-w-md">
            <div className="inline-flex items-center gap-2 bg-ks-paper-warm border border-ks-hair rounded-full px-4 py-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-ks-accent animate-pulse" />
              <span className="font-sans text-[13px] text-ks-ink font-medium">
                Coming soon
              </span>
            </div>
            <h3 className="font-serif text-[24px] tracking-tight text-ks-ink mb-2">
              The playground is being built
            </h3>
            <p className="font-sans text-[14px] text-ks-muted leading-relaxed mb-5">
              You&apos;ll be able to test every skill in a live chat &mdash;
              type a prompt and see the response instantly. We&apos;re putting
              the finishing touches on it.
            </p>
            <a
              href={`/skills/${slug}`}
              className="ks-btn ks-btn-primary !py-2.5 !px-5 !text-[14px]"
            >
              &larr; Back to {skill.name}
            </a>
          </div>
        </div>

        {/* Three-column layout — file tree | chat | document output */}
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_280px] gap-5 opacity-40 blur-[2px] select-none">
          {/* LEFT: File tree */}
          <div className="bg-ks-ink rounded-xl p-5 self-start hidden lg:block">
            <div className="font-mono text-[10px] text-ks-faint tracking-wider mb-3">
              {skill.slug}.zip
            </div>
            {fileTree.map((f, i) => (
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

          {/* CENTER: Chat */}
          <div>
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
                    identity and digital presence. Three phases: Discovery
                    &amp; Audit, Design System, Implementation...
                  </div>
                  <div className="text-ks-muted mb-2">
                    <b>Phased Scope</b>
                  </div>
                  <div className="mb-1">
                    Phase 1 (Wk 1-2): Discovery &amp; Audit &mdash;
                    &euro;4,500
                  </div>
                  <div className="mb-1">
                    Phase 2 (Wk 3-4): Design System &mdash; &euro;7,500
                  </div>
                  <div className="mb-3">
                    Phase 3 (Wk 5-6): Implementation &mdash; &euro;6,000
                  </div>
                </div>
              </ChatClaude>
            </ClaudeChat>

            {/* Fake input bar */}
            <div className="mt-4 flex items-center gap-3 border border-ks-hair rounded-xl bg-white px-4 py-3">
              <div className="flex-1 font-sans text-[14px] text-ks-muted">
                Type your prompt&hellip;
              </div>
              <button
                disabled
                className="ks-btn ks-btn-primary !py-2 !px-4 !text-[13px]"
              >
                Send
              </button>
            </div>
          </div>

          {/* RIGHT: Skeleton document output */}
          <div className="ks-card p-5 self-start hidden lg:block">
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-4">
              GENERATED OUTPUT
            </div>

            {/* Skeleton title */}
            <div className="h-5 bg-ks-hair rounded w-3/4 mb-3" />
            <div className="h-3 bg-ks-hair/60 rounded w-1/2 mb-6" />

            {/* Skeleton section 1 */}
            <div className="h-3 bg-ks-accent/20 rounded w-2/5 mb-2" />
            <div className="space-y-1.5 mb-5">
              <div className="h-2.5 bg-ks-hair/50 rounded w-full" />
              <div className="h-2.5 bg-ks-hair/50 rounded w-full" />
              <div className="h-2.5 bg-ks-hair/50 rounded w-4/5" />
            </div>

            {/* Skeleton section 2 */}
            <div className="h-3 bg-ks-accent/20 rounded w-1/3 mb-2" />
            <div className="space-y-1.5 mb-5">
              <div className="h-2.5 bg-ks-hair/50 rounded w-full" />
              <div className="h-2.5 bg-ks-hair/50 rounded w-full" />
              <div className="h-2.5 bg-ks-hair/50 rounded w-3/5" />
            </div>

            {/* Skeleton table */}
            <div className="h-3 bg-ks-accent/20 rounded w-2/5 mb-2" />
            <div className="border border-ks-hair rounded p-2 space-y-1.5">
              <div className="grid grid-cols-3 gap-2">
                <div className="h-2.5 bg-ks-hair rounded" />
                <div className="h-2.5 bg-ks-hair rounded" />
                <div className="h-2.5 bg-ks-hair rounded" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-2.5 bg-ks-hair/40 rounded" />
                <div className="h-2.5 bg-ks-hair/40 rounded" />
                <div className="h-2.5 bg-ks-hair/40 rounded" />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="h-2.5 bg-ks-hair/40 rounded" />
                <div className="h-2.5 bg-ks-hair/40 rounded" />
                <div className="h-2.5 bg-ks-hair/40 rounded" />
              </div>
              <div className="border-t border-ks-hair pt-1.5 grid grid-cols-3 gap-2">
                <div className="h-2.5 bg-ks-hair rounded" />
                <div className="h-2.5 bg-ks-hair rounded" />
                <div className="h-2.5 bg-ks-hair rounded" />
              </div>
            </div>

            {/* Skeleton footer */}
            <div className="mt-5 h-2.5 bg-ks-hair/30 rounded w-3/4" />
            <div className="mt-1.5 h-2.5 bg-ks-hair/30 rounded w-1/2" />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS STRIP */}
      <section className="px-4 sm:px-8 lg:px-16 pb-16">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-4">
          HOW THE PLAYGROUND WORKS
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* 1. Prompt */}
          <div className="ks-card p-5">
            <div className="font-serif text-[32px] text-ks-ink italic leading-none mb-2">
              1
            </div>
            <div className="font-mono text-[11px] text-ks-muted tracking-wider mb-3">
              TYPE YOUR PROMPT
            </div>
            <p className="font-sans text-[13px] text-ks-muted leading-[1.7]">
              Write what you need — a proposal, an email, an analysis. The
              skill&apos;s system prompt shapes the response automatically.
            </p>
          </div>

          {/* 2. AI responds */}
          <div className="ks-card p-5 !border-ks-accent !border-[1.5px] bg-ks-accent-soft relative">
            <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-ks-accent text-white font-mono text-[10px] tracking-wider rounded-[3px]">
              LIVE CHAT
            </div>
            <div className="font-serif text-[32px] text-ks-ink italic leading-none mb-2">
              2
            </div>
            <div className="font-mono text-[11px] text-ks-accent tracking-wider mb-3">
              AI RESPONDS WITH THE SKILL
            </div>
            <p className="font-sans text-[13px] text-ks-ink2 leading-[1.7]">
              The AI uses the skill&apos;s expert persona and templates to
              produce structured, high-quality output — just like it would
              with the downloaded files.
            </p>
          </div>

          {/* 3. Download */}
          <div className="ks-card-ink p-5">
            <div className="font-serif text-[32px] text-ks-paper italic leading-none mb-2">
              3
            </div>
            <div className="font-mono text-[11px] text-ks-accent tracking-wider mb-3">
              LIKE IT? DOWNLOAD FREE
            </div>
            <p className="font-sans text-[13px] text-ks-paper-deep leading-[1.7]">
              Grab the .zip and use the skill in Claude, ChatGPT, or any AI
              assistant — no account required, yours forever.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
