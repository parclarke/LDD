type RailRoute = 'worklist' | 'cases' | 'newCase' | 'insights' | 'config';

interface Props {
  active: string;
  onNavigate: (route: RailRoute) => void;
}

const ITEMS: Array<{ key: Props['active']; icon: string; title: string; route: RailRoute }> = [
  { key: 'worklist', icon: '☺', title: 'My worklist', route: 'worklist' },
  { key: 'cases', icon: '☷', title: 'All cases', route: 'cases' },
  { key: 'newCase', icon: '⊕', title: 'Create case', route: 'newCase' },
  { key: 'insights', icon: '◔', title: 'Insights', route: 'insights' },
  { key: 'config', icon: '⚙', title: 'Process model', route: 'config' },
];

/** Narrow icon rail down the left edge, mirroring the Pega navigation strip. */
export function IconRail({ active, onNavigate }: Props) {
  return (
    <nav className="icon-rail" aria-label="Primary">
      <button className="rail-btn" title="Search" type="button">
        ⌕
      </button>
      <div className="rail-sep" />
      {ITEMS.map((it) => (
        <button
          key={it.key}
          className={`rail-btn${active === it.key ? ' active' : ''}`}
          title={it.title}
          type="button"
          onClick={() => onNavigate(it.route)}
        >
          {it.icon}
        </button>
      ))}
      <div className="rail-sep" />
      <button className="rail-btn" title="Notifications" type="button">
        ⌾
      </button>
      <button className="rail-btn" title="History" type="button">
        ⏱
      </button>
    </nav>
  );
}
