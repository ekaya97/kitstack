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



      {/* HEADER */}
      <section className="px-4 sm:px-8 lg:px-16 pt-12 pb-8">
        <div className="flex items-center gap-2.5 mb-4">
          <CatMark cat={kit.cat} />
          <span className="font-mono text-[11px] text-ks-muted tracking-[1px]">
            SANDBOX &middot; {kit.slug}
          </span>
        </div>
        <h1 className="font-serif text-[28px] sm:text-[40px] lg:text-[52px] leading-[1.02] tracking-tight text-ks-ink">
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



      {/* TWO-COLUMN SANDBOX */}
      <section className="px-4 sm:px-8 lg:px-16 pb-12 relative">
        {/* Coming soon overlay — covers the sandbox only */}
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="bg-ks-paper/90 backdrop-blur-sm border rounded-2xl shadow-xl px-10 py-8 text-center pointer-events-auto max-w-md">
            <div className="inline-flex items-center gap-2 bg-ks-paper-warm border border-ks-hair rounded-full px-4 py-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-ks-accent animate-pulse" />
              <span className="font-sans text-[13px] text-ks-ink font-medium">
                Coming soon
              </span>
            </div>
            <h3 className="font-serif text-[24px] tracking-tight text-ks-ink mb-2">
              The sandbox is being built
            </h3>
            <p className="font-sans text-[14px] text-ks-muted leading-relaxed mb-5">
              You&apos;ll be able to try every kit with sample data &mdash; before you commit. We&apos;re putting the finishing touches on it.
            </p>
            <a
              href={`/kits/${slug}`}
              className="ks-btn ks-btn-primary !py-2.5 !px-5 !text-[14px]"
            >
              &larr; Back to {kit.name}
            </a>
          </div>
        </div>

        {/* Sandbox content — visible but blurred behind the overlay */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 opacity-40 blur-[2px] select-none">
          {/* LEFT: INPUT */}
          <div>
            <div className="ks-card p-5 flex flex-col">
              <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-3">
                INPUT
              </div>
              <textarea
                readOnly
                rows={4}
                tabIndex={-1}
                className="w-full border border-ks-hair rounded-lg p-3.5 font-sans text-[13.5px] text-ks-ink leading-relaxed bg-ks-paper-warm resize-none focus:outline-none mb-4"
                defaultValue={`Show me my pipeline. Add a deal for Acme Bakery, €18k, proposal stage.`}
              />
              <div className="flex gap-2.5 mt-auto">
                <button disabled className="ks-btn ks-btn-primary !py-2.5 !px-5 !text-[13px]">
                  &#9654; Run the kit
                </button>
                <button disabled className="ks-btn !py-2.5 !px-5 !text-[13px]">
                  Example
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: OUTPUT */}
          <div>
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-3">
              OUTPUT
            </div>
            <ClaudeChat title="CRM Kit sandbox">
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
          </div>
        </div>
      </section>

      {/* THREE WAYS STRIP */}
      <section className="px-4 sm:px-8 lg:px-16 pb-16">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-4">
          THREE WAYS TO USE {kit.name.toUpperCase()}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
