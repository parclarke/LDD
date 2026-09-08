import type { CurrentUser } from '../lib/types';

interface Props {
  user: CurrentUser;
  onHome: () => void;
  appName: string;
}

/** Red masthead matching the CIBC / Pega application chrome. */
export function AppHeader({ user, onHome, appName }: Props) {
  return (
    <header className="app-header">
      <div className="brand" onClick={onHome} role="button" tabIndex={0}>
        <span className="brand-mark">CIBC</span>
        <span className="brand-diamond" aria-hidden="true" />
      </div>
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
