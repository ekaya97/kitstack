import type { Metadata } from "next";
import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";
import { PostCard } from "@/components/blog/post-card";
import { getAllPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Technical deep dives on AI skills, kits, and building tools that work inside your chat.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="bg-ks-paper min-h-screen flex flex-col">
      <Nav active="Blog" />

      <section className="px-4 sm:px-8 lg:px-16 pt-10 sm:pt-12 lg:pt-[72px] pb-12">
        <div className="font-mono text-[11px] text-ks-muted tracking-[1px] mb-2">
          BLOG
        </div>
        <h1 className="font-serif text-[32px] sm:text-[52px] lg:text-[72px] leading-[0.98] tracking-[-2px] text-ks-ink">
          From the{" "}
          <span className="italic text-ks-accent">workshop.</span>
        </h1>
        <p className="font-sans text-[15px] sm:text-[17px] text-ks-muted mt-4 max-w-xl leading-relaxed">
          Technical deep dives, architecture decisions, and lessons from
          building AI tools that actually stick.
        </p>
      </section>

      <section className="px-4 sm:px-8 lg:px-16 pb-10 sm:pb-16 lg:pb-[72px]">
        {posts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[18px]">
            {posts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="font-serif text-3xl text-ks-muted mb-2">
              No posts yet
            </div>
            <div className="font-sans text-sm text-ks-muted">
              We&apos;re writing. Check back soon.
            </div>
          </div>
        )}
      </section>

      <Footer />
    </div>
  );
}
