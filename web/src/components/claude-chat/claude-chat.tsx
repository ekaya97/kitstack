import { Avatar } from "@/components/ui/avatar";

export function ClaudeChat({
  children,
  title = "Claude",
  compact = false,
}: {
  children: React.ReactNode;
  title?: string;
  compact?: boolean;
}) {
  return (
    <div className="border border-ks-hair rounded-xl bg-white overflow-hidden shadow-[0_8px_30px_-10px_rgba(0,0,0,0.12)]">
      <div className="px-3.5 py-2.5 border-b border-ks-hair flex items-center gap-2 bg-[#fafaf7]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#e06b4a]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#f4c95f]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#6bb56b]" />
        <div className="ml-3 flex items-center gap-1.5 font-sans text-xs text-ks-muted">
          <div className="w-4 h-4 rounded bg-ks-accent text-white grid place-items-center font-serif text-[10px] font-bold">
            C
          </div>
          {title}
        </div>
        <div className="ml-auto flex gap-1.5">
          <span className="ks-chip !text-[9px] !py-px !px-1.5 !border-ks-hair !text-ks-muted">
            kitstack &#10003;
          </span>
        </div>
      </div>
      <div
        className={`bg-white flex flex-col gap-3.5 ${compact ? "p-3.5" : "p-5"}`}
      >
        {children}
      </div>
    </div>
  );
}

export function ChatUser({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 items-start">
      <Avatar name="You" size={24} tone="#3b7a3b" />
      <div className="font-sans text-[13.5px] text-ks-ink leading-relaxed pt-0.5 flex-1">
        {children}
      </div>
    </div>
  );
}

export function ChatClaude({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-2.5 items-start">
      <div className="w-6 h-6 rounded bg-ks-accent text-white grid place-items-center font-serif text-[13px] font-bold shrink-0">
        C
      </div>
      <div className="font-sans text-[13.5px] text-ks-ink leading-[1.55] pt-0.5 flex-1">
        {children}
      </div>
    </div>
  );
}

export function ToolCall({
  tool,
  args,
}: {
  tool: string;
  args?: string;
}) {
  return (
    <div className="ml-6 sm:ml-[34px] py-2 px-3 bg-ks-paper-warm border-l-2 border-ks-accent rounded-r-md font-mono text-[11px] text-ks-muted">
      <span className="text-ks-accent font-semibold">&#9674; {tool}</span>
      {args && <span>({args})</span>}
    </div>
  );
}

export function MCPApp({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
  height?: number;
}) {
  return (
    <div className="ml-6 sm:ml-[34px] border-[1.5px] border-ks-hair rounded-[10px] bg-ks-paper overflow-hidden">
      <div className="px-3 py-2 bg-ks-paper-deep border-b border-ks-hair flex items-center gap-1.5 font-mono text-[10px] text-ks-muted tracking-wide">
        <span className="text-ks-accent">&#9635;</span>
        <span>LIVE PREVIEW &middot; {title}</span>
        <span className="ml-auto text-ks-faint">live preview</span>
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}
