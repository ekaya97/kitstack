"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/logo";
import { NavAuth } from "./nav-auth";

const items = [
  { label: "Skills", href: "/skills" },
  { label: "Kits", href: "/kits" },
  { label: "How it works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "Blog", href: "/blog" },
];

export function Nav({ active }: { active?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="relative z-10 border-b border-ks-hair bg-ks-paper">
      <div className="flex items-center justify-between px-4 sm:px-8 md:px-12 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={24} />
          <span className="font-serif text-lg tracking-tight">
            kitstack<span className="text-ks-accent">.co</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex gap-6">
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

        {/* Desktop auth */}
        <div className="hidden md:block">
          <NavAuth />
        </div>

        {/* Mobile hamburger button */}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          className="md:hidden flex flex-col justify-center gap-[5px] w-8 h-8 cursor-pointer"
          aria-label="Toggle menu"
        >
          <span
            className={`block h-[2px] w-5 bg-ks-ink rounded transition-transform ${
              menuOpen ? "translate-y-[7px] rotate-45" : ""
            }`}
          />
          <span
            className={`block h-[2px] w-5 bg-ks-ink rounded transition-opacity ${
              menuOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block h-[2px] w-5 bg-ks-ink rounded transition-transform ${
              menuOpen ? "-translate-y-[7px] -rotate-45" : ""
            }`}
          />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-ks-hair px-4 sm:px-8 pb-4 pt-3 flex flex-col gap-3 bg-ks-paper">
          {items.map((it) => (
            <Link
              key={it.label}
              href={it.href}
              onClick={() => setMenuOpen(false)}
              className={`font-sans text-[14px] py-1 ${
                active === it.label
                  ? "font-semibold text-ks-ink"
                  : "font-medium text-ks-muted hover:text-ks-ink"
              }`}
            >
              {it.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-ks-hair">
            <NavAuth />
          </div>
        </div>
      )}
    </nav>
  );
}
