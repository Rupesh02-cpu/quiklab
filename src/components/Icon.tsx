interface IconProps {
  readonly name: string;
  readonly className?: string;
}

export function Icon({ name, className = "icon" }: IconProps) {
  return (
    <svg className={className} aria-hidden="true">
      <use href={`#icon-${name}`} />
    </svg>
  );
}
