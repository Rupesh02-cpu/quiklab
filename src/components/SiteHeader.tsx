"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { Icon } from "@/components/Icon";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useUnifiedReset } from "@/components/UnifiedUpload/UnifiedResetContext";

// The four tools, in the order they shipped. /wallpaper and /convert had no
// link anywhere on the site until this nav - .site-nav/.site-nav-link were
// already defined in quiklab.css but unused, so this just wires them up.
const NAV_ITEMS = [
  { href: "/", label: "Images", icon: "image" },
  { href: "/pdf", label: "PDF", icon: "pdf" },
  { href: "/wallpaper", label: "Wallpaper", icon: "filmstrip" },
  { href: "/convert", label: "Convert", icon: "link" },
] as const;

export function SiteHeader() {
  const pathname = usePathname();
  const headerRef = useRef<HTMLElement>(null);
  const unifiedReset = useUnifiedReset();

  const handleLogoClick = () => {
    if (pathname !== "/" && pathname !== "/pdf") return;
    // Resets the currently-mounted page's UnifiedApp back to its idle drop
    // zone in place, instead of relying on the Link's normal navigation
    // (which would remount the page but not necessarily feel like a
    // deliberate "start over" moment). Falls back to plain navigation if
    // no page has registered a reset handler yet (resetAll is null).
    unifiedReset?.resetAll?.();
  };

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
        <Link href="/" className="site-logo" onClick={handleLogoClick}>
          <span className="brand-mark">QL</span>
          <span className="site-logo-word">QuikLab</span>
        </Link>
        <nav className="site-nav" aria-label="Tools">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`site-nav-link${pathname === item.href ? " is-current" : ""}`}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <Icon name={item.icon} className="icon" />
              {item.label}
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
