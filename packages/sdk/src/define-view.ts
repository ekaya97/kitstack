import type { ViewDefinition, LoaderFn } from "./types";

export function defineView<TLoader extends LoaderFn>(config: {
  slug: string;
  name: string;
  description: string;
  loader: TLoader;
  component: React.ComponentType<{ data: Awaited<ReturnType<TLoader>> }>;
  height?: number;
  permissions?: {
    clipboardWrite?: boolean;
  };
}): ViewDefinition<TLoader> {
  return config;
}
