import type { LddCaseType } from '../lib/types';
import { routeKey, type PocRoute } from '../lib/routes';
import { Icon } from './Icon';
import { iconFor } from '../lib/icons';

interface RailProps {
  appName: string;
  caseTypes: LddCaseType[];
  route: PocRoute;
  expanded: boolean;
  onToggle: () => void;
  onNavigate: (route: PocRoute) => void;
  onCreate: () => void;
}

interface RailLinkProps {
  icon: string;
  label: string;
  active: boolean;
  expanded: boolean;
  onClick: () => void;
}

function RailLink({ icon, label, active, expanded, onClick }: RailLinkProps) {
  return (
    <a
      className={active ? 'on' : undefined}
      onClick={onClick}
      role="button"
      tabIndex={0}
      title={expanded ? undefined : label}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onClick();
      }}
    >
      <Icon name={icon} />
      {expanded ? <span className="lbl">{label}</span> : <span className="tip">{label}</span>}
    </a>
  );
}

/**
 * Left navigation. Collapsed it is the icon rail; expanded it shows labels, in the
 * same order as the source application: Create, Home, My Work, Explore Data,
 * Dashboards, one entry per case type, Records Manager, the app agent, then
 * Notifications, Recents and the AI assistant pinned to the bottom.
 */
export function Rail({ appName, caseTypes, route, expanded, onToggle, onNavigate, onCreate }: RailProps) {
  const key = routeKey(route);
  const link = (icon: string, label: string, activeKey: string, target: PocRoute) => (
    <RailLink
      key={activeKey}
      icon={icon}
      label={label}
      expanded={expanded}
      active={key === activeKey}
      onClick={() => onNavigate(target)}
    />
  );

  return (
    <nav className={expanded ? 'rail wide' : 'rail'}>
      <button className="new" onClick={onCreate} title="Create" type="button">
        <Icon name="plus" />
        {expanded ? (
          <>
            <span className="lbl">Create</span>
            <span className="caret">›</span>
          </>
        ) : null}
      </button>

      {link('home', 'Home', 'home', { name: 'home' })}
      {link('work', 'My Work', 'mywork', { name: 'mywork' })}
      {link('search', 'Explore Data', 'explore', { name: 'explore' })}
      {link('apps', 'Dashboards', 'dashboards', { name: 'dashboards' })}

      {caseTypes.map((ct, i) => {
        const code = ct.ava_code ?? ct.ava_lddcasetypeid;
        return (
          <RailLink
            key={ct.ava_lddcasetypeid}
            icon={iconFor(ct.ava_code, i)}
            label={ct.ava_name ?? code}
            expanded={expanded}
            active={key === `type:${code}`}
            onClick={() => onNavigate({ name: 'type', code })}
          />
        );
      })}

      {link('data', 'Records Manager', 'records', { name: 'records' })}
      {link('spark', `${appName} Agent`, 'agent', { name: 'agent' })}

      <span className="sp" />

      {link('bell', 'Notifications', 'notifications', { name: 'home' })}
      {link('clock', 'Recents', 'recents', { name: 'mywork' })}
      {link('spark', 'AI Assistant', 'assistant', { name: 'agent' })}

      <button
        className="navtoggle"
        onClick={onToggle}
        type="button"
        title={expanded ? 'Collapse navigation' : 'Expand navigation'}
      >
        <Icon name={expanded ? 'collapse' : 'expandnav'} />
        {expanded ? <span className="lbl">Collapse navigation</span> : null}
      </button>
    </nav>
  );
}
