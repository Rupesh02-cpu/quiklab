// Purely decorative, idle-motion backdrop: two soft radial glows that drift
// very slowly behind the workspace. Pure CSS (no JS animation loop, no
// canvas) — it's a fixed, aria-hidden layer so it costs nothing at
// interaction time and never intercepts pointer events. Uses only the
// existing --accent / --bg tokens, so it re-themes for free with the rest
// of the app. See .ambient-bg rules in quiklab.css for the animation itself
// and the prefers-reduced-motion fallback (drift stops, glow stays static).
export function AmbientBackground() {
  return (
    <div className="ambient-bg" aria-hidden="true">
      <span className="ambient-glow ambient-glow-a" />
      <span className="ambient-glow ambient-glow-b" />
    </div>
  );
}
