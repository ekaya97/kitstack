"use client";

import { useState } from "react";

const providers = [
  {
    id: "claude",
    name: "Claude",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect width="18" height="18" rx="4" fill="#d65a2f" />
        <text x="9" y="13" textAnchor="middle" fill="white" fontSize="11" fontWeight="700" fontFamily="serif">C</text>
      </svg>
    ),
    steps: [
      {
        n: "01",
        title: "Download the skill",
        desc: "Click the download button above. You get a .zip containing a SKILL.md file and reference documents.",
      },
      {
        n: "02",
        title: "Open Claude",
        desc: "Go to claude.ai and create a new Project, or open Claude Code / Claude Desktop.",
      },
      {
        n: "03",
        title: "Add the skill",
        desc: "Drag the .zip into your Project\u2019s knowledge files. Claude reads the SKILL.md and all references automatically.",
        hint: "In Claude Code, drop the folder into .claude/skills/ instead.",
      },
      {
        n: "04",
        title: "Start chatting",
        desc: "The skill activates automatically. Just describe what you need \u2014 Claude will use the skill\u2019s methodology, templates, and examples.",
      },
    ],
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect width="18" height="18" rx="4" fill="#10a37f" />
        <text x="9" y="13" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="sans-serif">G</text>
      </svg>
    ),
    steps: [
      {
        n: "01",
        title: "Download and unzip",
        desc: "Download the .zip and extract it. You\u2019ll see a SKILL.md file and a few reference folders.",
      },
      {
        n: "02",
        title: "Create a Custom GPT",
        desc: "Go to chatgpt.com \u2192 Explore GPTs \u2192 Create. This gives you an Instructions field and a Knowledge section.",
      },
      {
        n: "03",
        title: "Paste instructions + upload files",
        desc: "Open SKILL.md, copy everything, and paste it into the Instructions field. Then upload the reference files (up to 20) into the Knowledge section.",
        hint: "ChatGPT uses search-based retrieval on knowledge files, so each file should be self-contained.",
      },
      {
        n: "04",
        title: "Save and chat",
        desc: "Save the GPT. Open a new conversation with it and describe what you need. The instructions and knowledge files guide ChatGPT\u2019s responses.",
      },
    ],
  },
  {
    id: "gemini",
    name: "Gemini",
    icon: (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <rect width="18" height="18" rx="4" fill="#4285f4" />
        <text x="9" y="13" textAnchor="middle" fill="white" fontSize="9" fontWeight="700" fontFamily="sans-serif">G</text>
      </svg>
    ),
    steps: [
      {
        n: "01",
        title: "Download and unzip",
        desc: "Download the .zip and extract it. You\u2019ll see a SKILL.md file and reference documents.",
      },
      {
        n: "02",
        title: "Create a Gem",
        desc: "Go to gemini.google.com \u2192 Gem manager \u2192 New Gem. You\u2019ll see an instruction text area and a file upload section.",
      },
      {
        n: "03",
        title: "Paste instructions + upload files",
        desc: "Open SKILL.md, copy the content, and paste it into the Gem\u2019s instruction field. Upload the most important reference files (up to 10).",
        hint: "Gemini has a 10-file limit per Gem. If the skill has more, combine related references into single files.",
      },
      {
        n: "04",
        title: "Save and chat",
        desc: "Save the Gem. Start a conversation with it \u2014 Gemini loads all files into its 1M token context window for full access.",
      },
    ],
  },
];

export function SetupGuide() {
  const [active, setActive] = useState("claude");
  const provider = providers.find((p) => p.id === active)!;

  return (
    <div>
      {/* Provider tabs */}
      <div className="flex gap-2 mb-8">
        {providers.map((p) => (
          <button
            key={p.id}
            onClick={() => setActive(p.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-full font-sans text-[13px] font-medium transition-colors cursor-pointer ${
              active === p.id
                ? "bg-ks-ink text-ks-paper"
                : "bg-white border border-ks-hair text-ks-muted hover:text-ks-ink hover:border-ks-line"
            }`}
          >
            {p.icon}
            {p.name}
          </button>
        ))}
      </div>

      {/* Steps */}
      <div className="grid grid-cols-4 gap-4">
        {provider.steps.map((step) => (
          <div key={step.n} className="ks-card p-6">
            <div className="font-serif text-[56px] text-ks-accent italic leading-none">
              {step.n}
            </div>
            <div className="font-serif text-[22px] mt-3">{step.title}</div>
            <div className="font-sans text-[13px] text-ks-muted mt-2 leading-relaxed">
              {step.desc}
            </div>
            {step.hint && (
              <div className="mt-3 px-3 py-2 bg-ks-paper-warm rounded-lg font-sans text-[12px] text-ks-ink2 leading-relaxed border border-ks-hair">
                <span className="font-semibold text-ks-accent">Tip:</span>{" "}
                {step.hint}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
