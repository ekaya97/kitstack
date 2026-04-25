"use client";

import { useState } from "react";

export function DownloadButton({
  slug,
  className = "",
  children,
}: {
  slug: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = async () => {
    setLoading(true);

    try {
      const res = await fetch(`/api/skills/${slug}/download`);
      if (!res.ok) throw new Error("Download failed");

      const { downloadUrl } = await res.json();

      // Trigger browser download
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `${slug}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setDownloaded(true);
    } catch {
      // Silently fail — the user will notice the download didn't start
    } finally {
      setLoading(false);
    }
  };

  if (downloaded) {
    return (
      <button
        onClick={handleDownload}
        className={className.replace("ks-btn-primary", "").replace("ks-btn-accent", "") + " !border-green-600 !text-green-700"}
      >
        &#10003; Downloaded &mdash; click to re-download
      </button>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className={`${className} disabled:opacity-60`}
    >
      {loading ? "Preparing..." : children}
    </button>
  );
}
