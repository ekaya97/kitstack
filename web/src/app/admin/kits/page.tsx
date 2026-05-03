export const dynamic = "force-dynamic";
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Kit } from "@/db/schema";

const CATEGORIES = ["Revenue", "Legal", "Finance", "Sales", "Marketing", "Operations"];
const STATUSES = ["live", "coming_soon", "beta"];

interface KitFormData {
  slug: string;
  name: string;
  category: string;
  status: string;
  tagline: string;
  description: string;
  author: string;
  replaces: string;
  savingsPerMonth: string;
  correspondingSkillSlug: string;
  mcpTools: string;
  mcpApps: string;
  dbSchema: string;
}

const emptyForm: KitFormData = {
  slug: "",
  name: "",
  category: "Revenue",
  status: "live",
  tagline: "",
  description: "",
  author: "kitstack",
  replaces: "",
  savingsPerMonth: "0",
  correspondingSkillSlug: "",
  mcpTools: "[]",
  mcpApps: "[]",
  dbSchema: "",
};

export default function AdminKitsPage() {
  const [kits, setKits] = useState<Kit[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<KitFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Kit | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchKits = useCallback(async () => {
    const res = await fetch("/api/admin/kits");
    const data = await res.json();
    setKits(data.kits || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchKits();
  }, [fetchKits]);

  function openCreate() {
    setForm(emptyForm);
    setEditId(null);
    setError(null);
    setView("create");
  }

  function openEdit(kit: Kit) {
    setForm({
      slug: kit.slug,
      name: kit.name,
      category: kit.category,
      status: kit.status || "live",
      tagline: kit.tagline || "",
      description: kit.description,
      author: kit.author || "kitstack",
      replaces: kit.replaces,
      savingsPerMonth: String(kit.savingsPerMonth),
      correspondingSkillSlug: kit.correspondingSkillSlug || "",
      mcpTools: JSON.stringify(kit.mcpTools || [], null, 2),
      mcpApps: JSON.stringify(kit.mcpApps || [], null, 2),
      dbSchema: kit.dbSchema || "",
    });
    setEditId(kit.id);
    setError(null);
    setView("edit");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const body = {
      slug: form.slug,
      name: form.name,
      category: form.category,
      status: form.status,
      tagline: form.tagline,
      description: form.description,
      author: form.author,
      replaces: form.replaces,
      savingsPerMonth: Number(form.savingsPerMonth),
      correspondingSkillSlug: form.correspondingSkillSlug,
      mcpTools: form.mcpTools,
      mcpApps: form.mcpApps,
      dbSchema: form.dbSchema,
    };

    const url =
      view === "edit" ? `/api/admin/kits/${editId}` : "/api/admin/kits";
    const method = view === "edit" ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
      setSaving(false);
      return;
    }

    setSaving(false);
    setView("list");
    fetchKits();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/admin/kits/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTarget(null);
    fetchKits();
  }

  function set(field: keyof KitFormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  const statusLabel = (s: string) => {
    if (s === "coming_soon") return "Coming Soon";
    if (s === "beta") return "Beta";
    return "Live";
  };

  const statusColor = (s: string) => {
    if (s === "coming_soon") return "text-amber-700 bg-amber-50 border-amber-200";
    if (s === "beta") return "text-blue-700 bg-blue-50 border-blue-200";
    return "text-green-700 bg-green-50 border-green-200";
  };

  // ── List view ─────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-[28px] tracking-tight text-ks-ink">
              Kits
            </h1>
            <p className="font-sans text-[13px] text-ks-muted mt-1">
              {kits.length} kits &middot; Manage subscription kit packages
            </p>
          </div>
          <button
            onClick={openCreate}
            className="ks-btn ks-btn-primary !py-2.5 !px-5 !text-[13px]"
          >
            + New kit
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
          </div>
        ) : kits.length === 0 ? (
          <div className="ks-card p-10 text-center">
            <div className="font-serif text-xl text-ks-muted mb-2">
              No kits yet
            </div>
            <p className="font-sans text-[13px] text-ks-muted mb-4">
              Create your first subscription kit to get started.
            </p>
            <button
              onClick={openCreate}
              className="ks-btn ks-btn-accent !py-2 !px-4 !text-[13px]"
            >
              + New kit
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
                    Status
                  </th>
                  <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                    Subscribers
                  </th>
                  <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {kits.map((kit) => (
                  <tr
                    key={kit.id}
                    className="border-b border-ks-hair/50 hover:bg-ks-paper-warm/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-sans text-[13px] font-semibold text-ks-ink">
                        {kit.name}
                      </div>
                      <div className="font-mono text-[11px] text-ks-muted">
                        {kit.slug}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="ks-chip !text-[10px]">
                        {kit.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor(kit.status || "live")}`}
                      >
                        {statusLabel(kit.status || "live")}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-[12px] text-ks-ink">
                      {(kit.subscriberCount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(kit)}
                          className="font-sans text-[12px] text-ks-accent hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(kit)}
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
                Delete kit?
              </h2>
              <p className="font-sans text-[13px] text-ks-muted mb-5">
                This will delete{" "}
                <span className="font-semibold text-ks-ink">
                  {deleteTarget.name}
                </span>{" "}
                and all its data permanently.
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
        &larr; Back to kits
      </button>

      <h1 className="font-serif text-[28px] tracking-tight text-ks-ink mb-6">
        {view === "create" ? "New Kit" : `Edit: ${form.name}`}
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
                placeholder="e.g. crm-kit"
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
                placeholder="e.g. CRM Kit"
                className="ks-input"
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-3 gap-4">
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
            <Field label="Status" required>
              <select
                value={form.status}
                onChange={(e) => set("status", e.target.value)}
                className="ks-input"
                required
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "coming_soon" ? "Coming Soon" : s === "beta" ? "Beta" : "Live"}
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

          <Field label="Tagline">
            <input
              type="text"
              value={form.tagline}
              onChange={(e) => set("tagline", e.target.value)}
              placeholder="A real CRM that lives inside your Claude chat."
              className="ks-input"
            />
          </Field>

          <Field label="Description" required>
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              className="ks-input"
              required
            />
          </Field>
        </div>

        {/* Pricing */}
        <div className="ks-card p-5 flex flex-col gap-4">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider">
            PRICING
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Replaces" required>
              <input
                type="text"
                value={form.replaces}
                onChange={(e) => set("replaces", e.target.value)}
                placeholder="e.g. Pipedrive €24, HubSpot Starter €20"
                className="ks-input"
                required
              />
            </Field>
            <Field label="Savings per Month (€)" required>
              <input
                type="number"
                value={form.savingsPerMonth}
                onChange={(e) => set("savingsPerMonth", e.target.value)}
                min="0"
                className="ks-input"
                required
              />
            </Field>
          </div>
        </div>

        {/* Corresponding Skill */}
        <div className="ks-card p-5 flex flex-col gap-4">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider">
            CORRESPONDING SKILL
          </div>
          <Field label="Corresponding Skill Slug">
            <input
              type="text"
              value={form.correspondingSkillSlug}
              onChange={(e) => set("correspondingSkillSlug", e.target.value)}
              placeholder="e.g. client-proposal-skill"
              className="ks-input"
            />
          </Field>
        </div>

        {/* MCP Tools */}
        <div className="ks-card p-5 flex flex-col gap-4">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider">
            MCP TOOLS
          </div>
          <Field label="MCP Tools (JSON array)">
            <textarea
              value={form.mcpTools}
              onChange={(e) => set("mcpTools", e.target.value)}
              rows={6}
              className="ks-input font-mono text-[12px]"
              placeholder='[{"name":"add_contact","description":"Add a new contact"}]'
            />
          </Field>
        </div>

        {/* MCP Apps */}
        <div className="ks-card p-5 flex flex-col gap-4">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider">
            MCP APPS
          </div>
          <Field label="MCP Apps (JSON array)">
            <textarea
              value={form.mcpApps}
              onChange={(e) => set("mcpApps", e.target.value)}
              rows={6}
              className="ks-input font-mono text-[12px]"
              placeholder='[{"name":"Pipeline Kanban","description":"Visual pipeline board"}]'
            />
          </Field>
        </div>

        {/* Database */}
        <div className="ks-card p-5 flex flex-col gap-4">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider">
            DATABASE
          </div>
          <Field label="DB Schema">
            <textarea
              value={form.dbSchema}
              onChange={(e) => set("dbSchema", e.target.value)}
              rows={5}
              className="ks-input font-mono text-[12px]"
              placeholder="contacts (id, name, company, email, phone, ...)"
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
                ? "Create Kit"
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
