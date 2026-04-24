"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface McpTool {
  name: string;
  description: string;
}

interface McpApp {
  name: string;
  description: string;
}

export interface MyKit {
  kitSlug: string;
  status: "active" | "deactivated" | "archived";
  activatedAt: string | null;
  deactivatedAt: string | null;
  kitName: string | null;
  kitCategory: string | null;
  kitDescription: string | null;
  kitReplaces: string | null;
  kitSavingsPerMonth: number | null;
  kitMcpTools: McpTool[] | null;
  kitMcpApps: McpApp[] | null;
  kitDbSchema: string | null;
}

interface MyKitsResponse {
  kits: MyKit[];
  plan: string;
  activeCount: number;
  limit: number | null;
}

export function useMyKits() {
  return useQuery<MyKitsResponse>({
    queryKey: ["myKits"],
    queryFn: async () => {
      const res = await fetch("/api/my-kits");
      if (!res.ok) throw new Error("Failed to fetch kits");
      return res.json();
    },
    staleTime: 2 * 60 * 1000,
  });
}

export function useKitStatus(kitSlug: string) {
  const { data } = useMyKits();
  const kit = data?.kits?.find((k) => k.kitSlug === kitSlug);
  return {
    status: kit?.status ?? null,
    kit,
    activeCount: data?.activeCount ?? 0,
    limit: data?.limit ?? null,
    plan: data?.plan ?? null,
  };
}

export function useActivateKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kitSlug: string) => {
      const res = await fetch("/api/activate-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitSlug }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Activation failed");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myKits"] });
    },
  });
}

export function useDeactivateKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (kitSlug: string) => {
      const res = await fetch("/api/deactivate-kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kitSlug }),
      });
      if (!res.ok) throw new Error("Deactivation failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myKits"] });
    },
  });
}
