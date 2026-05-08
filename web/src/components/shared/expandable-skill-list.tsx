"use client";

import { useState } from "react";
import Link from "next/link";
import { CatMark } from "@/components/ui/cat-mark";

type SkillCard = {
  slug: string;
  name: string;
  desc: string;
  cat: string;
  downloads: number;
};

const INITIAL_COUNT = 5;

export function ExpandableSkillList({ skills }: { skills: SkillCard[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? skills : skills.slice(0, INITIAL_COUNT);
  const hasMore = skills.length > INITIAL_COUNT;

  return (
    <div className="ks-card divide-y divide-ks-hair">
      {visible.map((skill) => (
        <Link
          key={skill.slug}
          href={`/skills/${skill.slug}`}
          className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 hover:bg-ks-paper-warm transition-colors"
        >
          <CatMark cat={skill.cat} size={24} />
          <div className="flex-1 min-w-0 basis-[180px]">
            <div className="font-sans text-[14px] font-medium text-ks-ink">
              {skill.name}
            </div>
            <div className="font-sans text-[12px] text-ks-muted truncate">
              {skill.desc}
            </div>
          </div>
          <span className="ks-chip !text-[10px] shrink-0">{skill.cat}</span>
          <span className="font-sans text-[12px] text-ks-muted shrink-0">
            {skill.downloads.toLocaleString()} downloads
          </span>
          <span className="font-serif text-[14px] italic text-ks-accent shrink-0">
            Free
          </span>
        </Link>
      ))}
      {hasMore && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="w-full px-5 py-3.5 text-center font-sans text-[13px] text-ks-muted hover:text-ks-ink hover:bg-ks-paper-warm transition-colors cursor-pointer"
        >
          Show {skills.length - INITIAL_COUNT} more skills &darr;
        </button>
      )}
    </div>
  );
}
