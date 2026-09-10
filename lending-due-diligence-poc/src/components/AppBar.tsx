import { Icon } from './Icon';

interface AppBarProps {
  appName: string;
  userInitials: string;
  search: string;
  onSearch: (value: string) => void;
}

/** Constellation top bar: waffle launcher, app name, centred search, avatar. */
export function AppBar({ appName, userInitials, search, onSearch }: AppBarProps) {
  return (
    <header className="appbar">
      <div className="waffle" role="button" aria-label="App launcher" tabIndex={0}>
        {Array.from({ length: 9 }, (_, i) => (
          <i key={i} />
        ))}
      </div>
      <div className="appname">
        <span className="chev lead">›</span>
        {appName}
      </div>
      <div className="searchwrap">
        <div className="search">
          <span className="f" title="Filter">
            <Icon name="colv" />
          </span>
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search cases, customers and records"
            aria-label="Search"
          />
          <span className="s" title="Search">
            <Icon name="search" />
          </span>
        </div>
      </div>
      <div className="avatar" title="Signed in user">
        {userInitials}
      </div>
    </header>
  );
}
