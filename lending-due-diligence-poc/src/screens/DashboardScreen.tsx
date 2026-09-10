import { useCallback, useMemo, useState } from 'react';
import type { AppData } from '../lib/appdata';
import { caseTypeName } from '../lib/appdata';
import { ChartCard } from '../components/Chart';
import { Icon } from '../components/Icon';
import {
  changed,
  created,
  crossTab,
  dailySeries,
  isResolved,
  statusBucket,
  workMetrics,
} from '../lib/analytics';
import { DASHBOARDS } from '../lib/catalog';
import type { LddWorkCase } from '../lib/types';

interface DashboardScreenProps {
  data: AppData;
  id: string;
  onBack: () => void;
}

const STATUS_OPTIONS = ['All', 'New', 'Pending', 'Resolved'];
const DATE_OPTIONS = ['All time', 'This month', 'Last 3 months', 'This year'];

interface KpiProps {
  label: string;
  value: string;
  change?: number;
}

function Kpi({ label, value, change }: KpiProps) {
  return (
    <div className="kpi">
      <div className="lab">{label}</div>
      <div className="val">{value}</div>
      {change === undefined ? (
        <div className="delta flat">&nbsp;</div>
      ) : (
        <div className={`delta ${change < 0 ? 'down' : change > 0 ? '' : 'flat'}`.trim()}>
          {change > 0 ? '↑' : change < 0 ? '↓' : ''} {Math.abs(change)}% since last month
        </div>
      )}
    </div>
  );
}

interface FilterProps {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  onClear: () => void;
}

function Filter({ label, value, options, onChange, onClear }: FilterProps) {
  return (
    <div className="field">
      <label htmlFor={`f-${label}`}>{label}</label>
      <div className="fx">
        <select id={`f-${label}`} value={value} onChange={(e) => onChange(e.target.value)}>
          {options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
        <button type="button" className="clear" title={`Clear ${label}`} onClick={onClear}>
          ✕
        </button>
      </div>
    </div>
  );
}

function withinRange(c: LddWorkCase, range: string): boolean {
  if (range === DATE_OPTIONS[0]) return true;
  const d = created(c);
  if (!d) return false;
  const now = new Date();
  if (range === 'This month') return d >= new Date(now.getFullYear(), now.getMonth(), 1);
  if (range === 'Last 3 months') return d >= new Date(now.getFullYear(), now.getMonth() - 2, 1);
  return d >= new Date(now.getFullYear(), 0, 1);
}

/**
 * The Work metrics dashboard: two filters, four KPI tiles and the created /
 * resolved / volume-by-status charts, all derived from live Dataverse rows.
 */
export function DashboardScreen({ data, id, onBack }: DashboardScreenProps) {
  const [status, setStatus] = useState(STATUS_OPTIONS[0]);
  const [range, setRange] = useState(DATE_OPTIONS[0]);
  const [applied, setApplied] = useState({ status: STATUS_OPTIONS[0], range: DATE_OPTIONS[0] });

  const dashboard = DASHBOARDS.find((d) => d.id === id) ?? DASHBOARDS[0];

  const cases = useMemo(
    () =>
      data.cases.filter((c) => {
        if (!withinRange(c, applied.range)) return false;
        if (applied.status === 'All') return true;
        return statusBucket(c).toLowerCase().startsWith(applied.status.toLowerCase());
      }),
    [data.cases, applied]
  );

  const metrics = useMemo(() => workMetrics(cases, data.assignments), [cases, data.assignments]);
  const label = useCallback((c: LddWorkCase) => caseTypeName(data, c.ava_casetypecode), [data]);

  const createdDaily = useMemo(() => dailySeries(cases, created, label), [cases, label]);
  const resolvedDaily = useMemo(() => dailySeries(cases.filter(isResolved), changed, label), [cases, label]);
  const volume = useMemo(() => crossTab(cases, label, statusBucket), [cases, label]);

  const reset = () => {
    setStatus(STATUS_OPTIONS[0]);
    setRange(DATE_OPTIONS[0]);
    setApplied({ status: STATUS_OPTIONS[0], range: DATE_OPTIONS[0] });
  };

  return (
    <>
      <div className="crumbs">
        <a onClick={onBack}>Dashboards</a>
        <span>/</span>
        <strong>{dashboard.name}</strong>
      </div>

      <div className="ph">
        <div className="badge">
          <Icon name="chart" />
        </div>
        <div>
          <h1>{dashboard.name}</h1>
          <div className="sub">{dashboard.description}</div>
        </div>
      </div>

      <div className="filterbar">
        <Filter
          label="Work Status"
          value={status}
          options={STATUS_OPTIONS}
          onChange={setStatus}
          onClear={() => setStatus(STATUS_OPTIONS[0])}
        />
        <Filter
          label="Created Date"
          value={range}
          options={DATE_OPTIONS}
          onChange={setRange}
          onClear={() => setRange(DATE_OPTIONS[0])}
        />
        <span className="spacer" />
        <div className="right">
          <button className="btn o" type="button" onClick={reset}>
            Reset
          </button>
          <button className="btn" type="button" onClick={() => setApplied({ status, range })}>
            Apply
          </button>
        </div>
      </div>

      <div className="kpis">
        <Kpi label="Work items created this month" value={String(metrics.createdThisMonth)} change={metrics.createdChange} />
        <Kpi label="Average resolution duration (days)" value={metrics.averageResolutionDays.toFixed(2)} />
        <Kpi label="Work items resolved this month" value={String(metrics.resolvedThisMonth)} change={metrics.resolvedChange} />
        <Kpi label="Tasks past deadline" value={String(metrics.pastDeadline)} change={metrics.pastDeadlineChange} />
      </div>

      <div className="dashgrid">
        <ChartCard
          title="Number of work items created daily"
          kind="line"
          xLabel="Create date time"
          yLabel="Count Case ID"
          data={createdDaily}
        />
        <ChartCard
          title="Number of work items resolved daily"
          kind="line"
          xLabel="Resolution date time"
          yLabel="Count Case ID"
          data={resolvedDaily}
        />
        <ChartCard
          title="Work volume by status"
          kind="stacked"
          xLabel="Case type"
          yLabel="Count Case ID"
          data={volume}
        />
      </div>
    </>
  );
}
