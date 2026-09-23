import type { CSSProperties } from "react";

interface IconProps {
  readonly name: string;
  readonly className?: string;
  readonly style?: CSSProperties;
}

export function Icon({ name, className = "icon", style }: IconProps) {
  return (
    <svg className={className} style={style} aria-hidden="true">
      <use href={`#icon-${name}`} />
    </svg>
  );
}
