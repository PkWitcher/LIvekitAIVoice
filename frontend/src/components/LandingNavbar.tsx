"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Menu, Phone, X } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#use-cases", label: "Use cases" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export default function LandingNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    const mq = window.matchMedia("(min-width: 881px)");
    const onChange = () => {
      if (mq.matches) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey);
    mq.addEventListener("change", onChange);
    return () => {
      document.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onChange);
    };
  }, [menuOpen]);

  const close = () => setMenuOpen(false);

  return (
    <header className="pp2-nav">
      <div className="pp2-wrap">
        <div className="pp2-nav-row">
          <Link href="/" className="pp2-brand" aria-label="Nova AI home">
            <span className="pp2-logo" aria-hidden="true">
              <Phone size={16} strokeWidth={2.25} />
            </span>
            Nova AI
          </Link>

          <nav className="pp2-nav-links" aria-label="Primary">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} className="pp2-nav-link">
                {l.label}
              </a>
            ))}
          </nav>

          <div className="pp2-nav-actions">
            <ThemeToggle />
            <Link href="/login" className="pp2-btn pp2-btn-ghost pp2-nav-cta">
              Log in
            </Link>
            <Link href="/login?mode=signup" className="pp2-btn pp2-btn-primary pp2-nav-cta">
              Get started
            </Link>
            <button
              ref={buttonRef}
              type="button"
              className="pp2-burger"
              onClick={() => setMenuOpen((o) => !o)}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
            >
              {menuOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            </button>
          </div>
        </div>

        <div id={menuId} className={`pp2-mobile-menu${menuOpen ? " is-open" : ""}`}>
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="pp2-nav-link" onClick={close}>
              {l.label}
            </a>
          ))}
          <div className="pp2-mobile-cta">
            <Link href="/login" className="pp2-btn pp2-btn-secondary" onClick={close}>
              Log in
            </Link>
            <Link href="/login?mode=signup" className="pp2-btn pp2-btn-primary" onClick={close}>
              Get started
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
