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
      <main className="max-w-2xl mx-auto px-6 pt-20 pb-24">
        <div className="legal-content">{children}</div>
      </main>
      <Footer />
    </div>
  );
}
