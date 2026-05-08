"use client";
export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import type { Skill } from "@/db/schema";

const CATEGORIES = ["Revenue", "Legal", "Finance", "Sales", "Marketing", "Operations", "Developer"];
const DEFAULT_COMPATIBILITY = ["claude.ai", "Claude Desktop", "Cowork", "Claude Code"];

interface SkillFormData {
  slug: string;
  name: string;
  category: string;
  description: string;
  upgradeHook: string;
  tags: string;
  compatibility: string;
  exampleInput: string;
  exampleOutput: string;
  whatsInside: string;
  composition: string;
  correspondingKitSlug: string;
  author: string;
  zipFile: File | null;
}

const emptyForm: SkillFormData = {
  slug: "",
  name: "",
  category: "Revenue",
  description: "",
  upgradeHook: "",
  tags: "",
  compatibility: DEFAULT_COMPATIBILITY.join(", "),
  exampleInput: "",
  exampleOutput: "",
  whatsInside: "[]",
  composition: '{"skillMd":true,"references":0,"examples":0,"templates":0,"scripts":0,"agents":0}',
  correspondingKitSlug: "",
  author: "kitstack",
  zipFile: null,
};

export default function AdminSkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SkillFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchSkills = useCallback(async () => {
    const res = await fetch("/api/admin/skills");
    const data = await res.json();
    setSkills(data.skills || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  function openCreate() {
    setForm(emptyForm);
    setEditId(null);
    setError(null);
    setView("create");
  }

  function openEdit(skill: Skill) {
    setForm({
      slug: skill.slug,
      name: skill.name,
      category: skill.category,
      description: skill.description,
      upgradeHook: skill.upgradeHook || "",
      tags: (skill.tags || []).join(", "),
      compatibility: (skill.compatibility || []).join(", "),
      exampleInput: skill.exampleInput || "",
      exampleOutput: skill.exampleOutput || "",
      whatsInside: JSON.stringify(skill.whatsInside || [], null, 2),
      composition: JSON.stringify(skill.composition || {}, null, 2),
      correspondingKitSlug: skill.correspondingKitSlug || "",
      author: skill.author || "kitstack",
      zipFile: null,
    });
    setEditId(skill.id);
    setError(null);
    setView("edit");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const fd = new FormData();
    fd.set("slug", form.slug);
    fd.set("name", form.name);
    fd.set("category", form.category);
    fd.set("description", form.description);
    fd.set("upgradeHook", form.upgradeHook);
    fd.set("tags", JSON.stringify(form.tags.split(",").map((t) => t.trim()).filter(Boolean)));
    fd.set("compatibility", JSON.stringify(form.compatibility.split(",").map((c) => c.trim()).filter(Boolean)));
    fd.set("exampleInput", form.exampleInput);
    fd.set("exampleOutput", form.exampleOutput);
    fd.set("whatsInside", form.whatsInside);
    fd.set("composition", form.composition);
    fd.set("correspondingKitSlug", form.correspondingKitSlug);
    fd.set("author", form.author);
    if (form.zipFile) fd.set("zipFile", form.zipFile);

    const url =
      view === "edit" ? `/api/admin/skills/${editId}` : "/api/admin/skills";
    const method = view === "edit" ? "PUT" : "POST";

    const res = await fetch(url, { method, body: fd });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
      setSaving(false);
      return;
    }

    setSaving(false);
    setView("list");
    fetchSkills();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/admin/skills/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTarget(null);
    fetchSkills();
  }

  function set(field: keyof SkillFormData, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ── List view ─────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-[28px] tracking-tight text-ks-ink">
              Skills
            </h1>
            <p className="font-sans text-[13px] text-ks-muted mt-1">
              {skills.length} skills &middot; Upload and manage free skill
              packages
            </p>
          </div>
          <button
            onClick={openCreate}
            className="ks-btn ks-btn-primary !py-2.5 !px-5 !text-[13px]"
          >
            + New skill
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
          </div>
        ) : skills.length === 0 ? (
          <div className="ks-card p-10 text-center">
            <div className="font-serif text-xl text-ks-muted mb-2">
              No skills yet
            </div>
            <p className="font-sans text-[13px] text-ks-muted mb-4">
              Upload your first skill package to get started.
            </p>
            <button
              onClick={openCreate}
              className="ks-btn ks-btn-accent !py-2 !px-4 !text-[13px]"
            >
              + New skill
            </button>
          </div>
        ) : (
          <div className="ks-card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-ks-paper-warm border-b border-ks-hair">
                  <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                    Name
                  </th>
                  <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                    Category
                  </th>
                  <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                    Downloads
                  </th>
                  <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                    S3
                  </th>
                  <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                    Size
                  </th>
                  <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {skills.map((skill) => (
                  <tr
                    key={skill.id}
                    className="border-b border-ks-hair/50 hover:bg-ks-paper-warm/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-sans text-[13px] font-semibold text-ks-ink">
                        {skill.name}
                      </div>
                      <div className="font-mono text-[11px] text-ks-muted">
                        {skill.slug}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="ks-chip !text-[10px]">
                        {skill.category}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-ks-ink">
                      {(skill.downloadCount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      {skill.s3Key ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-green-700">
                          <span className="text-[8px]">&#9679;</span> uploaded
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ks-muted">
                          <span className="text-[8px]">&#9675;</span> missing
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ks-muted">
                      {skill.fileSize || "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(skill)}
                          className="font-sans text-[12px] text-ks-accent hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(skill)}
                          className="font-sans text-[12px] text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Delete confirmation modal */}
        {deleteTarget && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-ks-ink/40 backdrop-blur-sm"
              onClick={() => setDeleteTarget(null)}
            />
            <div className="relative bg-ks-paper border border-ks-hair rounded-2xl shadow-xl w-full max-w-sm p-6">
              <h2 className="font-serif text-[22px] tracking-tight mb-2">
                Delete skill?
              </h2>
              <p className="font-sans text-[13px] text-ks-muted mb-5">
                This will delete{" "}
                <span className="font-semibold text-ks-ink">
                  {deleteTarget.name}
                </span>{" "}
                and its S3 package permanently.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="ks-btn flex-1 justify-center !py-2.5 !text-[13px]"
                >
                  Cancel
                </button>
                <button
                  disabled={deleting}
                  onClick={handleDelete}
                  className="flex-1 font-sans text-[13px] font-medium py-2.5 px-4 rounded-full border border-red-200 text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Create / Edit form ────────────────────────────────
  return (
    <div className="p-8 max-w-3xl">
      <button
        onClick={() => setView("list")}
        className="font-sans text-[13px] text-ks-muted hover:text-ks-ink mb-4 inline-flex items-center gap-1"
      >
        &larr; Back to skills
      </button>

      <h1 className="font-serif text-[28px] tracking-tight text-ks-ink mb-6">
        {view === "create" ? "New Skill" : `Edit: ${form.name}`}
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 font-sans text-[13px] text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Basic info */}
        <div className="ks-card p-5 flex flex-col gap-4">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider">
            BASIC INFO
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Slug" required>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => set("slug", e.target.value)}
                placeholder="e.g. client-proposal-skill"
                disabled={view === "edit"}
                className="ks-input"
                required
              />
            </Field>
            <Field label="Name" required>
              <input
                type="text"
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Client Proposal Skill"
                className="ks-input"
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Category" required>
              <select
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                className="ks-input"
                required
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Author">
              <input
                type="text"
                value={form.author}
                onChange={(e) => set("author", e.target.value)}
                className="ks-input"
              />
            </Field>
          </div>

          <Field label="Description" required>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="ks-input"
              required
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Tags (comma-separated)">
              <input
                type="text"
                value={form.tags}
                onChange={(e) => set("tags", e.target.value)}
                placeholder="freelancer, consultant, agency"
                className="ks-input"
              />
            </Field>
            <Field label="Corresponding Kit Slug">
              <input
                type="text"
                value={form.correspondingKitSlug}
                onChange={(e) => set("correspondingKitSlug", e.target.value)}
                placeholder="e.g. crm-kit"
                className="ks-input"
              />
            </Field>
          </div>

          <Field label="Upgrade Hook">
            <input
              type="text"
              value={form.upgradeHook}
              onChange={(e) => set("upgradeHook", e.target.value)}
              placeholder="Shown on skill card when a corresponding kit exists"
              className="ks-input"
            />
          </Field>
        </div>

        {/* Examples */}
        <div className="ks-card p-5 flex flex-col gap-4">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider">
            EXAMPLES
          </div>
          <Field label="Example Input">
            <textarea
              value={form.exampleInput}
              onChange={(e) => set("exampleInput", e.target.value)}
              rows={3}
              className="ks-input"
            />
          </Field>
          <Field label="Example Output">
            <textarea
              value={form.exampleOutput}
              onChange={(e) => set("exampleOutput", e.target.value)}
              rows={4}
              className="ks-input"
            />
          </Field>
        </div>

        {/* Technical */}
        <div className="ks-card p-5 flex flex-col gap-4">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider">
            TECHNICAL
          </div>
          <Field label="Compatibility (comma-separated)">
            <input
              type="text"
              value={form.compatibility}
              onChange={(e) => set("compatibility", e.target.value)}
              className="ks-input"
            />
          </Field>
          <Field label="What's Inside (JSON array)">
            <textarea
              value={form.whatsInside}
              onChange={(e) => set("whatsInside", e.target.value)}
              rows={4}
              className="ks-input font-mono text-[12px]"
              placeholder='[{"file":"SKILL.md","description":"Core instructions"}]'
            />
          </Field>
          <Field label="Composition (JSON)">
            <textarea
              value={form.composition}
              onChange={(e) => set("composition", e.target.value)}
              rows={3}
              className="ks-input font-mono text-[12px]"
            />
          </Field>
        </div>

        {/* Zip upload */}
        <div className="ks-card p-5 flex flex-col gap-4">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider">
            PACKAGE
          </div>
          <Field label={view === "edit" ? "Replace .zip (optional)" : ".zip File"}>
            <input
              type="file"
              accept=".zip"
              onChange={(e) => set("zipFile", e.target.files?.[0] || null)}
              className="font-sans text-[13px] text-ks-ink file:mr-3 file:py-2 file:px-4 file:rounded-full file:border file:border-ks-hair file:text-[12px] file:font-sans file:font-medium file:bg-white file:text-ks-ink hover:file:bg-ks-paper-warm file:cursor-pointer file:transition-colors"
            />
          </Field>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="ks-btn ks-btn-primary !py-2.5 !px-6 !text-[13px] disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : view === "create"
                ? "Create Skill"
                : "Save Changes"}
          </button>
          <button
            type="button"
            onClick={() => setView("list")}
            className="ks-btn !py-2.5 !px-5 !text-[13px]"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-sans text-[12px] font-medium text-ks-ink">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}
