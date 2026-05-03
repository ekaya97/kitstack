import { DocsLayout } from "fumadocs-ui/layouts/docs";
import { RootProvider } from "fumadocs-ui/provider";
import type { ReactNode } from "react";
import { source } from "@/lib/source";
import { Nav } from "@/components/shared/nav";

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootProvider
      theme={{
        enabled: false,
      }}
      search={{
        enabled: false,
      }}
    >
      <Nav active="Docs" />
      <DocsLayout
        tree={source.pageTree}
        disableThemeSwitch
        nav={{
          enabled: false,
        }}
        sidebar={{
          banner: (
            <div className="font-mono text-[10px] text-ks-muted tracking-wider">
              SDK DOCUMENTATION
            </div>
          ),
        }}
      >
        {children}
      </DocsLayout>
    </RootProvider>
  );
}
