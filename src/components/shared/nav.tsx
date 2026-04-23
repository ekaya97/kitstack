import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { NavAuth } from "./nav-auth";

const items = [
  { label: "Skills", href: "/skills" },
  { label: "Kits", href: "/kits" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
];

export function Nav({ active }: { active?: string }) {
  return (
    <nav className="flex items-center justify-between px-12 py-3 border-b border-ks-hair bg-ks-paper relative z-10">
      <Link href="/" className="flex items-center gap-2.5">
        <Logo size={24} />
        <span className="font-serif text-lg tracking-tight">
          kitstack<span className="text-ks-accent">.co</span>
        </span>
      </Link>

      <div className="flex gap-6">
        {items.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            className={`font-sans text-[13px] pb-px border-b-[1.5px] ${
              active === it.label
                ? "font-semibold text-ks-ink border-ks-accent"
                : "font-medium text-ks-muted border-transparent hover:text-ks-ink"
            }`}
          >
            {it.label}
          </Link>
        ))}
      </div>

      <NavAuth />
    </nav>
  );
}
