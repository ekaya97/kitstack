import type { MDXComponents } from "mdx/types";

function Callout({
  type = "info",
  children,
}: {
  type?: "info" | "warning" | "tip";
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-ks-accent bg-ks-accent-soft/30",
    warning: "border-red-400 bg-red-50",
    tip: "border-green-600 bg-green-50",
  };
  const labels = { info: "NOTE", warning: "WARNING", tip: "TIP" };

  return (
    <div className={`border-l-[3px] ${styles[type]} rounded-r-lg px-5 py-4 my-6`}>
      <div className="font-mono text-[10px] tracking-wider text-ks-muted mb-1.5">
        {labels[type]}
      </div>
      <div className="font-sans text-[14px] text-ks-ink2 leading-relaxed [&>p]:mb-0">
        {children}
      </div>
    </div>
  );
}

function CodeBlock({
  filename,
  children,
}: {
  filename?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="my-6 rounded-xl overflow-hidden border border-ks-ink/10">
      {filename && (
        <div className="bg-ks-ink px-4 py-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#e06b4a]" />
          <span className="w-2 h-2 rounded-full bg-[#f4c95f]" />
          <span className="w-2 h-2 rounded-full bg-[#6bb56b]" />
          <span className="ml-2 font-mono text-[11px] text-ks-faint">
            {filename}
          </span>
        </div>
      )}
      <div className="[&>pre]:!mt-0 [&>pre]:!rounded-none [&>pre]:!border-0">
        {children}
      </div>
    </div>
  );
}

function Figure({
  src,
  alt,
  caption,
}: {
  src: string;
  alt?: string;
  caption?: string;
}) {
  return (
    <figure className="my-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt || caption || ""}
        className="w-full rounded-xl border border-ks-hair"
      />
      {caption && (
        <figcaption className="font-sans text-[12px] text-ks-muted text-center mt-2">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

export const mdxComponents: MDXComponents = {
  Callout,
  CodeBlock,
  Figure,
};
