import Link from "next/link";
import { Logo } from "@/components/ui/logo";

const items = [
  { label: "Skills", href: "/skills" },
  { label: "Kits", href: "/kits" },
  { label: "Pricing", href: "/pricing" },
  { label: "Authors", href: "/authors/kitstack" },
];

export function Nav({ active }: { active?: string }) {
  return (
    <div className="flex items-center justify-between px-12 py-5 border-b border-ks-hair bg-ks-paper relative z-10">
      <Link href="/" className="flex items-center gap-3">
        <Logo />
        <span className="font-serif text-[22px] tracking-tight">
          kitstack<span className="text-ks-accent">.co</span>
        </span>
      </Link>

      <div className="flex gap-7">
        {items.map((it) => (
          <Link
            key={it.label}
            href={it.href}
            className={`font-sans text-sm pb-[3px] border-b-2 ${
              active === it.label
                ? "font-semibold text-ks-ink border-ks-accent"
                : "font-medium text-ks-muted border-transparent hover:text-ks-ink"
            }`}
          >
            {it.label}
          </Link>
        ))}
      </div>

      <div className="flex gap-2.5 items-center">
        <span className="font-sans text-[13px] text-ks-muted cursor-pointer hover:text-ks-ink">
          Sign in
        </span>
        <button className="ks-btn ks-btn-primary !py-2 !px-3.5 !text-[13px]">
          Connect to Claude &rarr;
        </button>
      </div>
    </div>
  );
}
