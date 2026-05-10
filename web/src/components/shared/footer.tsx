import Link from "next/link";
import { Logo } from "@/components/ui/logo";

interface FooterLink {
  label: string;
  href: string;
  external?: boolean;
}

const columns: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Catalogue",
    links: [
      { label: "Free skills", href: "/skills" },
      { label: "Kits", href: "/kits" },
      { label: "Pricing", href: "/pricing" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    heading: "Authors",
    links: [
      { label: "Browse authors", href: "/authors/kitstack" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Privacy", href: "/legal/privacy" },
      { label: "Terms", href: "/legal/terms" },
      { label: "Impressum", href: "/legal/imprint" },
      {
        label: "hello@kitstack.co",
        href: "mailto:hello@kitstack.co",
        external: true,
      },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto px-4 sm:px-8 md:px-12 pt-12 pb-8 border-t border-ks-hair bg-ks-paper-warm">
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-[1.5fr_1fr_1fr_1fr] gap-4 sm:gap-6 md:gap-10">
        <div>
          <Link href="/" className="flex items-center gap-2.5 mb-3">
            <Logo size={24} />
            <span className="font-serif text-xl">
              kitstack<span className="text-ks-accent">.co</span>
            </span>
          </Link>
          <div className="font-sans text-[13px] text-ks-muted leading-relaxed max-w-xs">
            Free skills and subscription kits that turn Claude into a
            specialist. Skills download free. Kits remember everything.
          </div>
        </div>

        {columns.map((col) => (
          <div key={col.heading}>
            <div className="font-sans text-xs font-semibold uppercase tracking-wider mb-2.5">
              {col.heading}
            </div>
            {col.links.map((link) =>
              link.external ? (
                <a
                  key={link.label}
                  href={link.href}
                  className="block font-sans text-[13px] text-ks-muted mb-1.5 hover:text-ks-ink"
                >
                  {link.label}
                </a>
              ) : (
                <Link
                  key={link.label}
                  href={link.href}
                  className="block font-sans text-[13px] text-ks-muted mb-1.5 hover:text-ks-ink"
                >
                  {link.label}
                </Link>
              )
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 pt-5 border-t border-ks-hair flex flex-col sm:flex-row justify-between gap-2 sm:gap-0 font-mono text-[11px] text-ks-muted">
        <div>&copy; 2026 kitstack &mdash; shipped from Germany</div>
      </div>
    </footer>
  );
}
