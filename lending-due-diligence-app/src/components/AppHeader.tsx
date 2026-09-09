import type { CurrentUser } from '../lib/types';

interface Props {
  user: CurrentUser;
  onHome: () => void;
  appName: string;
}

/** White masthead matching the Pega Constellation application chrome. */
export function AppHeader({ user, onHome, appName }: Props) {
  return (
    <header className="app-header">
      <button className="brand" onClick={onHome} type="button" aria-label="Return home">
        <span className="brand-waffle" aria-hidden="true">
          {Array.from({ length: 9 }, (_, i) => (
            <span key={i} />
          ))}
        </span>
      </button>
      <span className="brand-title">{appName}</span>
      <div className="header-spacer" />
      <div className="header-right">
        <span className="header-link">Français</span>
        <span className="divider">|</span>
        <span className="avatar">{user.initials}</span>
        <span>{user.displayName}</span>
        <span className="divider">|</span>
        <span className="header-link">⇥ Log off</span>
      </div>
    </header>
  );
}
