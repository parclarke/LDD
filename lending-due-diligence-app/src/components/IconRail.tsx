interface Props {
  active: 'worklist' | 'cases' | 'new';
  onWorklist: () => void;
  onCases: () => void;
  onNewCase: () => void;
}

/** Narrow icon rail down the left edge, mirroring the Pega navigation strip. */
export function IconRail({ active, onWorklist, onCases, onNewCase }: Props) {
  return (
    <nav className="icon-rail" aria-label="Primary">
      <button className="rail-btn" title="Search" type="button">
        ⌕
      </button>
      <button className="rail-btn" title="Recents" type="button">
        ⟩
      </button>
      <button className="rail-btn" title="Create case" type="button" onClick={onNewCase}>
        ⊕
      </button>
      <div className="rail-sep" />
      <button
        className={`rail-btn${active === 'worklist' ? ' active' : ''}`}
        title="My worklist"
        type="button"
        onClick={onWorklist}
      >
        ☺
      </button>
      <button
        className={`rail-btn${active === 'cases' ? ' active' : ''}`}
        title="All cases"
        type="button"
        onClick={onCases}
      >
        ☷
      </button>
      <button className="rail-btn" title="Business control" type="button">
        ⌸
      </button>
      <button className="rail-btn" title="Reports" type="button">
        ▤
      </button>
      <button className="rail-btn" title="Reference data" type="button">
        ▥
      </button>
      <button className="rail-btn" title="Bulk actions" type="button">
        ▦
      </button>
      <div className="rail-sep" />
      <button className="rail-btn" title="Links" type="button">
        ⛓
      </button>
      <button className="rail-btn" title="Notifications" type="button">
        ⌾
      </button>
      <button className="rail-btn" title="History" type="button">
        ⏱
      </button>
      <button className="rail-btn" title="Apps" type="button">
        ⠿
      </button>
    </nav>
  );
}
