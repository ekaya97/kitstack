import { useState, useRef } from "react";
import { AppShell } from "@shared/app-shell";
import { useAppData } from "@shared/use-app-data";
import { useKitActions } from "@shared/use-kit-actions";
import { ActionButton } from "@shared/action-button";
import type { Sequence, Email } from "@shared/types";

function EmailCard({ email }: { email: Email }) {
  const bodyPreview = (email.body || "").split("\n").filter(Boolean).slice(0, 2).join(" ");
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="w-7 h-7 rounded-full bg-ks-accent text-white flex items-center justify-center text-xs font-mono font-medium shrink-0">
          {email.position}
        </div>
        <div className="w-px flex-1 bg-ks-hair" />
      </div>
      <div className="flex-1 bg-white border border-ks-hair rounded-lg p-3 mb-3">
        <div className="flex items-center gap-2 mb-1.5">
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-ks-paper-deep text-ks-muted">
            +{email.delay_days}d
          </span>
          <span className="text-[13px] font-medium text-ks-ink truncate">{email.subject}</span>
        </div>
        <p className="text-xs text-ks-muted leading-relaxed line-clamp-2">{bodyPreview}</p>
      </div>
    </div>
  );
}

function SequenceCard({
  sequence,
  isExpanded,
  onToggle,
  onExport,
}: {
  sequence: Sequence;
  isExpanded: boolean;
  onToggle: () => void;
  onExport: () => void;
}) {
  return (
    <div className="mb-4">
      <div
        className="flex items-center justify-between bg-ks-paper-warm rounded-lg p-3 cursor-pointer hover:bg-ks-paper-deep transition-colors"
        onClick={onToggle}
      >
        <div>
          <div className="font-medium text-[13px] text-ks-ink">{sequence.name}</div>
          <div className="text-xs text-ks-muted mt-0.5">
            {sequence.emails?.length ?? 0} emails &middot; {sequence.prospect_count ?? 0} prospects
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div onClick={(e) => e.stopPropagation()}>
            <ActionButton
              label="Export"
              successLabel="Exported!"
              onClick={async () => onExport()}
              className="!text-[10px] !px-2 !py-0.5 !rounded-full"
            />
          </div>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              sequence.status === "active"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-ks-paper-deep text-ks-muted"
            }`}
          >
            {sequence.status}
          </span>
          <span className="text-ks-faint text-xs">{isExpanded ? "\u25B2" : "\u25BC"}</span>
        </div>
      </div>

      {isExpanded && sequence.emails && sequence.emails.length > 0 && (
        <div className="mt-3 ml-2">
          {sequence.emails
            .sort((a, b) => a.position - b.position)
            .map((email) => (
              <EmailCard key={email.id} email={email} />
            ))}
        </div>
      )}
    </div>
  );
}

export function SequenceBuilder() {
  const { data: sequences, loading, error, refetch } = useAppData<Sequence>("sequences");
  const { downloadFile, copyToClipboard, canDownload } = useKitActions();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async (seq: Sequence) => {
    let text = `Sequence: ${seq.name}\nStatus: ${seq.status}\n\n`;
    if (seq.emails?.length) {
      text += "Emails:\n";
      for (const e of seq.emails.sort((a, b) => a.position - b.position)) {
        text += `\n--- Email #${e.position} (delay: ${e.delay_days}d) ---\n`;
        text += `Subject: ${e.subject}\n\n${e.body}\n`;
      }
    }
    const filename = `sequence-${seq.name.toLowerCase().replace(/\s+/g, "-")}.txt`;
    await downloadFile(filename, "text/plain", text);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !sequences?.length) return;

    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(Boolean);
      if (lines.length < 2) return;

      // Parse CSV header
      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
      const nameIdx = headers.indexOf("name");
      const companyIdx = headers.indexOf("company");
      const emailIdx = headers.indexOf("email");

      if (nameIdx === -1) {
        // Invalid CSV — no name column
        return;
        return;
      }

      const mcp = (window as any).__KITSTACK_MCP__;
      if (!mcp?.callTool) return;

      const seqId = sequences[0].id; // Import into first sequence
      let imported = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const name = cols[nameIdx];
        if (!name) continue;

        await mcp.callTool("add_prospect", {
          sequenceId: seqId,
          name,
          ...(companyIdx >= 0 && cols[companyIdx] ? { company: cols[companyIdx] } : {}),
          ...(emailIdx >= 0 && cols[emailIdx] ? { email: cols[emailIdx] } : {}),
        });
        imported++;
      }

      refetch();
      // Import complete — refetch handles UI update
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <AppShell title="Sequence Builder" loading={loading} error={error} onRetry={refetch}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4 text-xs">
          <div>
            <span className="text-ks-muted">Sequences: </span>
            <span className="font-mono font-medium">{sequences?.length ?? 0}</span>
          </div>
          <div>
            <span className="text-ks-muted">Active: </span>
            <span className="font-mono font-medium text-emerald-700">
              {sequences?.filter((s) => s.status === "active").length ?? 0}
            </span>
          </div>
        </div>
        {sequences && sequences.length > 0 && (
          <div className="flex gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleImport}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="px-3 py-1.5 text-xs font-medium border border-ks-hair rounded-lg hover:bg-ks-paper-warm text-ks-muted transition-colors disabled:opacity-50"
            >
              {importing ? "Importing..." : "Import CSV"}
            </button>
          </div>
        )}
      </div>

      {sequences?.map((seq) => (
        <SequenceCard
          key={seq.id}
          sequence={seq}
          isExpanded={expandedId === seq.id}
          onToggle={() => setExpandedId(expandedId === seq.id ? null : seq.id)}
          onExport={() => handleExport(seq)}
        />
      ))}

      {sequences?.length === 0 && (
        <div className="text-center text-ks-faint py-8 text-sm">No sequences yet</div>
      )}
    </AppShell>
  );
}
