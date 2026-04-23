"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import type { SkillCardData } from "@/services/transformers";

const categories = [
  "All",
  "Revenue",
  "Legal",
  "Finance",
  "Sales",
  "Marketing",
  "Ops",
];

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState("All");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [downloadedSlugs, setDownloadedSlugs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((d) => setSkills(d.skills))
      .finally(() => setLoading(false));
    fetch("/api/user/status")
      .then((r) => r.json())
      .then((d) => setDownloadedSlugs(new Set(d.downloadedSlugs)));
  }, []);

  const filtered = useMemo(() => {
    let list = skills;
    if (activeCat !== "All") {
      list = list.filter(
        (s) => s.cat === activeCat || (activeCat === "Ops" && s.cat === "Ops")
      );
    }
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.desc.toLowerCase().includes(q) ||
          s.cat.toLowerCase().includes(q)
      );
    }
    return list;
  }, [skills, activeCat, query]);

  return (
    <div className="bg-ks-paper min-h-screen flex flex-col">
      <Nav active="Skills" />

      {/* HEADER */}
      <section className="px-4 sm:px-8 lg:px-16 pt-10 sm:pt-12 lg:pt-[72px] pb-12 grid grid-cols-1 lg:grid-cols-[1.1fr_1fr] gap-6 sm:gap-10 lg:gap-[60px] items-center">
        <div>
          <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-[18px]">
            FREE SKILLS &middot; NO SIGNUP
          </div>
          <h1 className="font-serif text-[32px] sm:text-[52px] lg:text-[72px] leading-[0.98] tracking-[-2px] text-ks-ink">
            Skills.{" "}
            <span className="italic text-ks-accent">All free.</span>
          </h1>
          <p className="font-sans text-[17px] text-ks-muted mt-[22px] max-w-[500px] leading-relaxed">
            Download a .zip, upload to Claude&apos;s Skills folder, and it
            becomes a domain expert for that task. No account. No server. Works
            forever.
          </p>
        </div>

        {/* Right side: upgrade promo card */}
        <div className="ks-card p-6 border-ks-accent border-[1.5px] relative">
          <div className="absolute -top-2.5 right-5 px-2.5 py-0.5 bg-ks-accent text-white font-mono text-[10px] tracking-wider rounded-[3px]">
            UPGRADE PATH
          </div>
          <div className="font-serif text-[26px] tracking-tight mb-2">
            Love a skill? Upgrade to a Kit.
          </div>
          <div className="font-sans text-[14px] text-ks-muted leading-relaxed mb-4">
            Kits add a database, interactive UI inside the chat, and memory that
            survives sessions. Same domain expertise &mdash; now with persistent
            data.
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/kits"
              className="ks-btn ks-btn-accent !text-[13px] !py-2 !px-4"
            >
              See kits &rarr;
            </Link>
            <span className="font-mono text-[11px] text-ks-muted">
              from &euro;5/mo &middot; all kits included
            </span>
          </div>
        </div>
      </section>

      {/* CATEGORY FILTER + SEARCH */}
      <div className="px-4 sm:px-8 lg:px-16 pb-8 flex flex-wrap items-center gap-2 overflow-hidden">
        {/* Search icon — always on left */}
        <button
          onClick={() => {
            setSearchOpen(!searchOpen);
            if (searchOpen) setQuery("");
          }}
          className={`w-9 h-7 rounded-full border flex items-center justify-center transition-colors cursor-pointer shrink-0 ${searchOpen
            ? "border-ks-accent bg-ks-accent text-white"
            : "border-ks-hair bg-white text-ks-muted hover:border-ks-accent"
            }`}
          title="Search"
        >
          {searchOpen ? (
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 3l8 8M11 3l-8 8" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <circle cx="7" cy="7" r="5" />
              <path d="M11 11l3.5 3.5" />
            </svg>
          )}
        </button>

        {searchOpen ? (
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skills by name, category, description..."
            className="font-sans text-sm bg-white border border-ks-hair max-h-8 max-w-3xl rounded-full px-4 py-2 flex-1 outline-none focus:border-ks-accent transition-colors animate-[slideIn_0.2s_ease-out]"
          />
        ) : (
          categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCat(cat);
                setQuery("");
              }}
              className={`ks-chip ${activeCat === cat ? "ks-chip-solid" : ""} cursor-pointer transition-colors`}
            >
              {cat !== "All" && <CatMark cat={cat} size={12} />}
              {cat}
            </button>
          ))
        )}
      </div>

      {/* SKILLS GRID */}
      <section className="px-4 sm:px-8 lg:px-16 pb-[72px]">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="ks-card p-5 animate-pulse">
                <div className="flex justify-between mb-3">
                  <div className="h-5 w-20 bg-ks-hair rounded-full" />
                  <div className="h-5 w-12 bg-ks-hair rounded-full" />
                </div>
                <div className="h-6 w-3/4 bg-ks-hair rounded mb-3" />
                <div className="h-4 w-full bg-ks-hair/60 rounded mb-1.5" />
                <div className="h-4 w-2/3 bg-ks-hair/60 rounded mb-6" />
                <div className="h-3 w-1/2 bg-ks-hair/40 rounded mb-4" />
                <div className="flex gap-2.5 mt-auto">
                  <div className="h-9 flex-1 bg-ks-hair rounded-full" />
                  <div className="h-9 w-20 bg-ks-hair/60 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <div className="font-serif text-3xl text-ks-muted mb-2">
              No skills found
            </div>
            <div className="font-sans text-sm text-ks-muted">
              Try a different category or search term.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-[18px]">
            {filtered.map((skill) => (
              <div key={skill.slug} className="ks-card p-5 flex flex-col">
                {/* Top row: category + FREE chip */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <CatMark cat={skill.cat} />
                    <span className="ks-chip !text-[10px]">
                      {skill.cat}
                    </span>
                  </div>
                  <span className="ks-chip !text-[10px] !border-ks-ink !text-ks-ink">
                    FREE
                  </span>
                </div>

                {/* Title + description */}
                <h3 className="font-serif text-[22px] tracking-tight leading-tight mb-1.5">
                  {skill.name}
                </h3>
                <p className="font-sans text-[13px] text-ks-muted leading-relaxed mb-4 flex-1">
                  {skill.desc}
                </p>

                {/* Metadata */}
                <div className="font-mono text-[10px] text-ks-muted tracking-wide mb-3.5 flex gap-3">
                  <span>{skill.files} files</span>
                  <span>&middot;</span>
                  <span>{skill.size}</span>
                  <span>&middot;</span>
                  <span>
                    {skill.downloads.toLocaleString()} downloads
                  </span>
                </div>

                {/* Upgrade banner (if applicable) */}
                {skill.upgradeTo && (
                  <Link href={`/kits/${skill.upgradeTo}`} className="bg-ks-accent-soft rounded-lg px-3.5 py-2.5 mb-3.5 block hover:opacity-90 transition-opacity">
                    <div className="font-mono text-[9px] text-ks-accent-deep tracking-wider mb-1">
                      UPGRADE TO KIT
                    </div>
                    <div className="font-sans text-[12px] text-ks-accent-deep leading-snug">
                      {skill.upgradeHook}
                    </div>
                  </Link>
                )}

                {/* Buttons */}
                <div className="flex gap-2.5 mt-auto">
                  {downloadedSlugs.has(skill.slug) ? (
                    <>
                      <Link
                        href={`/skills/${skill.slug}`}
                        className="ks-btn !text-[12px] !py-2 !px-4 !border-green-600 !text-green-700"
                      >
                        &#10003; Downloaded
                      </Link>
                      <Link
                        href={`/skills/${skill.slug}`}
                        className="ks-btn !text-[12px] !py-2 !px-4"
                      >
                        View skill
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link
                        href={`/skills/${skill.slug}`}
                        className="ks-btn ks-btn-primary !text-[12px] !py-2 !px-4"
                      >
                        Download
                      </Link>
                      <Link
                        href={`/skills/${skill.slug}`}
                        className="ks-btn !text-[12px] !py-2 !px-4"
                      >
                        Try it
                      </Link>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
