import { useState } from 'react';
import './theme.css';
import { AppHeader } from './components/AppHeader';
import { IconRail } from './components/IconRail';
import { WorklistScreen } from './screens/WorklistScreen';
import { CaseListScreen } from './screens/CaseListScreen';
import { NewCaseTransactionScreen } from './screens/NewCaseTransactionScreen';
import { NewCaseParametersScreen } from './screens/NewCaseParametersScreen';
import { CaseScreen } from './screens/CaseScreen';
import type { CurrentUser, Route } from './lib/types';

export const APP_VERSION = '1.0.0';

const DEFAULT_USER: CurrentUser = {
  operatorId: 'MM01025',
  displayName: 'BEL, MM01025_RSA',
  initials: 'BM',
  role: 'BusinessControl',
};

function App() {
  const [route, setRoute] = useState<Route>({ name: 'worklist' });
  const [user] = useState<CurrentUser>(DEFAULT_USER);

  const railActive =
    route.name === 'worklist'
      ? 'worklist'
      : route.name === 'cases' || route.name === 'case'
        ? 'cases'
        : 'new';

  return (
    <div className="app-shell">
      <AppHeader user={user} onHome={() => setRoute({ name: 'worklist' })} />
      <div className="app-body">
        <IconRail
          active={railActive}
          onWorklist={() => setRoute({ name: 'worklist' })}
          onCases={() => setRoute({ name: 'cases' })}
          onNewCase={() => setRoute({ name: 'newCaseTransaction' })}
        />
        <main className="main-area">
          {route.name === 'worklist' && (
            <WorklistScreen
              userLabel={user.initials}
              onOpenCase={(caseId, taskId) => setRoute({ name: 'case', caseId, openTaskId: taskId })}
            />
          )}

          {route.name === 'cases' && (
            <CaseListScreen
              onOpenCase={(caseId) => setRoute({ name: 'case', caseId })}
              onNewCase={() => setRoute({ name: 'newCaseTransaction' })}
            />
          )}

          {route.name === 'newCaseTransaction' && (
            <NewCaseTransactionScreen
              userInitials={user.initials}
              onContinue={(transactionId) => setRoute({ name: 'newCaseParameters', transactionId })}
              onCancel={() => setRoute({ name: 'worklist' })}
            />
          )}

          {route.name === 'newCaseParameters' && (
            <NewCaseParametersScreen
              transactionId={route.transactionId}
              user={user}
              onCreated={(caseId) => setRoute({ name: 'case', caseId })}
              onBack={() => setRoute({ name: 'newCaseTransaction' })}
              onCancel={() => setRoute({ name: 'worklist' })}
            />
          )}

          {route.name === 'case' && (
            <CaseScreen
              key={route.caseId}
              caseId={route.caseId}
              initialTaskId={route.openTaskId}
              user={user}
              onExit={() => setRoute({ name: 'worklist' })}
            />
          )}
        </main>
      </div>
      <footer className="app-footer">
        <span>Lending Due Diligence — Power Apps code app</span>
        <span>v{APP_VERSION}</span>
      </footer>
    </div>
  );
}

export default App;
