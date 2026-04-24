import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MDXRemote } from "next-mdx-remote/rsc";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { Avatar } from "@/components/ui/avatar";
import { mdxComponents } from "@/components/blog/mdx-components";
import { getAllSlugs, getPostBySlug } from "@/lib/blog";

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return { title: "Post not found" };

  return {
    title: post.title,
    description: post.excerpt,
    openGraph: {
      title: post.title,
      description: post.excerpt,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      ...(post.coverImage && { images: [{ url: post.coverImage }] }),
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const dateFormatted = new Date(post.date).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="bg-ks-paper min-h-screen flex flex-col">
      <Nav active="Blog" />

      <article className="max-w-2xl mx-auto w-full px-4 sm:px-6 pt-8 sm:pt-16 pb-16 sm:pb-24">
        {/* Breadcrumb */}
        <div className="font-mono text-[11px] text-ks-muted mb-6 flex items-center gap-1.5">
          <Link href="/" className="hover:text-ks-ink">Home</Link>
          <span>/</span>
          <Link href="/blog" className="hover:text-ks-ink">Blog</Link>
          <span>/</span>
          <span className="text-ks-ink font-medium truncate">{post.title}</span>
        </div>

        {/* Date + tags */}
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-3">
          {dateFormatted.toUpperCase()}
          {post.tags.length > 0 && (
            <span>
              {" "}&middot;{" "}
              {post.tags.map((t) => t.toUpperCase()).join(" \u00b7 ")}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="font-serif text-[28px] sm:text-[36px] lg:text-[44px] leading-[1.08] tracking-tight text-ks-ink mb-4">
          {post.title}
        </h1>

        {/* Excerpt */}
        <p className="font-sans text-[16px] sm:text-[18px] text-ks-muted leading-relaxed mb-6">
          {post.excerpt}
        </p>

        {/* Author row */}
        <div className="flex items-center gap-3 mb-8">
          <Avatar name={post.author} size={32} tone="#3b7a3b" />
          <div>
            <Link
              href={`/authors/${post.authorHandle}`}
              className="font-sans text-[13px] font-semibold text-ks-ink hover:text-ks-accent"
            >
              {post.author}
            </Link>
            <div className="font-sans text-[12px] text-ks-muted">
              {dateFormatted}
            </div>
          </div>
        </div>

        <div className="border-t border-ks-hair" />

        {/* MDX content */}
        <div className="prose-ks mt-10">
          <MDXRemote source={post.content} components={mdxComponents} />
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 pt-8 border-t border-ks-hair flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="font-serif text-[20px] text-ks-ink mb-1">
              Enjoyed this?
            </div>
            <div className="font-sans text-[13px] text-ks-muted">
              Browse our skills and kits to see these ideas in action.
            </div>
          </div>
          <div className="flex gap-2.5">
            <Link href="/skills" className="ks-btn !py-2 !px-4 !text-[13px]">
              Free skills
            </Link>
            <Link href="/kits" className="ks-btn ks-btn-accent !py-2 !px-4 !text-[13px]">
              See kits &rarr;
            </Link>
          </div>
        </div>
      </article>

      <Footer />
    </div>
  );
}
