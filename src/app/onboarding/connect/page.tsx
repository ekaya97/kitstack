import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import { getAllKitCards } from "@/services/kit.service";

const MCP_URL = "mcp.kitstack.co";

const steps = [
  { n: "01", label: "Copy URL", status: "done" as const },
  { n: "02", label: "Paste in Claude", status: "active" as const },
  { n: "03", label: "Authorize", status: "pending" as const },
  { n: "04", label: "Start using kits", status: "pending" as const },
];

const compatibleClients = [
  "Claude Desktop",
  "Claude Web",
  "Claude iOS",
  "VS Code",
  "Cursor",
];

export default async function OnboardingConnectPage() {
  const kits = await getAllKitCards();

  return (
    <div className="bg-ks-paper min-h-screen flex flex-col">
      <Nav />

      {/* HEADER */}
      <section className="px-16 pt-12 pb-8 text-center max-w-[720px] mx-auto">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-4">
          &sect; ADD YOUR CONNECTION &middot; 60 SECONDS
        </div>
        <h1 className="font-serif text-[56px] leading-[1.02] tracking-tight text-ks-ink">
          One URL.{" "}
          <span className="italic text-ks-accent">Every kit.</span>
        </h1>
        <p className="font-sans text-[17px] text-ks-muted mt-4 leading-relaxed max-w-[540px] mx-auto">
          Paste a single URL into Claude. All your subscribed kits appear
          automatically &mdash; no extensions, no plugins.
        </p>
      </section>

      {/* PROGRESS STEPPER */}
      <section className="px-16 pb-10">
        <div className="grid grid-cols-4 gap-3">
          {steps.map((step) => (
            <div
              key={step.n}
              className={`rounded-xl px-4 py-3.5 ${
                step.status === "done"
                  ? "bg-ks-accent-soft"
                  : step.status === "active"
                    ? "bg-ks-ink text-ks-paper"
                    : "bg-ks-paper-warm"
              }`}
            >
              <div
                className={`font-serif text-[28px] italic leading-none mb-1 ${
                  step.status === "done"
                    ? "text-ks-accent"
                    : step.status === "active"
                      ? "text-ks-accent"
                      : "text-ks-faint"
                }`}
              >
                {step.n}
              </div>
              <div
                className={`font-sans text-[13px] font-semibold ${
                  step.status === "done"
                    ? "text-ks-ink"
                    : step.status === "active"
                      ? "text-ks-paper"
                      : "text-ks-muted"
                }`}
              >
                {step.label}
              </div>
              {step.status === "done" && (
                <span className="font-mono text-[10px] text-ks-accent">
                  &#10003; done
                </span>
              )}
              {step.status === "active" && (
                <span className="font-mono text-[10px] text-ks-accent">
                  &#9679; current
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* TWO-COLUMN MAIN PANEL */}
      <section className="px-16 pb-12 grid grid-cols-2 gap-6">
        {/* LEFT: INSTRUCTIONS */}
        <div className="flex flex-col gap-6">
          <div>
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2.5">
              STEP 1 &middot; COPY
            </div>
            <div className="flex items-center gap-2 bg-ks-ink rounded-xl px-4 py-3.5">
              <code className="font-mono text-[14px] text-ks-paper flex-1">
                {MCP_URL}
              </code>
              <button className="font-mono text-[11px] text-ks-accent hover:text-ks-accent-deep font-semibold shrink-0 border border-ks-ink2 rounded-md px-3 py-1.5 hover:border-ks-accent transition-colors">
                COPY
              </button>
            </div>
          </div>

          <div>
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2.5">
              STEP 2 &middot; PASTE IN CLAUDE
            </div>

            <div className="ks-card p-4 mb-3">
              <div className="font-sans text-[13px] font-semibold text-ks-ink mb-2">
                Desktop &amp; web
              </div>
              <ol className="m-0 pl-5 font-sans text-[13px] text-ks-muted leading-[1.8]">
                <li>
                  Open Claude &rarr;{" "}
                  <span className="font-semibold text-ks-ink">Settings</span>
                </li>
                <li>
                  Go to{" "}
                  <span className="font-semibold text-ks-ink">Connectors</span>
                </li>
                <li>
                  Click{" "}
                  <span className="font-semibold text-ks-ink">
                    Add connection
                  </span>
                </li>
                <li>Paste the URL above and click Authorize</li>
              </ol>
            </div>

            <div className="ks-card p-4 mb-4">
              <div className="font-sans text-[13px] font-semibold text-ks-ink mb-2">
                Mobile
              </div>
              <div className="font-sans text-[13px] text-ks-muted leading-relaxed">
                Tap your profile &rarr; Settings &rarr; Connectors &rarr; paste
                the URL. Same flow, smaller screen.
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {compatibleClients.map((client) => (
                <span key={client} className="ks-chip !text-[11px]">
                  {client}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT: PREVIEW */}
        <div className="flex flex-col gap-4">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-0">
            PREVIEW
          </div>

          <div className="border border-ks-hair rounded-xl bg-white overflow-hidden shadow-[0_8px_30px_-10px_rgba(0,0,0,0.12)]">
            <div className="px-3.5 py-2.5 border-b border-ks-hair flex items-center gap-2 bg-[#fafaf7]">
              <span className="w-2.5 h-2.5 rounded-full bg-[#e06b4a]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#f4c95f]" />
              <span className="w-2.5 h-2.5 rounded-full bg-[#6bb56b]" />
              <div className="ml-3 font-sans text-xs text-ks-muted">
                Claude &middot; Settings &middot; Connectors
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4">
                <div className="font-sans text-[12px] text-ks-muted mb-1.5">
                  Connection URL
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 border border-ks-accent rounded-lg px-3.5 py-2.5 font-mono text-[13px] text-ks-ink bg-ks-accent-soft/30">
                    {MCP_URL}
                  </div>
                  <button className="ks-btn ks-btn-accent !py-2.5 !px-4 !text-[12px]">
                    Authorize &rarr;
                  </button>
                </div>
              </div>

              <div className="border-t border-ks-hair my-4" />

              <div className="font-mono text-[9px] text-ks-muted tracking-wider mb-2.5">
                AUTHORIZED &middot; {kits.length} KITS AVAILABLE
              </div>
              <div className="flex flex-col gap-2">
                {kits.map((kit) => (
                  <div
                    key={kit.name}
                    className="flex items-center justify-between bg-ks-paper-warm rounded-lg px-3.5 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <CatMark cat={kit.cat} size={18} />
                      <span className="font-sans text-[13px] font-medium text-ks-ink">
                        {kit.name}
                      </span>
                    </div>
                    <span className="font-mono text-[10px] text-ks-muted">
                      {kit.tools.length} actions
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 font-sans text-[11px] text-ks-muted text-center">
                &#10003; All kits ready &middot; start a new chat to use them
              </div>
            </div>
          </div>

          <div className="bg-ks-paper-warm border border-ks-hair rounded-xl p-4">
            <div className="font-sans text-[13px] font-semibold text-ks-ink mb-1">
              Stuck?
            </div>
            <div className="font-sans text-[12px] text-ks-muted leading-relaxed">
              Make sure you&apos;re using a Claude client that supports
              connectors. If you see &quot;invalid URL,&quot; check for trailing
              spaces. Still stuck?{" "}
              <a href="mailto:support@kitstack.co" className="text-ks-accent hover:underline">
                support@kitstack.co
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
