import type { LddCaseType } from '../lib/types';
import { routeKey, type PocRoute } from '../lib/routes';
import { Icon } from './Icon';
import { iconFor } from '../lib/icons';

interface RailProps {
  caseTypes: LddCaseType[];
  route: PocRoute;
  onNavigate: (route: PocRoute) => void;
  onCreate: () => void;
}

interface RailLinkProps {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}

function RailLink({ icon, label, active, onClick }: RailLinkProps) {
  return (
    <a
      className={active ? 'on' : undefined}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
    >
      <Icon name={icon} />
      <span className="tip">{label}</span>
    </a>
  );
}

/**
 * Left icon rail. Order matches the prototype: create, Home, My Work, Explore,
 * one entry per case type, Record Manager, spacer, Notifications, Recents.
 */
export function Rail({ caseTypes, route, onNavigate, onCreate }: RailProps) {
  const key = routeKey(route);
  return (
    <nav className="rail">
      <button className="new" onClick={onCreate} title="Create new case">
        <Icon name="plus" />
      </button>
      <RailLink icon="home" label="Home" active={key === 'home'} onClick={() => onNavigate({ name: 'home' })} />
      <RailLink icon="work" label="My Work" active={key === 'mywork'} onClick={() => onNavigate({ name: 'mywork' })} />
      <RailLink
        icon="search"
        label="Explore"
        active={key === 'explore'}
        onClick={() => onNavigate({ name: 'explore' })}
      />
      {caseTypes.map((ct, i) => {
        const code = ct.ava_code ?? ct.ava_lddcasetypeid;
        return (
          <RailLink
            key={ct.ava_lddcasetypeid}
            icon={iconFor(ct.ava_code, i)}
            label={ct.ava_name}
            active={key === `type:${code}`}
            onClick={() => onNavigate({ name: 'type', code })}
          />
        );
      })}
      <RailLink
        icon="data"
        label="Record Manager"
        active={key === 'records'}
        onClick={() => onNavigate({ name: 'records' })}
      />
      <span className="sp" />
      <RailLink icon="bell" label="Notifications" active={false} onClick={() => onNavigate({ name: 'home' })} />
      <RailLink icon="clock" label="Recents" active={false} onClick={() => onNavigate({ name: 'mywork' })} />
    </nav>
  );
}
