"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface UnifiedResetContextValue {
  /** Resets the unified app back to the idle drop-zone state. Exposed for
   * SiteHeader's logo click to call without a hard navigation. `null` when
   * no page has registered a reset handler yet (e.g. before UnifiedApp has
   * mounted), so callers can no-op gracefully rather than throwing. */
  resetAll: (() => void) | null;
  /** Called by UnifiedApp on mount/unmount to register the page's actual
   * reset implementation. Not meant to be called from SiteHeader itself. */
  registerReset: (fn: (() => void) | null) => void;
}

const UnifiedResetContext = createContext<UnifiedResetContextValue | null>(null);

// Lives at the layout level (wraps both SiteHeader and the page content)
// so SiteHeader — a sibling of the page, not a descendant of UnifiedApp —
// can still reach whichever page's UnifiedApp is currently mounted below
// it. UnifiedApp registers its own resetAll on mount; SiteHeader just
// calls whatever's currently registered.
export function UnifiedResetProvider({ children }: { readonly children: ReactNode }) {
  const [resetFn, setResetFn] = useState<(() => void) | null>(null);

  const registerReset = useCallback((fn: (() => void) | null) => {
    setResetFn(() => fn);
  }, []);

  return (
    <UnifiedResetContext.Provider value={{ resetAll: resetFn, registerReset }}>
      {children}
    </UnifiedResetContext.Provider>
  );
}

export function useUnifiedReset(): UnifiedResetContextValue | null {
  return useContext(UnifiedResetContext);
}
