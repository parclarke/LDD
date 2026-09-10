import { ICONS } from '../lib/icons';

interface IconProps {
  name: string;
  className?: string;
}

/** Renders one glyph from the prototype's icon set. */
export function Icon({ name, className }: IconProps) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <path d={ICONS[name] ?? ICONS.apps} />
    </svg>
  );
}
