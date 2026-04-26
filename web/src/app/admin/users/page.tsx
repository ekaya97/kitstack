"use client";

import { useState, useEffect, useCallback } from "react";

interface UserRow {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  image: string | null;
  role: "admin" | "user";
  createdAt: string;
  updatedAt: string;
  activeKits: number;
  totalDownloads: number;
}

interface UserDetail {
  user: {
    id: string;
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    role: "admin" | "user";
    createdAt: string;
    updatedAt: string;
  };
  activations: {
    id: string;
    userId: string;
    kitSlug: string;
    status: string;
    createdAt: string;
  }[];
  downloads: {
    id: string;
    userId: string | null;
    skillSlug: string;
    createdAt: string;
  }[];
  subscription: {
    id: string;
    userId: string;
    plan: string;
    status: string;
    createdAt: string;
  } | null;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "--";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "--";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "detail">("list");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roleUpdating, setRoleUpdating] = useState(false);
  const [confirmRole, setConfirmRole] = useState<"admin" | "user" | null>(null);

  const fetchUsers = useCallback(async () => {
    const res = await fetch("/api/admin/users");
    const data = await res.json();
    setUsers(data.users || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function openDetail(userId: string) {
    setDetailLoading(true);
    setError(null);
    setView("detail");

    const res = await fetch(`/api/admin/users/${userId}`);
    if (!res.ok) {
      setError("Failed to load user details");
      setDetailLoading(false);
      return;
    }

    const data = await res.json();
    setDetail(data);
    setDetailLoading(false);
  }

  async function handleRoleChange(newRole: "admin" | "user") {
    if (!detail) return;
    setRoleUpdating(true);
    setError(null);

    const res = await fetch(`/api/admin/users/${detail.user.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Failed to update role");
      setRoleUpdating(false);
      setConfirmRole(null);
      return;
    }

    // Update local state
    setDetail((prev) =>
      prev ? { ...prev, user: { ...prev.user, role: newRole } } : prev,
    );
    setUsers((prev) =>
      prev.map((u) => (u.id === detail.user.id ? { ...u, role: newRole } : u)),
    );
    setRoleUpdating(false);
    setConfirmRole(null);
  }

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  });

  // ── Detail view ───────────────────────────────────────
  if (view === "detail") {
    if (detailLoading) {
      return (
        <div className="p-8">
          <div className="flex items-center justify-center py-20">
            <div className="w-5 h-5 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
          </div>
        </div>
      );
    }

    if (!detail) {
      return (
        <div className="p-8">
          <button
            onClick={() => setView("list")}
            className="font-sans text-[13px] text-ks-muted hover:text-ks-ink mb-4 inline-flex items-center gap-1"
          >
            &larr; Back to users
          </button>
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 font-sans text-[13px] text-red-700">
              {error}
            </div>
          )}
        </div>
      );
    }

    const { user: u, activations, downloads, subscription } = detail;

    return (
      <div className="p-8 max-w-3xl">
        <button
          onClick={() => setView("list")}
          className="font-sans text-[13px] text-ks-muted hover:text-ks-ink mb-4 inline-flex items-center gap-1"
        >
          &larr; Back to users
        </button>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 mb-4 font-sans text-[13px] text-red-700">
            {error}
          </div>
        )}

        {/* User header */}
        <div className="ks-card p-5 mb-5">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="font-serif text-[28px] tracking-tight text-ks-ink">
                {u.name}
              </h1>
              <p className="font-sans text-[13px] text-ks-muted mt-0.5">
                {u.email}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <span
                  className={`ks-chip !text-[10px] ${
                    u.role === "admin"
                      ? "!bg-ks-accent/10 !text-ks-accent !border-ks-accent/30"
                      : ""
                  }`}
                >
                  {u.role}
                </span>
                <span className="font-sans text-[12px] text-ks-muted">
                  Joined {formatDate(u.createdAt)}
                </span>
              </div>
            </div>
            <div>
              {u.role === "user" ? (
                <button
                  onClick={() => setConfirmRole("admin")}
                  disabled={roleUpdating}
                  className="ks-btn !py-2 !px-4 !text-[12px] disabled:opacity-50"
                >
                  Promote to Admin
                </button>
              ) : (
                <button
                  onClick={() => setConfirmRole("user")}
                  disabled={roleUpdating}
                  className="ks-btn !py-2 !px-4 !text-[12px] disabled:opacity-50"
                >
                  Demote to User
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Subscription */}
        <div className="ks-card p-5 mb-5">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-3">
            SUBSCRIPTION
          </div>
          {subscription ? (
            <div className="flex items-center gap-4">
              <div>
                <span className="font-sans text-[13px] font-semibold text-ks-ink capitalize">
                  {subscription.plan}
                </span>
                <span className="mx-2 text-ks-muted">&middot;</span>
                <span
                  className={`ks-chip !text-[10px] ${
                    subscription.status === "active"
                      ? "!bg-green-50 !text-green-700 !border-green-200"
                      : subscription.status === "cancelled"
                        ? "!bg-red-50 !text-red-600 !border-red-200"
                        : ""
                  }`}
                >
                  {subscription.status}
                </span>
              </div>
              <span className="font-sans text-[12px] text-ks-muted">
                Since {formatDate(subscription.createdAt)}
              </span>
            </div>
          ) : (
            <p className="font-sans text-[13px] text-ks-muted">
              No subscription
            </p>
          )}
        </div>

        {/* Kit Activations */}
        <div className="ks-card p-5 mb-5">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-3">
            KIT ACTIVATIONS
          </div>
          {activations.length === 0 ? (
            <p className="font-sans text-[13px] text-ks-muted">
              No kit activations
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-ks-hair">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-ks-paper-warm border-b border-ks-hair">
                    <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2">
                      Kit Slug
                    </th>
                    <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2">
                      Status
                    </th>
                    <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2">
                      Activated
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {activations.map((a) => (
                    <tr
                      key={a.id}
                      className="border-b border-ks-hair/50 last:border-b-0"
                    >
                      <td className="px-4 py-2.5 font-mono text-[12px] text-ks-ink">
                        {a.kitSlug}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`ks-chip !text-[10px] ${
                            a.status === "active"
                              ? "!bg-green-50 !text-green-700 !border-green-200"
                              : ""
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-sans text-[12px] text-ks-muted">
                        {formatDate(a.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Skill Downloads */}
        <div className="ks-card p-5 mb-5">
          <div className="font-mono text-[10px] text-ks-muted tracking-wider mb-3">
            SKILL DOWNLOADS
          </div>
          {downloads.length === 0 ? (
            <p className="font-sans text-[13px] text-ks-muted">
              No skill downloads
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-ks-hair">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-ks-paper-warm border-b border-ks-hair">
                    <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2">
                      Skill Slug
                    </th>
                    <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2">
                      Downloaded
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {downloads.map((d) => (
                    <tr
                      key={d.id}
                      className="border-b border-ks-hair/50 last:border-b-0"
                    >
                      <td className="px-4 py-2.5 font-mono text-[12px] text-ks-ink">
                        {d.skillSlug}
                      </td>
                      <td className="px-4 py-2.5 font-sans text-[12px] text-ks-muted">
                        {formatDate(d.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Role confirmation modal */}
        {confirmRole && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div
              className="absolute inset-0 bg-ks-ink/40 backdrop-blur-sm"
              onClick={() => setConfirmRole(null)}
            />
            <div className="relative bg-ks-paper border border-ks-hair rounded-2xl shadow-xl w-full max-w-sm p-6">
              <h2 className="font-serif text-[22px] tracking-tight mb-2">
                Change role?
              </h2>
              <p className="font-sans text-[13px] text-ks-muted mb-5">
                This will change{" "}
                <span className="font-semibold text-ks-ink">{u.name}</span>
                {" "}from{" "}
                <span className="font-semibold text-ks-ink">{u.role}</span>
                {" "}to{" "}
                <span className="font-semibold text-ks-ink">{confirmRole}</span>.
              </p>
              <div className="flex gap-2.5">
                <button
                  onClick={() => setConfirmRole(null)}
                  className="ks-btn flex-1 justify-center !py-2.5 !text-[13px]"
                >
                  Cancel
                </button>
                <button
                  disabled={roleUpdating}
                  onClick={() => handleRoleChange(confirmRole)}
                  className="ks-btn ks-btn-primary flex-1 justify-center !py-2.5 !text-[13px] disabled:opacity-50"
                >
                  {roleUpdating ? "Updating..." : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── List view ─────────────────────────────────────────
  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-[28px] tracking-tight text-ks-ink">
            Users
          </h1>
          <p className="font-sans text-[13px] text-ks-muted mt-1">
            {users.length} users &middot; Manage accounts and roles
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="ks-input !w-72"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-5 h-5 border-2 border-ks-hair border-t-ks-accent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="ks-card p-10 text-center">
          <div className="font-serif text-xl text-ks-muted mb-2">
            {search ? "No matching users" : "No users yet"}
          </div>
          <p className="font-sans text-[13px] text-ks-muted">
            {search
              ? "Try a different search term."
              : "Users will appear here once they sign up."}
          </p>
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
                  Email
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  Role
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  Active Kits
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  Downloads
                </th>
                <th className="font-mono text-[10px] uppercase tracking-wider text-ks-muted px-4 py-2.5">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr
                  key={u.id}
                  onClick={() => openDetail(u.id)}
                  className="border-b border-ks-hair/50 hover:bg-ks-paper-warm/50 transition-colors cursor-pointer"
                >
                  <td className="px-4 py-3">
                    <div className="font-sans text-[13px] font-semibold text-ks-ink">
                      {u.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-sans text-[13px] text-ks-ink">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`ks-chip !text-[10px] ${
                        u.role === "admin"
                          ? "!bg-ks-accent/10 !text-ks-accent !border-ks-accent/30"
                          : ""
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-ks-ink">
                    {u.activeKits}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-ks-ink">
                    {u.totalDownloads}
                  </td>
                  <td className="px-4 py-3 font-sans text-[12px] text-ks-muted">
                    {formatDate(u.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
