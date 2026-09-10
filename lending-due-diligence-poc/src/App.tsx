import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CurrentUser, LddAssignment, LddWorkCase, ProcessConfig } from './lib/types';
import { listOpenAssignments, listWorkCases, loadProcessConfig } from './lib/data';
import { EMPTY_APP_DATA, type AppData } from './lib/appdata';
import type { PocRoute } from './lib/routes';
import { AppBar } from './components/AppBar';
import { Rail } from './components/Rail';
import { CasePanel } from './components/CasePanel';
import { StepWizard } from './components/StepWizard';
import { HomeScreen } from './screens/HomeScreen';
import { MyWorkScreen } from './screens/MyWorkScreen';
import { CaseTypeScreen } from './screens/CaseTypeScreen';
import { RecordsScreen } from './screens/RecordsScreen';
import { ExploreScreen } from './screens/ExploreScreen';

/**
 * Placeholder operator until the app reads the signed-in identity from the
 * Power Apps host context via `getContext()`.
 */
const DEFAULT_USER: CurrentUser = {
  operatorId: 'MM01025',
  displayName: 'BEL, MM01025_RSA',
  initials: 'BM',
  role: 'OperationsManager',
  workbaskets: ['TheLending:Users'],
};

export default function App() {
  const [ready, setReady] = useState(false);
  const [route, setRoute] = useState<PocRoute>({ name: 'home' });
  const [search, setSearch] = useState('');
  const [config, setConfig] = useState<ProcessConfig | null>(null);
  const [cases, setCases] = useState<LddWorkCase[]>([]);
  const [assignments, setAssignments] = useState<LddAssignment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [panelCaseId, setPanelCaseId] = useState<string | null>(null);
  const [wizard, setWizard] = useState<{ caseId: string; assignment: LddAssignment } | null>(null);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);

  const reload = useCallback(async () => {
    const [cfg, workCases, open] = await Promise.all([
      loadProcessConfig(),
      listWorkCases(),
      listOpenAssignments(),
    ]);
    setConfig(cfg);
    setCases(workCases);
    setAssignments(open);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadProcessConfig(), listWorkCases(), listOpenAssignments()])
      .then(([cfg, workCases, open]) => {
        if (cancelled) return;
        setConfig(cfg);
        setCases(workCases);
        setAssignments(open);
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const data: AppData = useMemo(() => {
    if (!config) return EMPTY_APP_DATA;
    return {
      caseTypes: config.caseTypes.slice().sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0)),
      stages: config.stages,
      steps: config.steps,
      cases,
      assignments,
    };
  }, [config, cases, assignments]);

  const panelCase = panelCaseId ? (cases.find((c) => c.ava_lddworkcaseid === panelCaseId) ?? null) : null;
  const wizardCase = wizard ? (cases.find((c) => c.ava_lddworkcaseid === wizard.caseId) ?? null) : null;

  const toast = useCallback((text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);

  const openAssignment = (caseId: string, assignmentId: string) => {
    const a = assignments.find((x) => x.ava_lddassignmentid === assignmentId);
    if (a) setWizard({ caseId, assignment: a });
  };

  const navigate = (next: PocRoute) => {
    setPanelCaseId(null);
    setRoute(next);
  };

  if (!ready) {
    return (
      <div className="empty" style={{ paddingTop: '6rem' }}>
        Loading Lending Due Diligence…
      </div>
    );
  }

  return (
    <>
      <AppBar
        appName="Lending Due Diligence PoC"
        userInitials={DEFAULT_USER.initials}
        search={search}
        onSearch={(v) => {
          setSearch(v);
          if (v && route.name !== 'explore') setRoute({ name: 'explore' });
        }}
      />
      <div className="shell">
        <Rail
          caseTypes={data.caseTypes}
          route={route}
          onNavigate={navigate}
          onCreate={() => toast('Case creation runs from the case type page')}
        />
        <main>
          {error ? <div className="note">Could not load data: {error}</div> : null}

          {route.name === 'home' ? (
            <HomeScreen
              data={data}
              onNavigate={navigate}
              onOpenCase={setPanelCaseId}
              onCreate={() => navigate({ name: 'mywork' })}
            />
          ) : null}

          {route.name === 'mywork' ? (
            <MyWorkScreen data={data} onOpenCase={setPanelCaseId} onOpenAssignment={openAssignment} />
          ) : null}

          {route.name === 'type' ? (
            <CaseTypeScreen
              data={data}
              code={route.code}
              onOpenCase={setPanelCaseId}
              onOpenAssignment={openAssignment}
              onCreate={() => toast('New case intake is available in the full application')}
            />
          ) : null}

          {route.name === 'records' ? <RecordsScreen /> : null}

          {route.name === 'explore' ? (
            <ExploreScreen data={data} search={search} onOpenCase={setPanelCaseId} />
          ) : null}
        </main>
      </div>

      {panelCase ? (
        <CasePanel
          data={data}
          record={panelCase}
          onClose={() => setPanelCaseId(null)}
          onOpenAssignment={(a) => setWizard({ caseId: panelCase.ava_lddworkcaseid, assignment: a })}
        />
      ) : null}

      {wizard && wizardCase && config ? (
        <StepWizard
          config={config}
          record={wizardCase}
          assignment={wizard.assignment}
          user={DEFAULT_USER}
          onClose={() => setWizard(null)}
          onSubmitted={(m) => {
            toast(m);
            void reload();
          }}
        />
      ) : null}

      <div className="toasts">
        {toasts.map((t) => (
          <div className="toast" key={t.id}>
            {t.text}
          </div>
        ))}
      </div>
    </>
  );
}
