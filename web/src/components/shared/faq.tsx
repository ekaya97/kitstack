const faqs = [
  {
    q: "What's the difference between a skill and a kit?",
    a: "A skill is a free .zip file you upload to your AI — it makes it an expert at one task, but has no memory. A kit is a subscription app with a database, interactive UI, and cross-session persistence. Think of a skill as the demo, a kit as the full product.",
  },
  {
    q: "Which AI tools are supported?",
    a: "Skills work with any AI that accepts file uploads — Claude, ChatGPT, Gemini, VS Code, and more. Kits use the MCP protocol and work with Claude, ChatGPT, VS Code with Copilot, Cursor, and any MCP-compatible client.",
  },
  {
    q: "Do I need a paid AI subscription?",
    a: "For skills: you need a plan that supports file uploads (Claude Pro, ChatGPT Plus, Gemini Advanced, etc.). For kits: you need a plan that supports connectors or MCP, plus a KitStack Starter subscription.",
  },
  {
    q: "What happens to my data if I cancel?",
    a: "Your data stays accessible for 90 days after cancellation. You can export everything as CSV or JSON at any time using the built-in export tools. After 90 days, databases are permanently deleted.",
  },
  {
    q: "Is my data private?",
    a: "Yes. Each kit gets its own isolated database — no other user can access it. All data is stored in the EU (Frankfurt). You own your data and can export or delete it anytime.",
  },
  {
    q: "Why €5/mo and not free?",
    a: "Skills are free because they cost us nothing to serve — they're static files. Kits require per-user databases, server hosting, and interactive UI. €5/mo covers infrastructure while staying cheaper than any single SaaS tool a kit replaces.",
  },
];

export function FAQ() {
  return (
    <section className="px-4 sm:px-8 lg:px-16 py-20">
      <div className="max-w-5xl mx-auto">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
          &sect; FAQ
        </div>
        <h2 className="font-serif text-[28px] sm:text-[40px] lg:text-[52px] tracking-tight mb-10">
          Questions,{" "}
          <span className="italic text-ks-accent">answered.</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {faqs.map((faq) => (
            <div key={faq.q} className="ks-card p-6">
              <div className="font-serif text-lg mb-2">{faq.q}</div>
              <div className="font-sans text-[13px] text-ks-muted leading-relaxed">
                {faq.a}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
