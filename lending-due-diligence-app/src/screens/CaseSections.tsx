import { dash, formatDateTime, relativeTime } from '../lib/format';
import { stageByCode, stepsForStage } from '../lib/engine';
import type { CaseBundle, LddViewField, ProcessConfig } from '../lib/types';

interface Props {
  section: string;
  bundle: CaseBundle;
  config: ProcessConfig;
}

/** Read-only case sections: details, the process model and the audit trail. */
export function CaseSections({ section, bundle, config }: Props) {
  if (section === 'Case Details') return <DetailSection bundle={bundle} config={config} />;
  if (section === 'Process') return <ProcessSection bundle={bundle} config={config} />;
  if (section === 'History') return <HistorySection bundle={bundle} />;
  if (section === 'Notifications') return <NotificationSection bundle={bundle} />;
  return null;
}

/**
 * Shows every stored value on the case detail row, labelled using the view-field
 * metadata where a label exists.
 */
function DetailSection({ bundle, config }: Props extends never ? never : { bundle: CaseBundle; config: ProcessConfig }) {
  const { detail, record } = bundle;
  const labels = new Map<string, string>();
  for (const f of config.viewFields as LddViewField[]) {
    labels.set(`ava_${f.ava_name.toLowerCase()}`, f.ava_label ?? f.ava_name);
  }

  const entries = Object.entries(detail ?? {})
    .filter(([k, v]) => k.startsWith('ava_') && !k.endsWith('id') && v !== null && v !== '')
    .filter(([k]) => k !== 'ava_name')
    .sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="panel">
      <div className="section-title">Case details</div>
      <hr className="rule" />
      {entries.length === 0 ? (
        <div className="empty-row">No detail values captured yet.</div>
      ) : (
        <div className="field-grid" style={{ rowGap: 22 }}>
          {entries.map(([k, v]) => (
            <div key={k}>
              <div className="readonly-label">{labels.get(k) ?? prettify(k)}</div>
              <div className="readonly-value">{renderValue(v)}</div>
            </div>
          ))}
        </div>
      )}

      <div className="section-title" style={{ marginTop: 30 }}>
        Linked records
      </div>
      <hr className="rule" />
      <div className="field-grid" style={{ rowGap: 22 }}>
        <div>
          <div className="readonly-label">Lending transaction</div>
          <div className="readonly-value">{dash(record.ava_transactionidname)}</div>
        </div>
        <div>
          <div className="readonly-label">Customer</div>
          <div className="readonly-value">{dash(record.ava_customeridname)}</div>
        </div>
      </div>
    </div>
  );
}

/** Renders the configured stages and steps, marking where the case currently sits. */
function ProcessSection({ bundle, config }: { bundle: CaseBundle; config: ProcessConfig }) {
  const { record, stages, steps } = bundle;
  const currentStage = stageByCode(stages, record.ava_stagecode);
  const ordered = [...stages].sort((a, b) => {
    if (a.ava_stagetype !== b.ava_stagetype) return a.ava_stagetype === 'Primary' ? -1 : 1;
    return (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0);
  });

  return (
    <div className="panel">
      <div className="section-title">Process model</div>
      <hr className="rule" />
      <p className="muted" style={{ fontSize: 13 }}>
        Imported from the Pega prototype. Stages and steps are configuration rows, so changing
        the process does not require a code change.
      </p>

      {ordered.map((stage) => {
        const stageSteps = stepsForStage(steps, stage.ava_lddstageid);
        const isCurrent = stage.ava_stagecode === currentStage?.ava_stagecode;
        return (
          <div key={stage.ava_lddstageid} style={{ marginTop: 22 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <strong>{stage.ava_name}</strong>
              <span className={`pill ${stage.ava_stagetype === 'Primary' ? 'primary' : 'alt'}`}>
                {stage.ava_stagetype}
              </span>
              {stage.ava_transition && <span className="pill">{stage.ava_transition}</span>}
              {isCurrent && <span className="pill done">current</span>}
            </div>
            {stage.ava_processname && (
              <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
                Process: {stage.ava_processname}
              </div>
            )}
            <ul className="step-list" style={{ marginTop: 8 }}>
              {stageSteps.length === 0 && (
                <li>
                  <span className="muted">No steps configured for this stage.</span>
                </li>
              )}
              {stageSteps.map((st, i) => {
                const stepIsCurrent = isCurrent && i === (record.ava_currentstepindex ?? 0);
                const stepIsDone = isCurrent && i < (record.ava_currentstepindex ?? 0);
                return (
                  <li
                    key={st.ava_lddstepid}
                    className={stepIsCurrent ? 'current' : stepIsDone ? 'complete' : ''}
                  >
                    <span className="s-index">{i + 1}</span>
                    <span className="s-name">
                      {st.ava_name}
                      {st.ava_viewname && <span className="s-kind"> &middot; {st.ava_viewname}</span>}
                    </span>
                    <span className="s-kind">
                      {st.ava_kind}
                      {st.ava_impl ? ` / ${st.ava_impl}` : ''}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <div className="section-title" style={{ marginTop: 32 }}>
        Decision tables for this case type
      </div>
      <hr className="rule" />
      {config.decisions
        .filter((d) => d.ava_casetypecode === record.ava_casetypecode)
        .map((d) => {
          const rows = config.decisionRows
            .filter((r) => r._ava_decisionid_value === d.ava_ldddecisionid)
            .sort((a, b) => (a.ava_sortorder ?? 0) - (b.ava_sortorder ?? 0));
          const conditions: string[] = safeParse(d.ava_conditions);
          return (
            <div key={d.ava_ldddecisionid} style={{ marginBottom: 22 }}>
              <strong>{d.ava_name}</strong>
              <div className="muted" style={{ fontSize: 12, margin: '3px 0 8px' }}>
                {d.ava_description}
              </div>
              <div className="grid-wrap">
                <table className="grid">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>Op</th>
                      {conditions.map((c) => (
                        <th key={c}>{c}</th>
                      ))}
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const when: string[] = safeParse(r.ava_whenvalues);
                      return (
                        <tr key={r.ava_ldddecisionrowid}>
                          <td>{r.ava_operator}</td>
                          {conditions.map((c, i) => (
                            <td key={c}>{when[i] ?? '—'}</td>
                          ))}
                          <td>
                            <strong>{r.ava_result}</strong>
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td>otherwise</td>
                      {conditions.map((c) => (
                        <td key={c}>—</td>
                      ))}
                      <td>
                        <strong>{d.ava_otherwise}</strong>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
    </div>
  );
}

/**
 * The notification outbox for this case.
 *
 * The app queues rows here; a Power Automate flow triggers on create, sends the
 * mail and stamps the outcome back. Showing it on the case makes both halves
 * visible - what the case raised, and whether delivery actually succeeded.
 */
function NotificationSection({ bundle }: { bundle: CaseBundle }) {
  const { notifications } = bundle;
  return (
    <div className="panel">
      <div className="section-title">Notifications</div>
      <hr className="rule" />
      <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>
        Queued by the case. Delivery is owned by a Power Automate flow that triggers on
        these rows and writes the status back.
      </p>
      {notifications.length === 0 ? (
        <div className="empty-row">No notifications raised by this case yet.</div>
      ) : (
        <div className="grid-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th style={{ width: 90 }}>Status</th>
                <th>Subject</th>
                <th>Step</th>
                <th>Recipient</th>
                <th style={{ width: 150 }}>Queued</th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.ava_lddnotificationid}>
                  <td>
                    <span className={`pill${n.ava_status === 'Failed' ? '' : ' primary'}`}>
                      {dash(n.ava_status)}
                    </span>
                  </td>
                  <td>
                    <strong>{dash(n.ava_subject)}</strong>
                    {n.ava_body && (
                      <>
                        <br />
                        <span className="muted" style={{ fontSize: 12 }}>
                          {n.ava_body.slice(0, 160)}
                          {n.ava_body.length > 160 ? '…' : ''}
                        </span>
                      </>
                    )}
                    {n.ava_errormessage && (
                      <>
                        <br />
                        <span className="muted" style={{ fontSize: 12 }}>
                          Error: {n.ava_errormessage}
                        </span>
                      </>
                    )}
                  </td>
                  <td>{dash(n.ava_stepname)}</td>
                  <td>{n.ava_recipient || dash(n.ava_recipientrole)}</td>
                  <td>
                    {formatDateTime(n.ava_queuedon)}
                    {n.ava_senton && (
                      <>
                        <br />
                        <span className="muted" style={{ fontSize: 12 }}>
                          sent {relativeTime(n.ava_senton)}
                        </span>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HistorySection({ bundle }: { bundle: CaseBundle }) {
  const { history } = bundle;
  return (
    <div className="panel">
      <div className="section-title">Audit trail</div>
      <hr className="rule" />
      {history.length === 0 ? (
        <div className="empty-row">No history recorded.</div>
      ) : (
        <ul className="timeline">
          {history.map((h) => (
            <li key={h.ava_lddcasehistoryid}>
              <span className="t-when">
                {formatDateTime(h.ava_eventdate)}
                <br />
                <span className="muted">{relativeTime(h.ava_eventdate)}</span>
              </span>
              <span>
                <span className="pill">{h.ava_eventtype}</span>
              </span>
              <span>
                <span className="t-what">{h.ava_name}</span>
                {h.ava_details && (
                  <>
                    <br />
                    <span className="muted" style={{ fontSize: 12 }}>
                      {h.ava_details}
                    </span>
                  </>
                )}
                <br />
                <span className="muted" style={{ fontSize: 12 }}>
                  by {dash(h.ava_performedby)}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function prettify(column: string): string {
  return column
    .replace(/^ava_/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase());
}

function renderValue(v: unknown): string {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  const s = String(v);
  // ISO dates render more readably as a plain date.
  if (/^\d{4}-\d{2}-\d{2}(T00:00:00Z?)?$/.test(s)) return s.slice(0, 10).split('-').reverse().join('/');
  return s;
}

function safeParse<T>(raw: unknown): T[] {
  if (typeof raw !== 'string' || !raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
