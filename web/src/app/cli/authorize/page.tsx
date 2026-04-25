"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export default function CliAuthorizePage() {
  const searchParams = useSearchParams();
  const callback = searchParams.get("callback");
  const [status, setStatus] = useState<"loading" | "confirm" | "error">("loading");
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    authClient.getSession().then((s) => {
      if (s?.data?.user) {
        setSession(s.data);
        setStatus("confirm");
      } else {
        // Not logged in — redirect to login, then back here
        const returnUrl = `/cli/authorize?callback=${encodeURIComponent(callback || "")}`;
        window.location.href = `/login?redirect=${encodeURIComponent(returnUrl)}`;
      }
    });
  }, [callback]);

  async function handleAuthorize() {
    if (!callback || !session?.user) return;

    setStatus("loading");

    try {
      const res = await fetch("/api/cli/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callback }),
      });

      if (!res.ok) {
        setStatus("error");
        return;
      }

      const { token } = await res.json();
      const redirectUrl = `${callback}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(session.user.email)}`;
      window.location.href = redirectUrl;
    } catch {
      setStatus("error");
    }
  }

  if (!callback) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Missing callback URL</h1>
          <p style={styles.text}>This page should be opened by <code>kitstack login</code>.</p>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <p style={styles.text}>Loading...</p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <h1 style={styles.title}>Authorization Failed</h1>
          <p style={styles.text}>Something went wrong. Please try <code>kitstack login</code> again.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Authorize KitStack CLI</h1>
        <p style={styles.text}>
          Signed in as <strong>{session.user.email}</strong>
        </p>
        <p style={styles.text}>
          Grant the CLI access to deploy kits and connect to the relay?
        </p>
        <button onClick={handleAuthorize} style={styles.button}>
          Authorize
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: { fontFamily: "system-ui, sans-serif", display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh", margin: 0, background: "#faf7f1", color: "#171512" },
  card: { textAlign: "center", padding: "2rem", maxWidth: "400px" },
  title: { fontSize: "1.5rem", marginBottom: "1rem" },
  text: { color: "#6b6357", lineHeight: 1.6, margin: "0.5rem 0" },
  button: { marginTop: "1.5rem", padding: "0.75rem 2rem", fontSize: "1rem", fontWeight: 600, color: "#fff", background: "#171512", border: "none", borderRadius: "8px", cursor: "pointer" },
};
