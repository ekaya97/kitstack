"use client";

import { useState } from "react";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { FAQ } from "@/components/shared/faq";
import type { KitCardData } from "@/services/transformers";

interface PricingClientProps {
  kits: KitCardData[];
}

export function PricingClient({ kits }: PricingClientProps) {
  const [yearly, setYearly] = useState(false);

  const price = (monthly: number) =>
    yearly ? monthly * 10 : monthly;
  const suffix = yearly ? "/year" : "/mo";

  const totalSaasMonthly = kits.reduce((s, k) => s + k.replacesValue, 0);

  return (
    <div className="bg-ks-paper">
      <Nav active="Pricing" />

      {/* ───── HERO ───── */}
      <section className="px-4 sm:px-8 lg:px-16 pt-10 sm:pt-12 lg:pt-[72px] pb-14 text-center max-w-3xl mx-auto">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-3">
          &sect; PRICING
        </div>
        <h1 className="font-serif text-[32px] sm:text-[52px] lg:text-[72px] leading-[0.98] tracking-[-2px] text-ks-ink">
          Start free.{" "}
          <span className="italic text-ks-accent">Upgrade when sticky.</span>
        </h1>
        <p className="font-sans text-[17px] text-ks-muted mt-6 max-w-xl mx-auto leading-relaxed">
          Skills are always free. Kits run on our servers with your own
          private database &mdash; the subscription covers hosting and
          ongoing development.
        </p>

        {/* Billing toggle */}
        <div className="mt-8 inline-flex items-center bg-ks-paper-warm rounded-full p-1 border border-ks-hair">
          <button
            onClick={() => setYearly(false)}
            className={`px-5 py-2 rounded-full font-sans text-sm transition-colors ${!yearly
              ? "bg-ks-ink text-ks-paper font-semibold"
              : "text-ks-muted hover:text-ks-ink"
              }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setYearly(true)}
            className={`px-5 py-2 rounded-full font-sans text-sm transition-colors ${yearly
              ? "bg-ks-ink text-ks-paper font-semibold"
              : "text-ks-muted hover:text-ks-ink"
              }`}
          >
            Yearly &middot; save 16%
          </button>
        </div>
      </section>

      {/* ───── PRICING TIERS ───── */}
      <section className="px-4 sm:px-8 lg:px-16 pb-20">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
          {/* FREE */}
          <div className="ks-card p-7 h-full">
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1">
              FREE
            </div>
            <div className="font-serif text-[26px] sm:text-[36px] lg:text-[44px] tracking-tight leading-none">
              &euro;0
            </div>
            <div className="font-sans text-xs text-ks-muted mt-1 mb-6">
              forever
            </div>
            <ul className="m-0 p-0 list-none font-sans text-[13px] text-ks-ink2 leading-[2]">
              <li>&#10003; Every skill, free to download</li>
              <li>&#10003; Works in Claude, Code &amp; VS Code</li>
              <li>&#10003; 1 free kit trial per day <span className="text-xs italic text-ks-faint">coming soon</span></li>
              <li>&#10003; Email updates</li>
            </ul>
            <button className="ks-btn mt-6 w-full !text-[13px]">
              Browse skills
            </button>
          </div>

          {/* STARTER */}
          <div className="ks-card p-7 h-full">
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1">
              STARTER
            </div>
            <div className="font-serif text-[26px] sm:text-[36px] lg:text-[44px] tracking-tight leading-none">
              &euro;{price(5)}
            </div>
            <div className="font-sans text-xs text-ks-muted mt-1 mb-6">
              {yearly ? "/year per kit" : "/mo per kit"}
            </div>
            <ul className="m-0 p-0 list-none font-sans text-[13px] text-ks-ink2 leading-[2]">
              <li>&#10003; 2 kits of your choice</li>
              <li>&#10003; Private database, EU-hosted</li>
              <li>&#10003; Multi-client (Claude, ChatGPT, Gemini)</li>
              <li>&#10003; Cancel anytime</li>
            </ul>
            <button className="ks-btn ks-btn-primary mt-6 w-full !text-[13px]">
              Pick a kit &rarr;
            </button>
          </div>

          {/* PRO — HIGHLIGHTED */}
          <div className="relative h-full">
            <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 px-3 py-1 bg-ks-accent text-white font-mono text-[10px] tracking-wider rounded-full">
              MOST POPULAR
            </div>
            <div
              className="ks-card-ink p-7 relative h-full"
              style={{
                boxShadow: "0 0 40px rgba(214, 90, 47, 0.18), 0 0 80px rgba(214, 90, 47, 0.08)",
              }}
            >
              <div className="font-mono text-[10px] text-ks-accent tracking-wider mb-1">
                PRO
              </div>
              <div className="font-serif text-[26px] sm:text-[36px] lg:text-[44px] tracking-tight leading-none text-ks-paper">
                &euro;{price(19)}
              </div>
              <div className="font-sans text-xs text-ks-faint mt-1 mb-6">
                {suffix}
              </div>
              <ul className="m-0 p-0 list-none font-sans text-[13px] text-ks-paper-deep leading-[2]">
                <li>&#10003; Every kit included</li>
                <li>&#10003; Full data export</li>
                <li>&#10003; Early access + Priority Support</li>
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
          <div className="ks-card p-7 h-full">
            <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-1">
              TEAM
            </div>
            <div className="font-serif text-[40px] tracking-tight leading-none">
              Get in touch
            </div>
            <div className="font-sans text-xs text-ks-muted mt-1 mb-6">
              {yearly ? "/year per seat" : "/seat/mo"}
            </div>
            <ul className="m-0 p-0 list-none font-sans text-[13px] text-ks-ink2 leading-[2]">
              <li>&#10003; Shared team databases</li>
              <li>&#10003; Roles &amp; permissions &amp; SSO &amp; Audit logs</li>
              <li>&#10003; Centralised team billing</li>
              <li>&#10003; Onboarding call</li>
            </ul>
            <a href="mailto:hello@kitstack.co">
              <button className="ks-btn mt-6 w-full !text-[13px]">
                Talk to us &rarr;
              </button>
            </a>
          </div>
        </div>
      </section>

      {/* ───── SAAS COMPARISON ───── */}
      <section className="px-4 sm:px-8 lg:px-16 py-20 bg-ks-paper-warm border-y border-ks-hair">
        <div className="max-w-5xl mx-auto">
          <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
            &sect; WHY PRO IS A BARGAIN
          </div>
          <h2 className="font-serif text-[28px] sm:text-[40px] lg:text-[52px] tracking-tight mb-10">
            &euro;19/mo vs.{" "}
            <span className="ks-strike text-ks-muted">
              &euro;{totalSaasMonthly}/mo
            </span>{" "}
            SaaS stack.
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_0.7fr] gap-5">
            {/* Left — per-kit breakdown */}
            <div className="ks-card p-7">
              {kits.map((kit, i) => (
                <div
                  key={kit.slug}
                  className={`flex items-center justify-between py-4 ${i < kits.length - 1 ? "border-b border-ks-hair" : ""
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
                Every kit. One subscription.
              </div>
              <div className="mt-5 px-4 py-2 rounded-full bg-ks-ink2 font-mono text-xs text-ks-accent">
                Save &euro;{(totalSaasMonthly - 19) * 12}/year
              </div>
            </div>
          </div>
        </div>
      </section>

      <FAQ />

      <Footer />
    </div>
  );
}
