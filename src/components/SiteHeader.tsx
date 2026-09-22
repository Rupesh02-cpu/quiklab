"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV_LINKS = [
  { href: "/", label: "Image compressor", icon: "image" },
  { href: "/pdf", label: "PDF toolkit", icon: "pdf" },
];

export function SiteHeader() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);

  // Exposes the header's real rendered height as --header-h on the root
  // element, so anything below it (the wizard workspace card) can size
  // itself to "the rest of the viewport" via calc(100dvh - var(--header-h))
  // without guessing a fixed number. The header's height genuinely varies
  // (wraps to two lines on narrow screens, different font metrics per
  // browser/zoom), so only a live measurement is actually accurate.
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const setHeight = () => {
      document.documentElement.style.setProperty("--header-h", `${el.getBoundingClientRect().height}px`);
    };
    setHeight();
    const observer = new ResizeObserver(setHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <header className="site-header" ref={headerRef}>
      <div className="site-header-left">
        <Link href="/" className="site-logo">
          <span className="brand-mark">QL</span>
          <span className="site-logo-word">QuikLab</span>
        </Link>
        <nav className="site-nav" aria-label="Tools">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`site-nav-link${pathname === link.href ? " is-current" : ""}`}
            >
              <Icon name={link.icon} /> {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="site-header-right">
        <ThemeToggle />
      </div>
    </header>
  );
}
