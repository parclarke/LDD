import { useEffect, useState } from 'react';
import type { LddAssignment, LddCaseHistory, LddWorkCase } from '../lib/types';
import { listAssignmentsForCase, listHistoryForCase } from '../lib/data';
import { caseTypeName, stagesFor, type AppData } from '../lib/appdata';
import { formatDate, formatDateTime, relativeTime } from '../lib/format';
import { StatusChip } from '../components/Primitives';
import { Icon } from '../components/Icon';
import { iconFor } from '../lib/icons';
import { urgencyOf } from '../lib/status';

interface CaseScreenProps {
  data: AppData;
  record: LddWorkCase;
  onBack: () => void;
  onOpenAssignment: (assignment: LddAssignment) => void;
}

type Tab = 'Details' | 'Pulse' | 'History';

/**
 * Full-page case view: a purple summary column with the case facts and vertical
 * tabs on the left, the active definition form and details card on the right.
 */
export function CaseScreen({ data, record, onBack, onOpenAssignment }: CaseScreenProps) {
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
  const open = assignments[0];
  const typeName = caseTypeName(data, record.ava_casetypecode);

  return (
    <>
      <div className="crumbs">
        <a onClick={onBack}>{typeName}</a>
        <span>/</span>
        <strong>{record.ava_name}</strong>
      </div>

      <div className="caselayout">
        <aside className="caseside">
          <div className="casehero">
            <div className="cico">
              <Icon name={iconFor(record.ava_casetypecode ?? undefined, Math.max(typeIndex, 0))} />
            </div>
            <h2>{record.ava_stagename ?? record.ava_name}</h2>
            <div className="sub">
              {typeName} • {record.ava_name}
            </div>
          </div>

          <div className="casefacts">
            <div>
              <div className="k">Urgency</div>
              <div className="v big">{urgencyOf(record)}</div>
            </div>
            <div>
              <div className="k">Work Status</div>
              <div className="v">
                <StatusChip status={record.ava_status} />
              </div>
            </div>
            <div>
              <div className="k">Created by</div>
              <div className="v">
                {record.ava_createdbyuser ?? record.createdbyname ?? '—'}
                <div className="rel">{relativeTime(record.createdon)}</div>
              </div>
            </div>
            <div>
              <div className="k">Updated by</div>
              <div className="v">
                {record.modifiedbyname ?? '—'}
                <div className="rel">{relativeTime(record.modifiedon)}</div>
              </div>
            </div>
          </div>

          <div className="sidetabs" role="tablist">
            {(['Details', 'Pulse', 'History'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                role="tab"
                aria-selected={tab === t}
                className={tab === t ? 'sidetab on' : 'sidetab'}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="sidebody">
            {tab === 'Details' ? (
              <dl className="flist">
                <div className="frow">
                  <dt>Stage</dt>
                  <dd>{record.ava_stagename ?? '—'}</dd>
                </div>
                <div className="frow">
                  <dt>Assigned to</dt>
                  <dd>{record.ava_assignedto ?? record.ava_workbasket ?? '—'}</dd>
                </div>
                <div className="frow">
                  <dt>SLA deadline</dt>
                  <dd>{record.ava_sladeadline ? formatDateTime(record.ava_sladeadline) : '—'}</dd>
                </div>
              </dl>
            ) : null}
            {tab === 'Pulse' ? <div className="empty">No conversations yet</div> : null}
            {tab === 'History' ? (
              history.length === 0 ? (
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
              )
            ) : null}
          </div>
        </aside>

        <div className="casemain">
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

          <section className="card">
            <div className="cardhd">
              <h3>{open?.ava_name ?? 'Definition'}</h3>
            </div>
            <div className="cardbody">
              {open ? (
                <>
                  <p className="muted">
                    {open.ava_assignedto ?? open.ava_workbasket ?? 'Unassigned'}
                    {open.ava_deadline ? ` • due ${formatDate(open.ava_deadline)}` : ''}
                  </p>
                  <div className="caseactions">
                    <button className="btn o" type="button" onClick={onBack}>
                      Cancel
                    </button>
                    <div className="right">
                      <button className="btn o" type="button">
                        <span className="sparkle">✦</span> Fill with sample data
                      </button>
                      <button className="btn o" type="button">
                        Save for later
                      </button>
                      <button className="btn" type="button" onClick={() => onOpenAssignment(open)}>
                        Next
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty">No open assignments</div>
              )}
            </div>
          </section>

          <section className="card">
            <div className="cardhd">
              <h3>Details</h3>
            </div>
            <div className="cardbody">
              <dl className="flist two">
                <div className="frow">
                  <dt>Work id</dt>
                  <dd>{record.ava_name}</dd>
                </div>
                <div className="frow">
                  <dt>Label</dt>
                  <dd>{record.ava_customeridname ?? record.ava_stagename ?? '—'}</dd>
                </div>
                <div className="frow">
                  <dt>Urgency</dt>
                  <dd>{urgencyOf(record)}</dd>
                </div>
                <div className="frow">
                  <dt>Work status</dt>
                  <dd>{record.ava_status ?? '—'}</dd>
                </div>
              </dl>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
