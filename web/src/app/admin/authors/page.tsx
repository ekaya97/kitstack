"use client";

import { useState, useEffect, useCallback } from "react";
import type { Author } from "@/db/schema";

interface AuthorFormData {
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  website: string;
  location: string;
  userId: string;
  verified: boolean;
}

const emptyForm: AuthorFormData = {
  handle: "",
  displayName: "",
  bio: "",
  avatarUrl: "",
  website: "",
  location: "",
  userId: "",
  verified: false,
};

export default function AdminAuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create" | "edit">("list");
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<AuthorFormData>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Author | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAuthors = useCallback(async () => {
    const res = await fetch("/api/admin/authors");
    const data = await res.json();
    setAuthors(data.authors || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAuthors();
  }, [fetchAuthors]);

  function openCreate() {
    setForm(emptyForm);
    setEditId(null);
    setError(null);
    setView("create");
  }

  function openEdit(author: Author) {
    setForm({
      handle: author.handle,
      displayName: author.displayName,
      bio: author.bio || "",
      avatarUrl: author.avatarUrl || "",
      website: author.website || "",
      location: author.location || "",
      userId: author.userId || "",
      verified: author.verified ?? false,
    });
    setEditId(author.id);
    setError(null);
    setView("edit");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload = {
      handle: form.handle,
      displayName: form.displayName,
      bio: form.bio,
      avatarUrl: form.avatarUrl,
      website: form.website,
      location: form.location,
      userId: form.userId,
      verified: form.verified,
    };

    const url =
      view === "edit" ? `/api/admin/authors/${editId}` : "/api/admin/authors";
    const method = view === "edit" ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to save");
      setSaving(false);
      return;
    }

    setSaving(false);
    setView("list");
    fetchAuthors();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/admin/authors/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTarget(null);
    fetchAuthors();
  }

  function set(field: keyof AuthorFormData, value: any) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  // ── List view ─────────────────────────────────────────
  if (view === "list") {
    return (
      <div className="p-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-serif text-[28px] tracking-tight text-ks-ink">
              Authors
            </h1>
            <p className="font-sans text-[13px] text-ks-muted mt-1">
              {authors.length} authors &middot; Manage skill and kit creators
            </p>
          </div>
          <button
            onClick={openCreate}
            className="ks-btn ks-btn-primary !py-2.5 !px-5 !text-[13px]"
          >
            + New author
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
          </div>
        ) : authors.length === 0 ? (
          <div className="ks-card p-10 text-center">
            <div className="font-serif text-xl text-ks-muted mb-2">
              No authors yet
            </div>
            <p className="font-sans text-[13px] text-ks-muted mb-4">
              Create your first author profile to get started.
            </p>
            <button
              onClick={openCreate}
              className="ks-btn ks-btn-accent !py-2 !px-4 !text-[13px]"
            >
              + New author
            </button>
          </div>
        ) : (
          <div className="ks-card overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-ks-paper-warm border-b border-ks-hair">
                  <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                    Display Name
                  </th>
                  <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                    Verified
                  </th>
                  <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                    User ID
                  </th>
                  <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                    Created
                  </th>
                  <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {authors.map((author) => (
                  <tr
                    key={author.id}
                    className="border-b border-ks-hair/50 hover:bg-ks-paper-warm/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-sans text-[13px] font-semibold text-ks-ink">
                        {author.displayName}
                      </div>
                      <div className="font-mono text-[11px] text-ks-muted">
                        @{author.handle}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {author.verified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-green-700">
                          <span className="text-[8px]">&#9679;</span> verified
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ks-muted">
                          <span className="text-[8px]">&#9675;</span> unverified
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ks-muted">
                      {author.userId
                        ? author.userId.length > 12
                          ? author.userId.slice(0, 12) + "..."
                          : author.userId
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-ks-muted">
                      {author.createdAt
                        ? new Date(author.createdAt).toLocaleDateString()
                        : "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(author)}
                          className="font-sans text-[12px] text-ks-accent hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(author)}
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
                Delete author?
              </h2>
              <p className="font-sans text-[13px] text-ks-muted mb-5">
                This will delete{" "}
                <span className="font-semibold text-ks-ink">
                  {deleteTarget.displayName}
                </span>{" "}
                (@{deleteTarget.handle}) permanently.
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
        &larr; Back to authors
      </button>

      <h1 className="font-serif text-[28px] tracking-tight text-ks-ink mb-6">
        {view === "create" ? "New Author" : `Edit: ${form.displayName}`}
      </h1>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 font-sans text-[13px] text-red-700">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Profile */}
        <div className="ks-card p-5 flex flex-col gap-4">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider">
            PROFILE
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Handle" required>
              <input
                type="text"
                value={form.handle}
                onChange={(e) => set("handle", e.target.value)}
                placeholder="e.g. kitstack"
                disabled={view === "edit"}
                className="ks-input"
                required
              />
            </Field>
            <Field label="Display Name" required>
              <input
                type="text"
                value={form.displayName}
                onChange={(e) => set("displayName", e.target.value)}
                placeholder="e.g. KitStack Team"
                className="ks-input"
                required
              />
            </Field>
          </div>

          <Field label="Bio">
            <textarea
              value={form.bio}
              onChange={(e) => set("bio", e.target.value)}
              rows={3}
              placeholder="Short author biography"
              className="ks-input"
            />
          </Field>

          <Field label="Avatar URL">
            <input
              type="text"
              value={form.avatarUrl}
              onChange={(e) => set("avatarUrl", e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="ks-input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Website">
              <input
                type="text"
                value={form.website}
                onChange={(e) => set("website", e.target.value)}
                placeholder="https://example.com"
                className="ks-input"
              />
            </Field>
            <Field label="Location">
              <input
                type="text"
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="e.g. Berlin, Germany"
                className="ks-input"
              />
            </Field>
          </div>
        </div>

        {/* Linking */}
        <div className="ks-card p-5 flex flex-col gap-4">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider">
            LINKING
          </div>

          <Field label="User ID">
            <input
              type="text"
              value={form.userId}
              onChange={(e) => set("userId", e.target.value)}
              placeholder="Optional - associate with a user account"
              className="ks-input"
            />
          </Field>
        </div>

        {/* Verification */}
        <div className="ks-card p-5 flex flex-col gap-4">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider">
            VERIFICATION
          </div>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={form.verified}
              onChange={(e) => set("verified", e.target.checked)}
              className="w-4 h-4 rounded border-ks-hair text-ks-accent focus:ring-ks-accent"
            />
            <span className="font-sans text-[13px] text-ks-ink">
              Verified author
            </span>
          </label>
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
                ? "Create Author"
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
