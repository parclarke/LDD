import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { statusClass } from '../lib/status';

export function StatusChip({ status }: { status?: string | null }) {
  const label = (status ?? 'New').toUpperCase();
  return <span className={`st ${statusClass(status)}`.trim()}>{label}</span>;
}

/** The four-button table toolbar the prototype puts on every card header. */
export function Toolbar() {
  return (
    <div className="acts">
      <button title="Search" type="button">
        <Icon name="search" />
      </button>
      <button title="Columns" type="button">
        <Icon name="colv" />
      </button>
      <button title="Expand" type="button">
        <Icon name="expand" />
      </button>
      <button title="More" type="button">
        <Icon name="kebab" />
      </button>
    </div>
  );
}

interface PageHeaderProps {
  icon: string;
  title: string;
  sub?: string;
  children?: ReactNode;
}

export function PageHeader({ icon, title, sub, children }: PageHeaderProps) {
  return (
    <div className="ph">
      <div className="badge">
        <Icon name={icon} />
      </div>
      <div>
        <h1>{title}</h1>
        {sub ? <div className="sub">{sub}</div> : null}
      </div>
      {children ? (
        <>
          <span className="spacer" />
          {children}
        </>
      ) : null}
    </div>
  );
}
