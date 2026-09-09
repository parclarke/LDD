import type { CurrentUser } from '../lib/types';
import cibcLogo from '../assets/cibc-logo.png';

interface Props {
  user: CurrentUser;
  onHome: () => void;
  appName: string;
}

/** Red masthead matching the CIBC / Pega application chrome. */
export function AppHeader({ user, onHome, appName }: Props) {
  return (
    <header className="app-header">
      <button className="brand" onClick={onHome} type="button" aria-label="Return home">
        <img className="brand-logo" src={cibcLogo} alt="CIBC" />
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
