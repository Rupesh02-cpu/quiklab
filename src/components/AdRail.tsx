interface AdRailProps {
  readonly side: "left" | "right";
}

export function AdRail({ side }: AdRailProps) {
  return (
    <aside className={`ad-rail ad-rail-${side}`} aria-hidden="true">
      <div className="ad-slot" />
    </aside>
  );
}
