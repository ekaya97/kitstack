"use client";

import { useState } from "react";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { KITS } from "@/data/kits";

export default function PricingPage() {
  const [yearly, setYearly] = useState(false);

  const price = (monthly: number) =>
    yearly ? monthly * 10 : monthly;
  const suffix = yearly ? "/year" : "/mo";

  const totalSaasMonthly = KITS.reduce((s, k) => s + k.replacesValue, 0);

  return (
    <div className="bg-ks-paper">
      <Nav active="Pricing" />

      {/* ───── HERO ───── */}
      <section className="px-16 pt-[72px] pb-14 text-center max-w-3xl mx-auto">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-3">
          &sect; PRICING
        </div>
        <h1 className="font-serif text-[72px] leading-[0.98] tracking-[-2px] text-ks-ink">
          Start free.{" "}
          <span className="italic text-ks-accent">Upgrade when sticky.</span>
        </h1>
        <p className="font-sans text-[17px] text-ks-muted mt-6 max-w-xl mx-auto leading-relaxed">
          Skills are free because they&apos;re static files &mdash; no server,
          no cost. Kits need a database, a connector, and ongoing hosting.
          That&apos;s what the subscription covers.
        </p>

        {/* Billing toggle */}
        <div className="mt-8 inline-flex items-center bg-ks-paper-warm rounded-full p-1 border border-ks-hair">
          <button
            onClick={() => setYearly(false)}
            className={`px-5 py-2 rounded-full font-sans text-sm transition-colors ${
              !yearly
                ? "bg-ks-ink text-ks-paper font-semibold"
                : "text-ks-muted hover:text-ks-ink"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`px-5 py-2 rounded-full font-sans text-sm transition-colors ${
              yearly
                ? "bg-ks-ink text-ks-paper font-semibold"
                : "text-ks-muted hover:text-ks-ink"
            }`}
          >
            Yearly &middot; save 16%
          </button>
        </div>
      </section>

      {/* ───── PRICING TIERS ───── */}
      <section className="px-16 pb-20">
        <div className="grid grid-cols-4 gap-5 items-start">
          {/* FREE */}
          <div className="ks-card p-7">
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1">
              FREE
            </div>
            <div className="font-serif text-[44px] tracking-tight leading-none">
              &euro;0
            </div>
            <div className="font-sans text-xs text-ks-muted mt-1 mb-6">
              forever
            </div>
            <ul className="m-0 p-0 list-none font-sans text-[13px] text-ks-ink2 leading-[2]">
              <li>&#10003; 6 downloadable skills</li>
              <li>&#10003; Works in Claude, Code &amp; VS Code</li>
              <li>&#10003; 1 free kit trial per day</li>
              <li>&#10003; Email updates</li>
            </ul>
            <button className="ks-btn mt-6 w-full !text-[13px]">
              Browse skills
            </button>
          </div>

          {/* STARTER */}
          <div className="ks-card p-7">
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1">
              STARTER
            </div>
            <div className="font-serif text-[44px] tracking-tight leading-none">
              &euro;{price(5)}
            </div>
            <div className="font-sans text-xs text-ks-muted mt-1 mb-6">
              {yearly ? "/year per kit" : "/mo per kit"}
            </div>
            <ul className="m-0 p-0 list-none font-sans text-[13px] text-ks-ink2 leading-[2]">
              <li>&#10003; 1 kit of your choice</li>
              <li>&#10003; Per-user DB, Frankfurt</li>
              <li>&#10003; Full data export</li>
              <li>&#10003; Multi-client (Claude, VS Code)</li>
              <li>&#10003; Cancel anytime</li>
            </ul>
            <button className="ks-btn ks-btn-primary mt-6 w-full !text-[13px]">
              Pick a kit &rarr;
            </button>
          </div>

          {/* PRO — HIGHLIGHTED */}
          <div className="relative">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 px-3 py-1 bg-ks-accent text-white font-mono text-[10px] tracking-wider rounded-full">
              MOST POPULAR
            </div>
            <div
              className="ks-card-ink p-7 relative"
              style={{
                boxShadow: "0 0 40px rgba(214, 90, 47, 0.18), 0 0 80px rgba(214, 90, 47, 0.08)",
              }}
            >
              <div className="font-mono text-[10px] text-ks-accent tracking-wider mb-1">
                PRO
              </div>
              <div className="font-serif text-[44px] tracking-tight leading-none text-ks-paper">
                &euro;{price(19)}
              </div>
              <div className="font-sans text-xs text-ks-faint mt-1 mb-6">
                {suffix}
              </div>
              <ul className="m-0 p-0 list-none font-sans text-[13px] text-ks-paper-deep leading-[2]">
                <li>&#10003; All 4 kits included</li>
                <li>&#10003; Priority support</li>
                <li>&#10003; Early access to new kits</li>
                <li>
                  &#10003; Replaces{" "}
                  <span className="ks-strike text-ks-faint">
                    &euro;{totalSaasMonthly}/mo
                  </span>{" "}
                  of SaaS
                </li>
              </ul>
              <button className="ks-btn ks-btn-accent mt-6 w-full !text-[13px]">
                Go Pro &rarr;
              </button>
            </div>
          </div>

          {/* TEAM */}
          <div className="ks-card p-7">
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1">
              TEAM
            </div>
            <div className="font-serif text-[44px] tracking-tight leading-none">
              &euro;{price(14)}
            </div>
            <div className="font-sans text-xs text-ks-muted mt-1 mb-6">
              {yearly ? "/year per seat" : "/seat/mo"}
            </div>
            <ul className="m-0 p-0 list-none font-sans text-[13px] text-ks-ink2 leading-[2]">
              <li>&#10003; Shared team databases</li>
              <li>&#10003; Roles &amp; permissions</li>
              <li>&#10003; Centralised team billing</li>
              <li>&#10003; Onboarding call</li>
            </ul>
            <button className="ks-btn mt-6 w-full !text-[13px]">
              Talk to us &rarr;
            </button>
          </div>
        </div>
      </section>

      {/* ───── SAAS COMPARISON ───── */}
      <section className="px-16 py-20 bg-ks-paper-warm border-y border-ks-hair">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
            &sect; WHY PRO IS A BARGAIN
          </div>
          <h2 className="font-serif text-[52px] tracking-tight mb-10">
            &euro;19/mo vs.{" "}
            <span className="ks-strike text-ks-muted">
              &euro;{totalSaasMonthly}/mo
            </span>{" "}
            SaaS stack.
          </h2>

          <div className="grid grid-cols-[1.3fr_0.7fr] gap-5">
            {/* Left — per-kit breakdown */}
            <div className="ks-card p-7">
              {KITS.map((kit, i) => (
                <div
                  key={kit.slug}
                  className={`flex items-center justify-between py-4 ${
                    i < KITS.length - 1 ? "border-b border-ks-hair" : ""
                  }`}
                >
                  <div>
                    <div className="font-serif text-lg">{kit.name}</div>
                    <div className="font-sans text-xs text-ks-muted mt-0.5">
                      Replaces{" "}
                      <span className="ks-strike">
                        {kit.replaces.join(" + ")}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-sans text-sm text-ks-muted ks-strike">
                      &euro;{kit.replacesValue}/mo
                    </div>
                    <div className="font-mono text-xs text-ks-accent font-semibold">
                      save &euro;{kit.replacesValue - 5}/mo
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Right — total savings card */}
            <div className="ks-card-ink p-7 flex flex-col justify-center items-center text-center">
              <div className="font-mono text-[10px] text-ks-faint tracking-wider mb-3">
                PRO PLAN
              </div>
              <div className="font-serif text-[64px] text-ks-accent italic leading-none">
                &euro;19
                <span className="text-2xl">/mo</span>
              </div>
              <div className="font-sans text-sm text-ks-paper-deep mt-4">
                All 4 kits. One subscription.
              </div>
              <div className="mt-5 px-4 py-2 rounded-full bg-ks-ink2 font-mono text-xs text-ks-accent">
                Save &euro;{(totalSaasMonthly - 19) * 12}/year
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── FAQ ───── */}
      <section className="px-16 py-20">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
            &sect; FAQ
          </div>
          <h2 className="font-serif text-[52px] tracking-tight mb-10">
            Questions,{" "}
            <span className="italic text-ks-accent">answered.</span>
          </h2>

          <div className="grid grid-cols-2 gap-5">
            {(
              [
                {
                  q: "Why are skills free but kits cost money?",
                  a: "Skills are static .zip files — no server, no database, no running cost for us. Kits run on a managed MCP connector with a per-user Turso database hosted in Frankfurt. The subscription covers hosting, storage, and ongoing development.",
                },
                {
                  q: "Can I cancel anytime?",
                  a: "Yes. Cancel with one click in your dashboard. Your subscription ends at the current billing period. Your data stays exportable for 30 days after cancellation.",
                },
                {
                  q: "Where is my data hosted?",
                  a: "Every kit user gets a dedicated Turso database in Frankfurt, Germany. Your data never leaves the EU. Full GDPR compliance. You can export everything as JSON or CSV at any time.",
                },
                {
                  q: "Does this work with ChatGPT or VS Code?",
                  a: "Skills work everywhere — Claude, ChatGPT, VS Code, any LLM that accepts file uploads. Kits currently require an MCP-compatible client (Claude Desktop, Claude Code, VS Code with Copilot). ChatGPT support is on the roadmap.",
                },
                {
                  q: "Do I need a developer to set this up?",
                  a: "No. Add one MCP connector URL in Claude's settings, sign in with OAuth, and you're done. No terminal, no config files, no code. Takes about 90 seconds.",
                },
                {
                  q: "Is there a free trial for kits?",
                  a: "Every free-tier user gets 1 kit trial per day — full functionality, data resets at midnight. It's enough to see if a kit fits your workflow before subscribing.",
                },
              ] as const
            ).map((faq) => (
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

      <Footer />
    </div>
  );
}
