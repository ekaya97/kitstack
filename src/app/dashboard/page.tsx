import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import { Avatar } from "@/components/ui/avatar";

const activeKits = [
  {
    slug: "crm-kit",
    name: "CRM Kit",
    cat: "Revenue",
    price: 5,
    lastUsed: "2 hours ago",
    toolCalls: 342,
    dbRows: 1284,
    status: "Healthy",
  },
  {
    slug: "expense-kit",
    name: "Expense & Tax Prep Kit",
    cat: "Finance",
    price: 5,
    lastUsed: "Yesterday",
    toolCalls: 128,
    dbRows: 467,
    status: "Healthy",
  },
];

const downloadedSkills = [
  { name: "Client Proposal Skill", cat: "Revenue", date: "12 Mar" },
  { name: "Contract Red Flag Skill", cat: "Legal", date: "28 Feb" },
  { name: "LinkedIn Content Skill", cat: "Marketing", date: "15 Jan" },
];

const totalPrice = activeKits.reduce((s, k) => s + k.price, 0);
const totalSaving = 76; // replaces value minus cost

export default function DashboardPage() {
  return (
    <div className="bg-ks-paper">
      <Nav />

      {/* TOP SUMMARY STRIP */}
      <section className="px-16 pt-12 pb-8 flex items-end justify-between">
        <div className="flex items-center gap-5">
          <Avatar name="Lena M" size={48} tone="#3b7a3b" />
          <div>
            <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-1">
              YOUR SHELF
            </div>
            <h1 className="font-serif text-[44px] leading-none tracking-tight text-ks-ink">
              Good morning, Lena.
            </h1>
            <div className="font-sans text-[15px] text-ks-muted mt-1.5">
              {activeKits.length} kits active &middot; saving{" "}
              <span className="font-semibold text-ks-accent">
                &euro;{totalSaving}/mo
              </span>
            </div>
          </div>
        </div>
        <div className="flex gap-2.5">
          <button className="ks-btn !py-2.5 !px-4 !text-[13px]">
            Invoices
          </button>
          <button className="ks-btn ks-btn-primary !py-2.5 !px-4 !text-[13px]">
            Browse kits &rarr;
          </button>
        </div>
      </section>

      {/* TWO-COLUMN BODY */}
      <section className="px-16 pb-16 grid grid-cols-[2fr_1fr] gap-6 items-start">
        {/* LEFT COLUMN */}
        <div className="flex flex-col gap-5">
          <div className="font-mono text-[11px] text-ks-muted tracking-[1px]">
            ACTIVE KITS
          </div>

          {activeKits.map((kit) => (
            <div key={kit.slug} className="ks-card p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <CatMark cat={kit.cat} size={22} />
                  <h3 className="font-serif text-[24px] tracking-tight">
                    {kit.name}
                  </h3>
                </div>
                <div className="font-serif text-[20px] text-ks-ink italic">
                  &euro;{kit.price}/mo
                </div>
              </div>

              {/* Connection status */}
              <div className="flex items-center gap-2 mb-4 font-mono text-[11px] text-ks-muted">
                <span className="text-[#3b7a3b] font-semibold">Connected</span>
                <span>&middot;</span>
                <span>mcp.kitstack.co/{kit.slug}</span>
                <span>&middot;</span>
                <span className="inline-flex items-center gap-1 text-[#3b7a3b]">
                  <span className="text-[8px]">&#9679;</span> live
                </span>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: "Last used", value: kit.lastUsed },
                  {
                    label: "Tool calls",
                    value: kit.toolCalls.toLocaleString(),
                  },
                  { label: "DB rows", value: kit.dbRows.toLocaleString() },
                  { label: "Status", value: kit.status },
                ].map((s) => (
                  <div
                    key={s.label}
                    className="bg-ks-paper-warm rounded-lg p-3"
                  >
                    <div className="font-mono text-[9px] text-ks-muted tracking-wider mb-1">
                      {s.label.toUpperCase()}
                    </div>
                    <div className="font-sans text-[14px] font-semibold text-ks-ink">
                      {s.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2.5">
                <button className="ks-btn ks-btn-primary !py-2 !px-3.5 !text-[12px]">
                  Open in Claude
                </button>
                <button className="ks-btn !py-2 !px-3.5 !text-[12px]">
                  Export data
                </button>
                <button className="ks-btn !py-2 !px-3.5 !text-[12px]">
                  Settings
                </button>
                <button className="ks-btn !py-2 !px-3.5 !text-[12px] !text-red-600 !border-red-200 hover:!border-red-400">
                  Cancel
                </button>
              </div>
            </div>
          ))}

          {/* Upgrade recommendation */}
          <div className="bg-ks-accent-soft border border-ks-accent/20 rounded-xl p-5 flex items-center justify-between">
            <div>
              <div className="font-serif text-[22px] tracking-tight text-ks-ink">
                Upgrade to Pro &mdash; all 4 kits for{" "}
                <span className="italic text-ks-accent">&euro;19/mo</span>
              </div>
              <div className="font-sans text-[13px] text-ks-muted mt-1">
                You&apos;re paying &euro;{totalPrice}/mo for {activeKits.length}{" "}
                kits. Pro gives you all 4 + priority support.
              </div>
            </div>
            <button className="ks-btn ks-btn-accent !py-2.5 !px-5 !text-[13px] shrink-0">
              Upgrade to Pro &rarr;
            </button>
          </div>
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="flex flex-col gap-5">
          {/* Connector card */}
          <div className="ks-card p-5">
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2.5">
              YOUR CONNECTOR
            </div>
            <div className="flex items-center gap-2 bg-ks-ink rounded-lg px-3.5 py-2.5 mb-3">
              <code className="font-mono text-[12px] text-ks-paper flex-1 truncate">
                mcp.kitstack.co/u/lena
              </code>
              <button className="font-mono text-[10px] text-ks-accent hover:text-ks-accent-deep shrink-0">
                COPY
              </button>
            </div>
            <div className="font-sans text-[12px] text-ks-muted leading-relaxed">
              Paste this URL into Claude &rarr; Settings &rarr; Connectors. All
              your active kits appear automatically.
            </div>
          </div>

          {/* Billing card */}
          <div className="ks-card p-5">
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2.5">
              BILLING
            </div>
            <div className="flex flex-col gap-2">
              {[
                { label: "Plan", value: "Starter" },
                {
                  label: "Monthly",
                  value: `€${totalPrice}`,
                },
                { label: "Next charge", value: "1 May 2026" },
                { label: "Card", value: "•••• 4242" },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex justify-between items-center py-1.5 border-b border-ks-hair last:border-0"
                >
                  <span className="font-sans text-[13px] text-ks-muted">
                    {row.label}
                  </span>
                  <span className="font-sans text-[13px] font-semibold text-ks-ink">
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Downloaded Skills */}
          <div className="ks-card p-5">
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-2.5">
              DOWNLOADED SKILLS
            </div>
            <div className="flex flex-col gap-2.5">
              {downloadedSkills.map((skill) => (
                <div
                  key={skill.name}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center gap-2">
                    <CatMark cat={skill.cat} size={16} />
                    <span className="font-sans text-[13px] text-ks-ink">
                      {skill.name}
                    </span>
                  </div>
                  <button className="font-mono text-[10px] text-ks-accent hover:text-ks-accent-deep">
                    re-download
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Data ownership note */}
          <div className="bg-ks-paper-warm border border-ks-hair rounded-xl p-4">
            <div className="font-sans text-[12px] text-ks-muted leading-relaxed">
              <span className="font-semibold text-ks-ink">Your data.</span> All
              databases are hosted in Frankfurt, GDPR-compliant. Export anytime
              as JSON or CSV. If you cancel, your data stays downloadable for 90
              days.
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
