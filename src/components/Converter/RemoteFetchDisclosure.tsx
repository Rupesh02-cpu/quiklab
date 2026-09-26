"use client";

import { Icon } from "@/components/Icon";
import type { RemoteFetchFailure } from "@/hooks/useConverter";

interface RemoteFetchDisclosureProps {
  readonly failure: RemoteFetchFailure;
  readonly onDismiss: () => void;
}

// Shown when the direct client-side fetch (src/lib/converters/remoteFetch.ts)
// fails. Per REQUIREMENTS_new-features.md's phased build order, the
// serverless proxy fallback (approach (b): a route that fetches server-side
// to route around CORS) is explicitly deferred to a later phase - it's the
// highest-risk piece (the one exception to "files never leave your
// device", plus real SSRF surface) and shouldn't ship until (a) has been
// observed in real use. So this component only explains the failure
// honestly and points back at the direct-upload path, with no proxy
// option to opt into yet.
export function RemoteFetchDisclosure({ failure, onDismiss }: RemoteFetchDisclosureProps) {
  return (
    <div className="crop-warning converter-remote-failure">
      <Icon name="system" className="icon icon-sm" />
      <div>
        <p>{failure.message}</p>
        <button type="button" className="btn-text" onClick={onDismiss}>
          Try a different link or upload a file instead
        </button>
      </div>
    </div>
  );
}
