import { dash, relativeTime } from '../lib/format';
import type { LddCase } from '../lib/types';

interface Props {
  record: LddCase;
  activeSection: string;
  onSection: (section: string) => void;
  onReopen?: () => void;
  showEdit: boolean;
}

const SECTIONS = [
  'Overview',
  'Transaction Information',
  'Additional Metrics',
  'Employee Information',
  'Rating and Recommendation',
  'Attachment List',
];

/** Teal case banner + summary rail shown to the left of every case screen. */
export function CaseSummaryPanel({
  record,
  activeSection,
  onSection,
  onReopen,
  showEdit,
}: Props) {
  const resolved = (record.ava_status ?? '').startsWith('Resolved');
  const statusClass = record.ava_status === 'New' ? 'status-chip new' : 'status-chip';

  return (
    <aside className="case-rail">
      <div className="case-banner">
        <div className="case-icon">🗂</div>
        <div>
          <div className="case-id">{record.ava_name}</div>
          <div className="case-type">Business Control</div>
        </div>
        <div className="star">☆</div>
      </div>

      <div className="case-actions">
        {resolved && onReopen ? (
          <button className="link-btn" type="button" onClick={onReopen}>
            Reopen Case
          </button>
        ) : (
          showEdit && (
            <button className="link-btn" type="button">
              Edit ▾
            </button>
          )
        )}
        <button className="link-btn" type="button">
          Actions ▾
        </button>
      </div>

      <div className="case-summary">
        <div className="summary-row">
          <div className="k">Status</div>
          <div className="v">
            <span className={statusClass}>{dash(record.ava_status)}</span>
          </div>
        </div>
        <Row k="Case Owner" v={dash(record.ava_caseowner)} />
        <Row k="Review Template ID or Name" v={dash(record.ava_reviewtemplatename)} />
        <Row k="Queue Type" v={dash(record.ava_queuetype)} />
        <Row k="Review name" v={dash(record.ava_reviewname)} />
        <Row k="Channel" v={dash(record.ava_channel)} />
        <Row k="Product Type" v={dash(record.ava_producttype)} />
        <Row k="Purpose" v={dash(record.ava_purpose)} />
        <Row k="PID Description" v={dash(record.ava_piddescription)} />

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
          <div className="v person">
            {dash(record.modifiedbyname ?? record.ava_createdbyuser)}
            <br />
            {relativeTime(record.modifiedon)}
          </div>
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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="summary-row">
      <div className="k">{k}</div>
      <div className="v">{v}</div>
    </div>
  );
}
