import { Nav } from "@/components/shared/nav";
import { Footer } from "@/components/shared/footer";

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="bg-ks-paper min-h-screen">
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-16">
        <div className="prose prose-sm max-w-none prose-headings:font-serif prose-headings:text-ks-ink prose-p:text-ks-ink2 prose-p:leading-relaxed prose-li:text-ks-ink2 prose-a:text-ks-accent prose-a:no-underline hover:prose-a:underline prose-strong:text-ks-ink">
          {children}
        </div>
      </main>
      <Footer />
    </div>
  );
}
