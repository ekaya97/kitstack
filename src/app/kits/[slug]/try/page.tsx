import { notFound } from "next/navigation";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import {
  ClaudeChat,
  ChatUser,
  ChatClaude,
  ToolCall,
  MCPApp,
} from "@/components/claude-chat/claude-chat";
import { PipelineKanban } from "@/components/mcp-apps/pipeline-kanban";
import { getKitCardBySlug } from "@/services/kit.service";

export default async function TryKitPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const kit = await getKitCardBySlug(slug);
  if (!kit) notFound();

  return (
    <div className="bg-ks-paper">
      <Nav active="Kits" />

      {/* TRIAL BANNER */}
      <div className="bg-ks-accent-soft px-12 py-3 flex items-center justify-between">
        <div className="font-sans text-[13px] text-ks-ink leading-relaxed">
          <span className="font-semibold">Free trial</span> &middot; 1 run/day.
          Signed in as{" "}
          <span className="font-mono text-[12px]">lena@example.com</span>{" "}
          &middot; 0/1 used today &middot; output capped at 50%.
        </div>
        <button className="ks-btn ks-btn-accent !py-2 !px-4 !text-[13px] shrink-0">
          Subscribe &middot; &euro;5/mo &middot; no cap &rarr;
        </button>
      </div>

      {/* HEADER */}
      <section className="px-16 pt-12 pb-8">
        <div className="flex items-center gap-2.5 mb-4">
          <CatMark cat={kit.cat} />
          <span className="font-mono text-[11px] text-ks-muted tracking-[1px]">
            SANDBOX &middot; {kit.slug}
          </span>
        </div>
        <h1 className="font-serif text-[52px] leading-[1.02] tracking-tight text-ks-ink">
          Try{" "}
          <span className="italic text-ks-accent">{kit.name}</span>{" "}
          before you commit.
        </h1>
        <p className="font-sans text-[17px] text-ks-muted mt-4 max-w-[640px] leading-relaxed">
          This sandbox runs a stubbed database so you can see exactly what the
          kit does. Data resets every session. Subscribe to keep your data
          forever.
        </p>
      </section>

      {/* SIGN-UP GATE REMINDER */}
      <div className="mx-16 mb-8 bg-ks-paper-warm border border-ks-hair rounded-lg px-5 py-3.5 flex items-center justify-between">
        <div className="font-sans text-[13px] text-ks-muted">
          Not signed in? Free sign-up gets you{" "}
          <span className="font-semibold text-ks-ink">1 kit trial/day</span>.
        </div>
        <div className="flex gap-2.5">
          <button className="ks-btn !py-2 !px-3.5 !text-[13px]">
            Sign in
          </button>
          <button className="ks-btn ks-btn-primary !py-2 !px-3.5 !text-[13px]">
            Sign up free
          </button>
        </div>
      </div>

      {/* TWO-COLUMN SANDBOX */}
      <section className="px-16 pb-12 grid grid-cols-2 gap-5">
        {/* LEFT: INPUT */}
        <div className="ks-card p-5 flex flex-col">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-3">
            INPUT &middot; PROMPT CLAUDE
          </div>
          <textarea
            readOnly
            rows={4}
            className="w-full border border-ks-hair rounded-lg p-3.5 font-sans text-[13.5px] text-ks-ink leading-relaxed bg-ks-paper-warm resize-none focus:outline-none mb-4"
            defaultValue={`Show me my pipeline. Add a deal for Acme Bakery, €18k, proposal stage.`}
          />
          <div className="flex gap-2.5 mt-auto">
            <button className="ks-btn ks-btn-primary !py-2.5 !px-5 !text-[13px]">
              &#9654; Run the kit
            </button>
            <button className="ks-btn !py-2.5 !px-5 !text-[13px]">
              Example
            </button>
          </div>
        </div>

        {/* RIGHT: OUTPUT */}
        <div className="flex flex-col gap-0">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-3">
            OUTPUT
          </div>
          <ClaudeChat title="Claude &middot; CRM Kit sandbox">
            <ChatUser>
              Show me my pipeline. Add a deal for Acme Bakery, &euro;18k,
              proposal stage.
            </ChatUser>
            <ToolCall tool="pipeline_dashboard" />
            <ChatClaude>Here are your current open deals:</ChatClaude>
            <MCPApp title="pipeline_dashboard">
              <PipelineKanban compact />
            </MCPApp>
            <ToolCall tool="add_deal" args="Acme Bakery, €18k, proposal" />
            <ChatClaude>
              Done &mdash; I&apos;ve added Acme Bakery as a &euro;18,000 deal in
              the Proposal stage.
            </ChatClaude>
          </ClaudeChat>

          {/* BLURRED PAYWALL SECTION */}
          <div className="relative mt-0">
            <div
              className="px-5 pt-4 pb-8"
              style={{ filter: "blur(4px)", opacity: 0.55 }}
            >
              <ClaudeChat compact title="Claude &middot; CRM Kit sandbox">
                <ChatClaude>
                  Your pipeline now totals &euro;113,500 across 7 deals. Two
                  deals need follow-up this week: M&uuml;ller Dental (proposal
                  due Thursday) and Nordic Supply (waiting on budget
                  confirmation). Want me to draft the follow-up emails?
                </ChatClaude>
                <ToolCall tool="list_contacts" args="needs_followup=true" />
                <ChatClaude>
                  Here are the 4 contacts requiring action. I can generate
                  personalized follow-ups for each one.
                </ChatClaude>
              </ClaudeChat>
            </div>

            {/* Gradient overlay + upsell */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ks-paper/60 to-ks-paper flex flex-col items-center justify-end pb-6">
              <div className="font-serif text-[22px] text-ks-ink tracking-tight mb-3">
                Want the full kit in your Claude?
              </div>
              <div className="flex gap-2.5">
                <button className="ks-btn ks-btn-accent !py-2.5 !px-5 !text-[13px]">
                  Subscribe &middot; &euro;5/mo &rarr;
                </button>
                <button className="ks-btn !py-2.5 !px-5 !text-[13px]">
                  See Pro
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* THREE WAYS STRIP */}
      <section className="px-16 pb-16">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-4">
          THREE WAYS TO USE {kit.name.toUpperCase()}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {/* Try */}
          <div className="ks-card p-5">
            <div className="font-serif text-[32px] text-ks-ink italic leading-none mb-2">
              Try
            </div>
            <div className="font-mono text-[11px] text-ks-muted tracking-wider mb-3">
              FREE &middot; THIS PAGE
            </div>
            <ul className="m-0 pl-4 font-sans text-[13px] text-ks-muted leading-[1.7]">
              <li>1 run / day</li>
              <li>Stub database (resets)</li>
              <li>Output capped at 50%</li>
            </ul>
          </div>

          {/* Starter */}
          <div className="ks-card p-5 !border-ks-accent !border-[1.5px] bg-ks-accent-soft relative">
            <div className="absolute -top-2.5 right-4 px-2.5 py-0.5 bg-ks-accent text-white font-mono text-[10px] tracking-wider rounded-[3px]">
              RECOMMENDED
            </div>
            <div className="font-serif text-[32px] text-ks-ink italic leading-none mb-2">
              Starter
            </div>
            <div className="font-mono text-[11px] text-ks-accent tracking-wider mb-3">
              &euro;5/MO &middot; ALL KITS
            </div>
            <ul className="m-0 pl-4 font-sans text-[13px] text-ks-ink2 leading-[1.7]">
              <li>Unlimited runs</li>
              <li>Persistent database</li>
              <li>Full output, no cap</li>
              <li>Export your data anytime</li>
            </ul>
          </div>

          {/* Pro */}
          <div className="ks-card-ink p-5">
            <div className="font-serif text-[32px] text-ks-paper italic leading-none mb-2">
              Pro
            </div>
            <div className="font-mono text-[11px] text-ks-accent tracking-wider mb-3">
              &euro;19/MO &middot; BEST VALUE
            </div>
            <ul className="m-0 pl-4 font-sans text-[13px] text-ks-paper-deep leading-[1.7]">
              <li>Everything in Starter</li>
              <li>Priority support</li>
              <li>Early access to new kits</li>
              <li>Custom integrations</li>
            </ul>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
