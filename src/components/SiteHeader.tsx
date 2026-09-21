"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/Icon";

const NAV_LINKS = [
  { href: "/", label: "Image compressor", icon: "image" },
  { href: "/pdf", label: "PDF toolkit", icon: "pdf" },
];

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <header className="site-header">
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
    </header>
  );
}
