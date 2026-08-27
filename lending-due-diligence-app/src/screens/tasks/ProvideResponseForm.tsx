import { useEffect, useMemo, useState } from 'react';
import { completeTask, listCaseErrors, listRatingsForCase, updateCase, updateRating } from '../../lib/data';
import { dash, formatDate } from '../../lib/format';
import type {
  CurrentUser,
  LddCase,
  LddCaseError,
  LddRating,
  LddTask,
  LddTransaction,
} from '../../lib/types';

interface Props {
  record: LddCase;
  task: LddTask;
  transaction: LddTransaction | null;
  user: CurrentUser;
  onCancel: () => void;
  onDone: () => void;
}

/**
 * Recommendation and action stage — "Provide Response for Escalation / Coaching".
 * Read-only Lender Rating and Recommendation summary, bilingual error list,
 * attestation radio group and frontline manager comments.
 */
export function ProvideResponseForm({ record, task, transaction, user, onCancel, onDone }: Props) {
  const [ratings, setRatings] = useState<LddRating[]>([]);
  const [caseErrors, setCaseErrors] = useState<LddCaseError[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attestation, setAttestation] = useState(record.ava_attestationprovided ?? '');
  const [comments, setComments] = useState(record.ava_responsecomments ?? '');

  const isEscalation = (task.ava_name ?? '').includes('Escalation');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rs = await listRatingsForCase(record.ava_lddcaseid);
        if (cancelled) return;
        setRatings(rs);
        setCaseErrors(await listCaseErrors(rs.map((r) => r.ava_lddratingid)));
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [record.ava_lddcaseid]);

  const lender = ratings.find((r) => r.ava_role === 'Lender') ?? ratings[0];
  const lenderErrors = useMemo(
    () => caseErrors.filter((e) => e._ava_ratingid_value === lender?.ava_lddratingid),
    [caseErrors, lender]
  );
  const primary = lenderErrors.find((e) => e.ava_isprimary) ?? lenderErrors[0];
  const secondary = lenderErrors.filter((e) => e !== primary);

  const persist = async (submit: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const now = new Date().toISOString();
      await updateCase(record.ava_lddcaseid, {
        ava_attestationprovided: attestation,
        ava_responsecomments: comments,
        ava_frontlinemanagercomments: comments,
        ava_responsedate: now,
        ...(submit
          ? {
              ava_status: 'Resolved-Review Completed',
              ava_resolvedby: user.displayName,
              ava_resolvedon: now,
            }
          : {}),
      });
      if (lender) {
        await updateRating(lender.ava_lddratingid, {
          ava_attestationprovided: attestation,
          ava_frontlinemanagercomments: comments,
          ava_responsedate: now,
        });
      }
      if (submit) await completeTask(task.ava_lddcasetaskid);
      onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel">
      <div className="task-head">
        <span className="avatar green">{user.initials}</span>
        <div>
          <div className="task-title">
            Provide Response for {isEscalation ? 'Escalation' : 'Coaching'}
          </div>
          <div className="task-sub">
            Provide Response for {isEscalation ? 'Escalation' : 'Coaching'}&nbsp;&nbsp;•&nbsp;&nbsp;Due 1
            hour from now
          </div>
        </div>
      </div>

      {error && <div className="banner-msg error">{error}</div>}

      <div className="section-title">Lender Rating and Recommendation</div>
      <hr className="rule" />

      <div className="field-grid" style={{ rowGap: 26 }}>
        <ReadOnly label="Employee Name" value={dash(lender?.ava_employeename)} />
        <ReadOnly label="Application number" value={dash(transaction?.ava_applicationnumber)} />
        <ReadOnly label="Region" value={dash(transaction?.ava_region)} />
        <ReadOnly label="Customer name" value={dash(transaction?.ava_customername)} />
        <ReadOnly label="Market" value={dash(transaction?.ava_market)} />
        <ReadOnly label="Funded Date" value={formatDate(transaction?.ava_fundeddate)} />
        <ReadOnly label="Operator ID" value={dash(lender?.ava_operatorid)} />
        <ReadOnly label="Mortgage Number" value={dash(transaction?.ava_mortgagenumber)} />
        <ReadOnly label="Application Date" value={formatDate(transaction?.ava_applicationdate)} />
        <ReadOnly label="MMortgage Number" value={dash(transaction?.ava_mmortgagenumber)} />
        <ReadOnly label="Source" value={dash(transaction?.ava_source)} />
        <ReadOnly label="Class Number" value={dash(transaction?.ava_classnumber)} />
        <ReadOnly label="" value="" />
        <ReadOnly label="Transit" value={dash(transaction?.ava_transit)} />
        <ReadOnly label="" value="" />
        <ReadOnly label="Transaction Level Unique ID" value={dash(transaction?.ava_name)} />
      </div>

      {loading ? (
        <div className="loading">Loading rating details…</div>
      ) : (
        <>
          <div className="section-title" style={{ marginTop: 34 }}>
            Primary and Secondary Error(s)
          </div>
          <hr className="rule" />
          {primary ? (
            <>
              <div className="readonly-pair">
                <span className="tag">Primary Error</span>
                <span className="arrow">→</span>
                <span>{primary.ava_name}</span>
              </div>
              {secondary.map((e) => (
                <div className="readonly-pair" key={e.ava_lddcaseerrorid}>
                  <span className="tag">Secondary Error</span>
                  <span className="arrow">→</span>
                  <span>{e.ava_name}</span>
                </div>
              ))}
            </>
          ) : (
            <div className="empty-row">No errors recorded.</div>
          )}

          <div className="section-title" style={{ marginTop: 26 }}>
            Erreurs primaire et secondaire
          </div>
          <hr className="rule" />
          {primary ? (
            <>
              <div className="readonly-pair">
                <span className="tag">Erreur principale</span>
                <span className="arrow">→</span>
                <span>{primary.ava_namefr || primary.ava_name}</span>
              </div>
              {secondary.map((e) => (
                <div className="readonly-pair" key={`fr-${e.ava_lddcaseerrorid}`}>
                  <span className="tag">Erreur secondaire</span>
                  <span className="arrow">→</span>
                  <span>{e.ava_namefr || e.ava_name}</span>
                </div>
              ))}
            </>
          ) : (
            <div className="empty-row">Aucune erreur enregistrée.</div>
          )}
        </>
      )}

      <div className="field-grid" style={{ marginTop: 28 }}>
        <ReadOnly label="BC due diligence" value={dash(record.ava_bcduediligence)} />
        <ReadOnly label="Employee Accountable" value={dash(record.ava_employeeaccountable)} />
        <ReadOnly label="Comments by analyst" value={dash(record.ava_analystcomments)} />
        <ReadOnly label="Reason for Reversal or Reduced to coaching" value={dash(record.ava_reasonforreversal)} />
      </div>

      <div style={{ marginTop: 28 }}>
        <div className="field-label req">Do you want to provide attestation?</div>
        <div className="radio-group">
          <label className="checkbox-row">
            <input
              type="radio"
              name="attestation"
              checked={attestation === 'Yes'}
              onChange={() => setAttestation('Yes')}
            />
            Yes
          </label>
          <label className="checkbox-row">
            <input
              type="radio"
              name="attestation"
              checked={attestation === 'No'}
              onChange={() => setAttestation('No')}
            />
            No
          </label>
        </div>
      </div>

      <div className="field-grid cols-1" style={{ marginTop: 20, maxWidth: 660 }}>
        <div className="field">
          <label htmlFor="responseComments">Comments</label>
          <textarea
            id="responseComments"
            value={comments}
            onChange={(e) => setComments(e.target.value)}
          />
        </div>
      </div>

      <div className="form-actions">
        <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <div className="spacer" />
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => persist(false)}
          disabled={busy}
        >
          Save
        </button>
        <button
          className="btn btn-primary"
          type="button"
          onClick={() => persist(true)}
          disabled={busy || !attestation}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  if (!label) return <div />;
  return (
    <div>
      <div className="readonly-label">{label}</div>
      <div className="readonly-value">{value}</div>
    </div>
  );
}
