const files = [
  { name: "SKILL.md", type: "file" as const, desc: "System prompt & methodology" },
  {
    name: "references/",
    type: "dir" as const,
    children: [
      { name: "methodology.md", desc: "Expert framework" },
      { name: "pricing-guide.md", desc: "Rate benchmarks" },
    ],
  },
  {
    name: "examples/",
    type: "dir" as const,
    children: [
      { name: "input-brief.md", desc: "Sample client brief" },
      { name: "output-proposal.md", desc: "Generated output" },
    ],
  },
  {
    name: "templates/",
    type: "dir" as const,
    children: [{ name: "proposal-template.md", desc: "Reusable structure" }],
  },
];

export function SkillZipContents() {
  return (
    <div className="rounded-xl border border-ks-hair overflow-hidden bg-ks-paper-warm">
      <div className="bg-ks-paper-deep px-4 py-2.5 border-b border-ks-hair flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-ks-accent shrink-0">
          <rect x="1" y="3" width="14" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" />
          <path d="M1 5.5h14" stroke="currentColor" strokeWidth="1.3" />
          <path d="M4 3V1.5A.5.5 0 014.5 1h3a.5.5 0 01.5.5V3" stroke="currentColor" strokeWidth="1.3" />
        </svg>
        <span className="font-mono text-[11px] text-ks-ink font-medium">
          proposal-skill.zip
        </span>
        <span className="font-mono text-[10px] text-ks-faint ml-auto">
          6 files &middot; 24 KB
        </span>
      </div>

      <div className="px-4 py-3 space-y-0.5">
        {files.map((item) =>
          item.type === "file" ? (
            <div key={item.name} className="flex items-center gap-2 py-[3px]">
              <FileIcon />
              <span className="font-mono text-[11.5px] text-ks-ink">
                {item.name}
              </span>
              <span className="font-mono text-[10px] text-ks-faint ml-auto">
                {item.desc}
              </span>
            </div>
          ) : (
            <div key={item.name}>
              <div className="flex items-center gap-2 py-[3px]">
                <FolderIcon />
                <span className="font-mono text-[11.5px] text-ks-muted font-medium">
                  {item.name}
                </span>
              </div>
              <div className="ml-[7px] border-l border-ks-hair pl-3">
                {item.children.map((child) => (
                  <div
                    key={child.name}
                    className="flex items-center gap-2 py-[3px]"
                  >
                    <FileIcon />
                    <span className="font-mono text-[11.5px] text-ks-ink">
                      {child.name}
                    </span>
                    <span className="font-mono text-[10px] text-ks-faint ml-auto">
                      {child.desc}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )
        )}
      </div>

      <div className="px-4 py-2.5 text-center font-sans text-[12px] text-ks-muted border-t border-ks-hair">
        Each skill is a .zip with SKILL.md, references, and examples
      </div>
    </div>
  );
}

function FileIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-ks-faint shrink-0">
      <path
        d="M4.5 1.5h5l4 4v9a1 1 0 01-1 1h-8a1 1 0 01-1-1v-12a1 1 0 011-1z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M9.5 1.5v4h4" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" className="text-ks-accent shrink-0">
      <path
        d="M1.5 3.5a1 1 0 011-1h3.586a1 1 0 01.707.293L8.5 4.5h5a1 1 0 011 1v8a1 1 0 01-1 1h-12a1 1 0 01-1-1v-10z"
        stroke="currentColor"
        strokeWidth="1.2"
      />
    </svg>
  );
}
