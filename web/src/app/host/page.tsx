"use client";

import { useSearchParams } from "next/navigation";
import { ShellHost } from "./shell-host";

export default function HostPage() {
  const params = useSearchParams();
  return <ShellHost initialView={params.get("view") ?? "graph"} />;
}
