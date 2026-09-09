import { useEffect, useState } from 'react';
import './theme.css';
import { AppHeader } from './components/AppHeader';
import { IconRail } from './components/IconRail';
import { WorklistScreen } from './screens/WorklistScreen';
import { CaseListScreen } from './screens/CaseListScreen';
import { NewCaseScreen } from './screens/NewCaseScreen';
import { CaseScreen } from './screens/CaseScreen';
import { ConfigScreen } from './screens/ConfigScreen';
import { InsightsScreen } from './screens/InsightsScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { loadLookupSources, loadProcessConfig } from './lib/data';
import type { LookupSources } from './lib/data';
import type { CurrentUser, ProcessConfig, Route } from './lib/types';

export const APP_VERSION = '2.0.0';
const APP_NAME = 'The Lending Due Diligence (LDD)';

/**
 * The signed-in operator. Power Apps exposes the real identity through
 * `getContext()` from `@microsoft/power-apps/app`; wiring that up is covered in
 * the developer handover notes.
 */
const DEFAULT_USER: CurrentUser = {
  operatorId: 'MM01025',
  displayName: 'BEL, MM01025_RSA',
  initials: 'BM',
  role: 'OperationsManager',
  workbaskets: ['TheLending:Users'],
};

function App() {
  const [route, setRoute] = useState<Route>({ name: 'worklist' });
  const [user] = useState<CurrentUser>(DEFAULT_USER);
  const [config, setConfig] = useState<ProcessConfig | null>(null);
  const [lookups, setLookups] = useState<LookupSources>({});
  const [error, setError] = useState<string | null>(null);

  // The process configuration is small and needed by every screen, so it is
  // loaded once at start-up and passed down.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [cfg, lk] = await Promise.all([loadProcessConfig(), loadLookupSources()]);
        if (cancelled) return;
        setConfig(cfg);
        setLookups(lk);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const railActive =
    route.name === 'case' ? 'cases' : route.name === 'newCase' ? 'newCase' : route.name;

  return (
    <div className="app-shell">
      <AppHeader user={user} appName={APP_NAME} onHome={() => setRoute({ name: 'worklist' })} />
      <div className="app-body">
        <IconRail active={railActive} onNavigate={(r) => setRoute({ name: r } as Route)} />
        <main className="main-area">
          {error && (
            <div className="work-area">
              <div className="banner-msg error">
                Could not load the process configuration: {error}
              </div>
            </div>
          )}

          {!config && !error && route.name !== 'records' && (
            <div className="loading">Loading process configuration…</div>
          )}

          {config && route.name === 'worklist' && (
            <WorklistScreen
              config={config}
              userLabel={user.initials}
              onOpenCase={(caseId, assignmentId) =>
                setRoute({ name: 'case', caseId, openAssignmentId: assignmentId })
              }
            />
          )}

          {config && route.name === 'cases' && (
            <CaseListScreen
              config={config}
              onOpenCase={(caseId) => setRoute({ name: 'case', caseId })}
              onNewCase={() => setRoute({ name: 'newCase' })}
            />
          )}

          {config && route.name === 'newCase' && (
            <NewCaseScreen
              config={config}
              lookups={lookups}
              user={user}
              onCreated={(caseId) => setRoute({ name: 'case', caseId })}
              onCancel={() => setRoute({ name: 'worklist' })}
            />
          )}

          {config && route.name === 'case' && (
            <CaseScreen
              key={route.caseId}
              caseId={route.caseId}
              initialAssignmentId={route.openAssignmentId}
              config={config}
              lookups={lookups}
              user={user}
              onExit={() => setRoute({ name: 'worklist' })}
            />
          )}

          {config && route.name === 'insights' && (
            <InsightsScreen
              config={config}
              onOpenCase={(caseId) => setRoute({ name: 'case', caseId })}
            />
          )}

          {/* Records Manager browses reference data and does not need the process model. */}
          {route.name === 'records' && <RecordsScreen />}

          {config && route.name === 'config' && (
            <ConfigScreen config={config} appName={APP_NAME} />
          )}
        </main>
      </div>
      <footer className="app-footer">
        <span>{APP_NAME} — Power Apps code app</span>
        <span>v{APP_VERSION}</span>
      </footer>
    </div>
  );
}

export default App;
