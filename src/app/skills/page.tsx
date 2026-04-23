import Link from "next/link";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { CatMark } from "@/components/ui/cat-mark";
import { SKILLS, findKit } from "@/data/kits";

const categories = ["All", "Revenue", "Legal", "Finance", "Sales", "Marketing", "Ops"];

export default function SkillsPage() {
  return (
    <div className="bg-ks-paper">
      <Nav active="Skills" />

      {/* HEADER */}
      <section className="px-16 pt-[72px] pb-12 grid grid-cols-[1.1fr_1fr] gap-[60px] items-center">
        <div>
          <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-[18px]">
            FREE &middot; {SKILLS.length} SKILLS &middot; NO SIGNUP
          </div>
          <h1 className="font-serif text-[72px] leading-[0.98] tracking-[-2px] text-ks-ink">
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

      {/* CATEGORY FILTER */}
      <div className="px-16 pb-8 flex gap-2">
        {categories.map((cat, i) => (
          <span
            key={cat}
            className={`ks-chip ${i === 0 ? "ks-chip-solid" : ""} cursor-pointer`}
          >
            {cat}
          </span>
        ))}
      </div>

      {/* SKILLS GRID */}
      <section className="px-16 pb-[72px]">
        <div className="grid grid-cols-3 gap-[18px]">
          {SKILLS.map((skill) => {
            const kit = skill.upgradeTo ? findKit(skill.upgradeTo) : null;
            return (
              <div key={skill.slug} className="ks-card p-5 flex flex-col">
                {/* Top row: category + FREE chip */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-2">
                    <CatMark cat={skill.cat} />
                    <span className="ks-chip !text-[10px]">{skill.cat}</span>
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
                  <span>{skill.downloads.toLocaleString()} downloads</span>
                </div>

                {/* Upgrade banner (if applicable) */}
                {kit && (
                  <div className="bg-ks-accent-soft rounded-lg px-3.5 py-2.5 mb-3.5">
                    <div className="font-mono text-[9px] text-ks-accent-deep tracking-wider mb-1">
                      UPGRADE TO KIT
                    </div>
                    <div className="font-sans text-[12px] text-ks-accent-deep leading-snug">
                      {skill.upgradeHook}
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2.5 mt-auto">
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
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Footer />
    </div>
  );
}
