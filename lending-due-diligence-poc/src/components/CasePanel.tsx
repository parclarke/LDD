import { useEffect, useState } from 'react';
import type { LddAssignment, LddCaseHistory, LddWorkCase } from '../lib/types';
import { listAssignmentsForCase, listHistoryForCase } from '../lib/data';
import { caseTypeName, stagesFor, type AppData } from '../lib/appdata';
import { formatDate, formatDateTime, relativeTime } from '../lib/format';
import { StatusChip } from './Primitives';
import { Icon } from './Icon';
import { iconFor } from '../lib/icons';
import { urgencyOf } from '../lib/status';

interface CasePanelProps {
  data: AppData;
  record: LddWorkCase;
  onClose: () => void;
  onOpenAssignment: (assignment: LddAssignment) => void;
}

type Tab = 'Details' | 'History';

/**
 * Right-hand case preview drawer. In Pega, clicking a Case ID previews the case
 * while clicking an Assignment opens the step form — the prototype keeps that
 * distinction and so does this.
 */
export function CasePanel({ data, record, onClose, onOpenAssignment }: CasePanelProps) {
  const [tab, setTab] = useState<Tab>('Details');
  const [assignments, setAssignments] = useState<LddAssignment[]>([]);
  const [history, setHistory] = useState<LddCaseHistory[]>([]);

  const caseId = record.ava_lddworkcaseid;

  useEffect(() => {
    let cancelled = false;
    Promise.all([listAssignmentsForCase(caseId), listHistoryForCase(caseId)])
      .then(([a, h]) => {
        if (cancelled) return;
        setAssignments(a);
        setHistory(h);
      })
      .catch(() => {
        if (!cancelled) {
          setAssignments([]);
          setHistory([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  const typeIndex = data.caseTypes.findIndex((t) => t.ava_code === record.ava_casetypecode);
  const type = data.caseTypes[typeIndex];
  const stages = stagesFor(data, type?.ava_lddcasetypeid);
  const currentIndex = stages.findIndex((s) => s.ava_stagecode === record.ava_stagecode);

  return (
    <div className="panel-wrap">
      <div className="panel-scrim" onClick={onClose} />
      <div className="panel">
        <button className="panel-x" onClick={onClose} title="Close" type="button">
          ✕
        </button>
        <div className="panel-hd">
          <div className="cico">
            <Icon name={iconFor(record.ava_casetypecode ?? undefined, Math.max(typeIndex, 0))} />
          </div>
          <div>
            <h2>{record.ava_name}</h2>
            <div className="sub">{caseTypeName(data, record.ava_casetypecode)}</div>
          </div>
          <div className="tools">
            <button title="Edit" type="button">
              <Icon name="pencil" />
            </button>
            <button title="More" type="button">
              <Icon name="kebab" />
            </button>
          </div>
        </div>

        <div className="panel-body">
          {stages.length > 0 ? (
            <div className="stagestrip">
              {stages.map((s, i) => (
                <div
                  key={s.ava_lddstageid}
                  className={`sc ${i === currentIndex ? 'on' : i < currentIndex ? 'done' : ''}`.trim()}
                >
                  {s.ava_name}
                </div>
              ))}
            </div>
          ) : null}

          <div className="sect">
            <div className="sect-hd">
              <span className="caret">▾</span> Assignments
            </div>
            <div className="sect-body">
              {assignments.length === 0 ? (
                <div className="empty">No open assignments</div>
              ) : (
                assignments.map((a) => (
                  <div className="asg" key={a.ava_lddassignmentid}>
                    <div className="nm">{a.ava_name}</div>
                    <div className="meta">
                      {a.ava_assignedto ?? a.ava_workbasket ?? 'Unassigned'}
                      {a.ava_deadline ? ` · due ${formatDate(a.ava_deadline)}` : ''}
                    </div>
                    <button className="go" type="button" onClick={() => onOpenAssignment(a)}>
                      Go
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="tabcard">
            <div className="tabs">
              {(['Details', 'History'] as Tab[]).map((t) => (
                <div
                  key={t}
                  className={`tab ${tab === t ? 'on' : ''}`.trim()}
                  onClick={() => setTab(t)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') setTab(t);
                  }}
                >
                  {t}
                </div>
              ))}
            </div>
            <div className="tabbody">
              {tab === 'Details' ? (
                <>
                  <h3>Case details</h3>
                  <div className="wsl">
                    <StatusChip status={record.ava_status} />
                  </div>
                  <dl style={{ margin: 0 }}>
                    <div className="frow">
                      <dt>Stage</dt>
                      <dd>{record.ava_stagename ?? '—'}</dd>
                    </div>
                    <div className="frow">
                      <dt>Assigned to</dt>
                      <dd>{record.ava_assignedto ?? record.ava_workbasket ?? '—'}</dd>
                    </div>
                    <div className="frow">
                      <dt>Urgency</dt>
                      <dd>{urgencyOf(record)}</dd>
                    </div>
                    <div className="frow">
                      <dt>SLA deadline</dt>
                      <dd>{record.ava_sladeadline ? formatDateTime(record.ava_sladeadline) : '—'}</dd>
                    </div>
                    <div className="frow">
                      <dt>Created</dt>
                      <dd>
                        {record.ava_createdbyuser ?? record.createdbyname ?? '—'}{' '}
                        <span className="rel">{relativeTime(record.createdon)}</span>
                      </dd>
                    </div>
                    <div className="frow">
                      <dt>Updated</dt>
                      <dd>
                        {record.modifiedbyname ?? '—'}{' '}
                        <span className="rel">{relativeTime(record.modifiedon)}</span>
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <>
                  <h3>History</h3>
                  {history.length === 0 ? (
                    <div className="empty">No history recorded</div>
                  ) : (
                    <ul className="hist">
                      {history
                        .slice()
                        .reverse()
                        .map((h) => (
                          <li key={h.ava_lddcasehistoryid}>
                            <span className="when">{formatDateTime(h.ava_eventdate)}</span>
                            <span>
                              {h.ava_name}
                              {h.ava_details ? <div className="muted small">{h.ava_details}</div> : null}
                            </span>
                          </li>
                        ))}
                    </ul>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="note">
            Clicking a <b>Case ID</b> previews the case; clicking an <b>Assignment</b> opens the step form —
            the same interaction model as the source application.
          </div>
        </div>
      </div>
    </div>
  );
}
