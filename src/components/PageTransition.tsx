"use client";

import { useEffect } from "react";

// Wraps Next.js App Router's client-side navigation in the native
// View Transitions API (document.startViewTransition), so the cross-fade
// + settle defined in quiklab.css's "Cross-page navigation" block actually
// plays between / and /pdf. Pure progressive enhancement: browsers without
// the API (anything but current Chromium/Edge) just keep the instant swap
// they already had — this only calls an API it first feature-detects, no
// polyfill, no extra bytes for a capability most browsers don't have yet.
// Mounted once in the root layout; renders nothing itself.
export function PageTransition() {
  useEffect(() => {
    type ViewTransitionDocument = Document & {
      startViewTransition?: (callback: () => void | Promise<void>) => void;
    };
    const doc = document as ViewTransitionDocument;
    if (typeof doc.startViewTransition !== "function") return;

    // Intercept plain left-clicks on same-origin internal nav links (the
    // site header's two tool links) before Next's router handles them.
    // React's own click handler (attached at the root, also during the
    // capture/bubble cycle) runs the actual navigation; wrapping that same
    // dispatch in startViewTransition lets the browser snapshot the DOM
    // just before and just after React finishes re-rendering, and animate
    // between the two via the ::view-transition-old/new(root) pseudo
    // elements. If the DOM doesn't actually change (e.g. clicking the
    // already-active link), the transition just plays and settles on
    // identical frames — harmless.
    let replaying = false;
    const onClick = (e: MouseEvent) => {
      if (replaying || e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as Element | null)?.closest?.("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href") || "";
      if (!href.startsWith("/") || href.startsWith("//")) return;
      const targetPath = href.split(/[?#]/)[0];
      if (targetPath === window.location.pathname) return;

      e.preventDefault();
      doc.startViewTransition!(() => {
        replaying = true;
        anchor.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        replaying = false;
      });
    };

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
