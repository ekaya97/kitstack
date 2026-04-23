import Link from "next/link";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import { Stars } from "@/components/ui/stars";
import { PipelineKanban } from "@/components/mcp-apps/pipeline-kanban";
import { ExpenseTable } from "@/components/mcp-apps/expense-table";
import { SequenceBuilder } from "@/components/mcp-apps/sequence-builder";
import { ActionTracker } from "@/components/mcp-apps/action-tracker";
import { KITS } from "@/data/kits";

const demos: Record<string, React.ReactNode> = {
  "crm-kit": <PipelineKanban compact />,
  "expense-kit": <ExpenseTable rows={4} />,
  "outreach-kit": <SequenceBuilder />,
  "meeting-kit": <ActionTracker />,
};

const totalReplacesValue = KITS.reduce((sum, k) => sum + k.replacesValue, 0);

export default function KitsPage() {
  return (
    <div className="bg-ks-paper">
      <Nav active="Kits" />

      {/* HEADER */}
      <section className="px-16 pt-[72px] pb-12 grid grid-cols-[1.1fr_1fr] gap-[60px] items-center">
        <div>
          <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-[18px]">
            {KITS.length} KITS &middot; &euro;5/MO STARTER &middot; ALL INCLUDED
          </div>
          <h1 className="font-serif text-[68px] leading-[0.98] tracking-[-2px] text-ks-ink">
            Kits.{" "}
            <span className="italic text-ks-accent">Real apps,</span>
            <br />
            in your chat.
          </h1>
          <p className="font-sans text-[17px] text-ks-muted mt-[22px] max-w-[500px] leading-relaxed">
            Each kit is a full app delivered via one MCP connector. Database, UI,
            and tools &mdash; Claude calls them for you. Your data persists
            across sessions.
          </p>
        </div>

        {/* Right side: pricing callout */}
        <div className="flex flex-col items-center text-center">
          <div className="font-serif text-[120px] leading-none tracking-[-4px] text-ks-ink">
            &euro;{totalReplacesValue}
          </div>
          <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mt-1 mb-6">
            SAAS REPLACED / MO
          </div>
          <Link
            href="/pricing"
            className="ks-btn ks-btn-accent !py-3.5 !px-[28px] !text-[15px]"
          >
            Start &middot; &euro;5/mo &rarr;
          </Link>
        </div>
      </section>

      {/* KITS GRID */}
      <section className="px-16 pb-[72px]">
        <div className="grid grid-cols-2 gap-[18px]">
          {KITS.map((kit) => (
            <div key={kit.slug} className="ks-card p-5 flex flex-col">
              {/* Top row: category + live status + stars */}
              <div className="flex justify-between items-center mb-2.5">
                <div className="flex items-center gap-2">
                  <CatMark cat={kit.cat} />
                  <span className="ks-chip !text-[10px]">{kit.cat}</span>
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[#3b7a3b]">
                    <span className="text-[8px]">&#9679;</span> live
                  </span>
                </div>
                <Stars v={kit.rating} size={12} />
              </div>

              {/* Title + tagline */}
              <h3 className="font-serif text-[26px] tracking-tight leading-tight mb-1">
                {kit.name}
              </h3>
              <p className="font-sans text-[13px] text-ks-muted leading-relaxed mb-4">
                {kit.tagline}
              </p>

              {/* MCP App preview */}
              <div className="bg-ks-paper-warm rounded-lg p-3.5 border border-ks-hair mb-4">
                <div className="font-mono text-[9px] text-ks-muted tracking-wide mb-2.5">
                  &#9635; MCP APP &middot; {kit.uiComponents[0]}
                </div>
                {demos[kit.slug]}
              </div>

              {/* REPLACES section */}
              <div className="mb-3.5">
                <div className="font-mono text-[9px] text-ks-muted tracking-wider mb-1.5">
                  REPLACES
                </div>
                <div className="flex flex-wrap gap-2">
                  {kit.replaces.map((r) => (
                    <span key={r} className="font-sans text-[13px] text-ks-muted ks-strike">
                      {r}
                    </span>
                  ))}
                </div>
              </div>

              {/* SAVES amount */}
              <div className="flex items-center gap-2 mb-4">
                <div className="font-mono text-[9px] text-ks-muted tracking-wider">
                  SAVES
                </div>
                <div className="font-serif text-[22px] text-ks-accent italic">
                  &euro;{kit.replacesValue}/mo
                </div>
              </div>

              {/* Buttons */}
              <div className="flex gap-2.5 mt-auto">
                <Link
                  href={`/kits/${kit.slug}`}
                  className="ks-btn ks-btn-primary !text-[12px] !py-2 !px-4"
                >
                  Open kit &rarr;
                </Link>
                <Link
                  href={`/kits/${kit.slug}`}
                  className="ks-btn !text-[12px] !py-2 !px-4"
                >
                  Try it free
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>

      <Footer />
    </div>
  );
}
