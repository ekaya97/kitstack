import Link from "next/link";
import type { BlogPost } from "@/lib/blog";
import { Avatar } from "@/components/ui/avatar";

export function PostCard({ post }: { post: BlogPost }) {
  const dateFormatted = new Date(post.date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Link
      href={`/blog/${post.slug}`}
      className="ks-card p-5 flex flex-col group hover:border-ks-accent transition-colors"
    >
      {/* Date + tags */}
      <div className="font-mono text-[10px] sm:text-[11px] text-ks-muted tracking-[1px] mb-2">
        {dateFormatted.toUpperCase()}
        {post.tags.length > 0 && (
          <span>
            {" "}&middot;{" "}
            {post.tags.map((t) => t.toUpperCase()).join(" \u00b7 ")}
          </span>
        )}
      </div>

      {/* Title */}
      <h2 className="font-serif text-[20px] sm:text-[22px] tracking-tight leading-tight mb-2 group-hover:text-ks-accent transition-colors">
        {post.title}
      </h2>

      {/* Excerpt */}
      <p className="font-sans text-[13px] text-ks-muted leading-relaxed mb-4 flex-1">
        {post.excerpt}
      </p>

      {/* Author + read more */}
      <div className="flex items-center justify-between mt-auto pt-3 border-t border-ks-hair">
        <div className="flex items-center gap-2">
          <Avatar name={post.author} size={20} tone="#3b7a3b" />
          <span className="font-sans text-[12px] text-ks-muted">
            {post.author}
          </span>
        </div>
        <span className="font-mono text-[11px] text-ks-accent tracking-wide">
          READ &rarr;
        </span>
      </div>
    </Link>
  );
}
