import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { KitPreviewCard } from "@/components/shared/kit-preview-card";
import { Note } from "@/components/ui/note";
import {
  ClaudeChat,
  ChatUser,
  ChatClaude,
  MCPApp,
} from "@/components/claude-chat/claude-chat";
import { PipelineKanban } from "@/components/mcp-apps/pipeline-kanban";
import { getAllKitCards } from "@/services/kit.service";
import type { KitCardData } from "@/services/transformers";
import Link from "next/link";

export default async function Landing() {
  const kits = await getAllKitCards();
  return (
    <div className="bg-ks-paper">
      <Nav />

      {/* HERO */}
      <section className="px-16 pt-[72px] pb-12 grid grid-cols-[1.1fr_1fr] gap-[60px] items-center">
        <div>
          <div className="flex items-center gap-2.5 mb-[22px]">
            <span className="ks-chip ks-chip-soft">
              For Claude &middot; ChatGPT &middot; VS Code
            </span>
            <span className="font-mono text-[11px] text-ks-muted">
              v0.5
            </span>
          </div>
          <h1 className="font-serif text-[80px] leading-[0.98] tracking-[-2px] text-ks-ink">
            Cancel the SaaS.
            <br />
            <span className="italic">Keep the work.</span>
          </h1>
          <p className="font-sans text-[19px] text-ks-muted mt-[26px] max-w-[520px] leading-relaxed">
            Free <b className="text-ks-ink">Skills</b> turn Claude into a
            specialist for one job. Subscription{" "}
            <b className="text-ks-ink">Kits</b> add a database, an interactive
            UI inside the chat, and memory that survives sessions.
          </p>
          <div className="flex gap-3 mt-8">
            <Link
              href="/skills"
              className="ks-btn ks-btn-primary !py-3.5 !px-[22px] !text-[15px]"
            >
              Browse free skills &darr;
            </Link>
            <Link
              href="/kits"
              className="ks-btn ks-btn-accent !py-3.5 !px-[22px] !text-[15px]"
            >
              See kits in action &rarr;
            </Link>
          </div>
          <div className="mt-[22px] flex gap-[22px] font-sans text-xs text-ks-muted">
            <span>&#10003; Skills: no signup, no card</span>
            <span>&#10003; Kits: &euro;5/mo Starter</span>
            <span>&#10003; Your data, exportable</span>
          </div>
        </div>

        {/* Right: side-by-side proof */}
        <div className="grid gap-3.5">
          {/* Free skill card */}
          <div className="ks-card p-[18px]">
            <div className="flex justify-between items-center mb-2.5">
              <span className="ks-chip !text-[10px] !border-ks-ink !text-ks-ink">
                FREE SKILL &middot; .zip
              </span>
              <span className="font-mono text-[10px] text-ks-muted">
                uploaded to Claude once
              </span>
            </div>
            <ClaudeChat compact title="Claude &middot; with Proposal Skill">
              <ChatUser>
                Write a proposal for Acme Bakery, 6 weeks, &euro;18k.
              </ChatUser>
              <ChatClaude>
                Here&apos;s a phased proposal with scope, pricing and
                terms&hellip;
                <br />
                <span className="font-mono text-[11px] text-ks-muted">
                  [markdown output, ~2 pages]
                </span>
              </ChatClaude>
            </ClaudeChat>
            <div className="font-sans text-xs text-ks-muted mt-2.5 flex justify-between">
              <span>Great output. No memory.</span>
              <span className="font-mono text-ks-ink">&euro;0</span>
            </div>
          </div>

          {/* Kit card */}
          <div className="ks-card-ink p-[18px] relative">
            <div className="flex justify-between items-center mb-2.5">
              <span className="ks-chip !text-[10px] !border-ks-accent !text-ks-accent">
                SUBSCRIPTION KIT &middot; via connector
              </span>
              <span className="font-mono text-[10px] text-ks-faint">
                data persists &middot; UI in chat
              </span>
            </div>
            <ClaudeChat compact title="Claude &middot; with CRM Kit">
              <ChatUser>Show me my pipeline.</ChatUser>
              <ChatClaude>Here are your open deals:</ChatClaude>
              <MCPApp title="pipeline_dashboard">
                <PipelineKanban compact />
              </MCPApp>
            </ClaudeChat>
            <Note
              angle={3}
              className="absolute -top-[18px] -right-3 !text-xl"
            >
              real UI,
              <br />
              live data &#8599;
            </Note>
          </div>
        </div>
      </section>

      {/* TWO-TIER EXPLAINER */}
      <section className="px-16 py-16 bg-ks-paper-warm border-y border-ks-hair">
        <div className="flex justify-between items-end mb-[30px]">
          <div>
            <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
              HOW IT WORKS
            </div>
            <h2 className="font-serif text-[52px] tracking-tight">
              Two products.{" "}
              <span className="italic text-ks-accent">One trust curve.</span>
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5">
          {/* Skills column */}
          <div className="ks-card p-7">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-lg bg-ks-paper-deep grid place-items-center font-serif text-2xl font-semibold">
                &#128230;
              </div>
              <div>
                <div className="font-mono text-[10px] text-ks-muted tracking-wider">
                  TIER 1 &middot; FREE
                </div>
                <div className="font-serif text-[32px] tracking-tight leading-tight">
                  Skills
                </div>
              </div>
            </div>
            <div className="font-sans text-[14.5px] text-ks-ink2 leading-relaxed mb-[18px]">
              Downloadable .zip files. Upload once to Claude&apos;s Skills
              folder. Claude becomes a domain expert for that task &mdash;
              proposals, contracts, outreach.{" "}
              <b>Works forever. No account. No server.</b>
            </div>
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2.5">
              THE TRADE-OFF
            </div>
            <ul className="m-0 pl-4 font-sans text-[13px] text-ks-muted leading-[1.7]">
              <li>No memory between conversations</li>
              <li>No database, no dashboards</li>
              <li>Can&apos;t track outcomes, only produce them</li>
            </ul>
            <Link href="/skills" className="ks-btn mt-5 !text-[13px]">
              Browse free skills &darr;
            </Link>
          </div>

          {/* Kits column */}
          <div className="ks-card p-7 !border-ks-accent !border-[1.5px] relative">
            <div className="absolute -top-2.5 right-5 px-2.5 py-0.5 bg-ks-accent text-white font-mono text-[10px] tracking-wider rounded-[3px]">
              RECOMMENDED
            </div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-10 h-10 rounded-lg bg-ks-accent-soft grid place-items-center font-serif text-xl font-semibold text-ks-accent">
                &#9635;
              </div>
              <div>
                <div className="font-mono text-[10px] text-ks-accent tracking-wider">
                  TIER 2 &middot; &euro;5/MO STARTER
                </div>
                <div className="font-serif text-[32px] tracking-tight leading-tight">
                  Kits
                </div>
              </div>
            </div>
            <div className="font-sans text-[14.5px] text-ks-ink2 leading-relaxed mb-[18px]">
              Full apps that live inside your chat. Each kit saves your data
              between sessions, shows interactive dashboards inline, and lets
              Claude do the work for you.{" "}
              <b>
                Your data. Your stack. Replaces &euro;50&ndash;200/mo of SaaS.
              </b>
            </div>
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2.5">
              WHAT YOU GET
            </div>
            <ul className="m-0 pl-4 font-sans text-[13px] text-ks-ink2 leading-[1.7]">
              <li>Your data, saved between sessions</li>
              <li>Dashboards, tables, and kanban boards &mdash; right in the chat</li>
              <li>Data survives sessions, syncs across devices</li>
            </ul>
            <Link href="/kits" className="ks-btn ks-btn-accent mt-5 !text-[13px]">
              See all kits &rarr;
            </Link>
          </div>
        </div>

        {/* The upgrade arrow */}
        <div className="flex justify-center mt-[30px] items-center gap-3.5 font-sans text-sm text-ks-muted">
          <span>Download a free skill</span>
          <span className="font-serif text-[32px] text-ks-accent italic">
            &rarr;
          </span>
          <span>Love it? Upgrade to the kit version</span>
          <span className="font-serif text-[32px] text-ks-accent italic">
            &rarr;
          </span>
          <span>Keep your data forever</span>
        </div>
      </section>

      {/* FEATURED KITS */}
      <section className="px-16 pt-[72px] pb-10">
        <div className="flex justify-between items-end mb-7">
          <div>
            <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
              KITS &middot; LIVE
            </div>
            <h2 className="font-serif text-[52px] tracking-tight">
              A UI,{" "}
              <span className="italic text-ks-accent">inside your chat.</span>
            </h2>
          </div>
          <Link href="/kits" className="ks-btn !text-[13px]">
            All kits &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-[18px]">
          {kits.map((k) => (
            <KitPreviewCard key={k.slug} kit={k} />
          ))}
        </div>
      </section>

      {/* SAVINGS MATH */}
      <section className="px-16 py-[72px] bg-ks-ink text-ks-paper">
        <div className="grid grid-cols-[1fr_1.3fr] gap-[60px] items-center">
          <div>
            <div className="font-mono text-[11px] text-ks-accent tracking-[1px] mb-2.5">
              THE MATH
            </div>
            <h2 className="font-serif text-[56px] leading-none tracking-tight">
              &euro;5/mo replaces
              <br />
              <span className="italic text-ks-accent">&euro;178/mo</span> of
              SaaS.
            </h2>
            <div className="font-sans text-[15px] text-ks-paper-deep mt-[22px] leading-relaxed max-w-[420px]">
              Starter subscription unlocks every kit. Your data stays yours
              &mdash; exportable anytime.
            </div>
          </div>

          <div className="flex flex-col gap-2.5">
            {[
              {
                name: "Pipedrive + HubSpot Starter",
                was: 44,
                kit: "CRM Kit",
              },
              {
                name: "Lexoffice + sevDesk",
                was: 32,
                kit: "Expense & Tax Prep Kit",
              },
              {
                name: "Lavender + Instantly",
                was: 66,
                kit: "Cold Outreach Kit",
              },
              {
                name: "Otter.ai + Fireflies",
                was: 36,
                kit: "Meeting Tracker Kit",
              },
            ].map((r, i) => (
              <div
                key={i}
                className="grid grid-cols-[1.4fr_80px_1fr] gap-3.5 py-3 border-b border-ks-ink2 items-center"
              >
                <div className="font-sans text-sm text-ks-paper-deep ks-strike">
                  {r.name}
                </div>
                <div className="font-serif text-[22px] text-ks-paper-deep italic">
                  &euro;{r.was}/mo
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-serif text-[22px] text-ks-accent italic">
                    &rarr;
                  </span>
                  <span className="font-sans text-sm">{r.kit}</span>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-[1.4fr_80px_1fr] gap-3.5 pt-3.5 items-center">
              <div className="font-sans text-sm font-semibold">
                All of the above, for:
              </div>
              <div className="font-serif text-[44px] text-ks-accent italic leading-none">
                &euro;5
                <span className="text-lg">/mo</span>
              </div>
              <div className="font-sans text-xs text-ks-paper-deep">
                Starter &middot; all kits &middot; cancel anytime
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CONNECTOR SETUP TEASER */}
      <section className="px-16 py-[72px]">
        <div className="mb-[30px]">
          <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
            SETUP &middot; ONE STEP
          </div>
          <h2 className="font-serif text-5xl tracking-tight">
            Add it once.{" "}
            <span className="italic text-ks-accent">Every kit works.</span>
          </h2>
        </div>
        <div className="grid grid-cols-3 gap-3.5">
          {(
            [
              [
                "01",
                "Paste one URL",
                <>
                  In Claude &rarr; Settings &rarr; Connectors &rarr; paste the
                  link from your dashboard. Done.
                </>,
              ],
              [
                "02",
                "Sign in with one click",
                "One-click auth. Your subscription unlocks your kits inside Claude.",
              ],
              [
                "03",
                "Just talk to Claude",
                '"Show my pipeline." "Add this expense." "What\'s overdue?" Claude invokes the kit.',
              ],
            ] as const
          ).map(([n, t, d]) => (
            <div key={n} className="ks-card p-6">
              <div className="font-serif text-[56px] text-ks-accent italic leading-none">
                {n}
              </div>
              <div className="font-serif text-[22px] mt-3">{t}</div>
              <div className="font-sans text-[13px] text-ks-muted mt-2 leading-relaxed">
                {d}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-16 py-[72px] bg-ks-paper-warm border-t border-ks-hair">
        <div className="mb-[30px]">
          <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
            FAQ
          </div>
          <h2 className="font-serif text-5xl tracking-tight">
            Common questions.
          </h2>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-8 max-w-5xl">
          {[
            {
              q: "What's the difference between a skill and a kit?",
              a: "A skill is a free .zip file you upload to Claude — it makes Claude an expert at one task, but has no memory. A kit is a subscription app with a database, interactive UI, and cross-session persistence. Think of a skill as the demo, a kit as the full product.",
            },
            {
              q: "Do I need a Claude subscription?",
              a: "For skills: yes, you need Claude Pro, Max, Team, or Enterprise. Skills work on claude.ai, Desktop, Cowork, and Claude Code. For kits: you need a Claude plan that supports connectors, plus a KitStack Starter subscription.",
            },
            {
              q: "What happens to my data if I cancel?",
              a: "Your data stays accessible for 90 days after cancellation. You can export everything as CSV or JSON at any time using the built-in export tools. After 90 days, databases are permanently deleted.",
            },
            {
              q: "Can I use kits on ChatGPT?",
              a: "Skills work only with Claude. Kits use the MCP protocol, which is supported by Claude, ChatGPT, VS Code, and other MCP-compatible clients. Cross-platform support is a key advantage.",
            },
            {
              q: "Is my data private?",
              a: "Yes. Each kit gets its own isolated database — no other user can access it. All data is stored in the EU (Frankfurt). You own your data and can export or delete it anytime.",
            },
            {
              q: "Why €5/mo and not free?",
              a: "Skills are free because they cost us nothing to serve — they're static files. Kits require per-user databases, MCP server hosting, and interactive UI serving. €5/mo covers infrastructure while staying cheaper than any single SaaS tool a kit replaces.",
            },
          ].map(({ q, a }) => (
            <div key={q}>
              <h3 className="font-serif text-[18px] text-ks-ink mb-1.5">{q}</h3>
              <p className="font-sans text-[13.5px] text-ks-muted leading-relaxed">
                {a}
              </p>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
