import { useEffect, useState } from 'react';
import { listCases } from '../lib/data';
import { dash, relativeTime } from '../lib/format';
import type { LddCase } from '../lib/types';

interface Props {
  onOpenCase: (caseId: string) => void;
  onNewCase: () => void;
}

/** All Business Control cases, used as the landing list for Business Control analysts. */
export function CaseListScreen({ onOpenCase, onNewCase }: Props) {
  const [cases, setCases] = useState<LddCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    listCases()
      .then((c) => !cancelled && setCases(c))
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <div className="page-title-bar">
        Business Control Cases
        <div style={{ flex: 1 }} />
        <button className="btn btn-primary" type="button" onClick={onNewCase}>
          + Create Business Control case
        </button>
      </div>
      <div className="work-area">
        <div className="panel">
          {error && <div className="banner-msg error">{error}</div>}
          {loading ? (
            <div className="loading">Loading cases…</div>
          ) : (
            <div className="grid-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>Case ID</th>
                    <th>Status</th>
                    <th>Stage</th>
                    <th>Queue Type</th>
                    <th>Review name</th>
                    <th>Product Type</th>
                    <th>Purpose</th>
                    <th>BC due diligence</th>
                    <th>Case Owner</th>
                    <th>Updated</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cases.length === 0 && (
                    <tr>
                      <td colSpan={11} className="empty-row">
                        ✧ No results.
                      </td>
                    </tr>
                  )}
                  {cases.map((c) => (
                    <tr key={c.ava_lddcaseid}>
                      <td>
                        <span className="case-link" onClick={() => onOpenCase(c.ava_lddcaseid)}>
                          {c.ava_name}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            c.ava_status === 'New' ? 'status-chip new' : 'status-chip'
                          }
                        >
                          {dash(c.ava_status)}
                        </span>
                      </td>
                      <td>{dash(c.ava_stage)}</td>
                      <td>{dash(c.ava_queuetype)}</td>
                      <td>{dash(c.ava_reviewname)}</td>
                      <td>{dash(c.ava_producttype)}</td>
                      <td>{dash(c.ava_purpose)}</td>
                      <td>{dash(c.ava_bcduediligence)}</td>
                      <td>{dash(c.ava_caseowner)}</td>
                      <td>{relativeTime(c.modifiedon)}</td>
                      <td>
                        <button
                          className="btn btn-primary btn-sm"
                          type="button"
                          onClick={() => onOpenCase(c.ava_lddcaseid)}
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
