import Link from "next/link";
import { Logo } from "@/components/ui/logo";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-ks-paper flex flex-col">
      {/* Minimal nav — just logo */}
      <div className="px-12 py-5 border-b border-ks-hair">
        <Link href="/" className="inline-flex items-center gap-3">
          <Logo />
          <span className="font-serif text-[22px] tracking-tight">
            kitstack<span className="text-ks-accent">.co</span>
          </span>
        </Link>
      </div>

      {/* Centered form area */}
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>

      {/* Minimal footer */}
      <div className="px-12 py-4 border-t border-ks-hair text-center font-mono text-[11px] text-ks-muted">
        &copy; 2026 kitstack &mdash; shipped from Berlin
      </div>
    </div>
  );
}
