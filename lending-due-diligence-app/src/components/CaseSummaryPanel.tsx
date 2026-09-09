import { dash, relativeTime } from '../lib/format';
import type { CaseBundle, LddStage } from '../lib/types';

interface Props {
  bundle: CaseBundle;
  activeSection: string;
  onSection: (section: string) => void;
  onChangeStage: (stageCode: string) => void;
}

const SECTIONS = ['Overview', 'Case Details', 'Process', 'Notifications', 'History'];

/** Teal case banner plus the summary rail shown to the left of a case. */
export function CaseSummaryPanel({ bundle, activeSection, onSection, onChangeStage }: Props) {
  const { record, caseType, stages } = bundle;
  const resolved = (record.ava_status ?? '').startsWith('Resolved');
  const alternates = stages
    .filter((s) => s.ava_stagetype === 'Alternate')
    .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));

  return (
    <aside className="case-rail">
      <div className="case-banner">
        <div className="case-icon">🗂</div>
        <div>
          <div className="case-id">{record.ava_name}</div>
          <div className="case-type">{caseType?.ava_name ?? record.ava_casetypecode}</div>
        </div>
        <div className="star">☆</div>
      </div>

      <div className="case-actions">
        <StageMenu alternates={alternates} disabled={resolved} onChangeStage={onChangeStage} />
      </div>

      <div className="case-summary">
        <div className="summary-row">
          <div className="k">Status</div>
          <div className="v">
            <span className={`status-chip${resolved ? '' : ' new'}`}>{dash(record.ava_status)}</span>
          </div>
        </div>
        <Row k="Stage" v={dash(record.ava_stagename)} />
        <Row k="Assigned to" v={dash(record.ava_assignedto)} />
        <Row k="Routing" v={dash(record.ava_assignmenttype)} />
        <Row k="Workbasket" v={dash(record.ava_workbasket)} />
        <Row k="Urgency" v={dash(record.ava_urgency)} />
        <Row k="SLA deadline" v={record.ava_sladeadline ? relativeTime(record.ava_sladeadline) : '—'} />
        {record.ava_lastdecisionresult && (
          <Row k="Last decision" v={record.ava_lastdecisionresult} />
        )}

        <div className="summary-row">
          <div className="k">Created</div>
          <div className="v person">
            {dash(record.ava_createdbyuser)}
            <br />
            {relativeTime(record.createdon)}
          </div>
        </div>
        <div className="summary-row">
          <div className="k">Updated</div>
          <div className="v person">{relativeTime(record.modifiedon)}</div>
        </div>
        {resolved && (
          <div className="summary-row">
            <div className="k">Resolved</div>
            <div className="v person">
              {dash(record.ava_resolvedby)}
              <br />
              {relativeTime(record.ava_resolvedon)}
            </div>
          </div>
        )}
      </div>

      <div className="case-nav">
        {SECTIONS.map((s) => (
          <button
            key={s}
            type="button"
            className={activeSection === s ? 'active' : ''}
            onClick={() => onSection(s)}
          >
            {s}
          </button>
        ))}
      </div>
    </aside>
  );
}

function StageMenu({
  alternates,
  disabled,
  onChangeStage,
}: {
  alternates: LddStage[];
  disabled: boolean;
  onChangeStage: (code: string) => void;
}) {
  if (disabled || !alternates.length) {
    return <span className="muted" style={{ fontSize: 13 }}>No actions available</span>;
  }
  return (
    <select
      aria-label="Change stage"
      value=""
      onChange={(e) => e.target.value && onChangeStage(e.target.value)}
      style={{ border: 'none', color: 'var(--action-red)', fontWeight: 600, background: 'none' }}
    >
      <option value="">Actions ▾</option>
      {alternates.map((s) => (
        <option key={s.ava_lddstageid} value={s.ava_stagecode ?? ''}>
          Move to {s.ava_name}
        </option>
      ))}
    </select>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="summary-row">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}
